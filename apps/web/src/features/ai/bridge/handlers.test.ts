import { afterEach, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { BRIDGE_METHODS } from './protocol';
import { MAX_PENDING_PROPOSALS } from './handlers';
import { addCardPlan, clearQueue, openTestSession } from './testing';
import { listProposals } from '../proposals';
afterEach(clearQueue);
describe('read handlers', () => {
  it('summarizes the live Stack', async () => {
    const { session, handlers } = await openTestSession('Quiz');
    session.dispatch({ type: 'ADD_CARD', cardId: 'q2', title: 'Question 2' });
    const r = await handlers.handle('stack.summary', {});
    expect(r.ok).toBe(true);
    const v = (r as { value: { title: string; stackId: string; cards: { cardId: string }[] } }).value;
    expect(v.title).toBe('Quiz');
    expect(v.stackId).toBe(session.stackId);
    expect(v.cards.map((c) => c.cardId)).toEqual(['start', 'q2']);
  });
  it('returns one Card in detail and rejects an unknown or malformed id', async () => {
    const { handlers } = await openTestSession();
    const good = await handlers.handle('card.details', { cardId: 'start' });
    expect(good).toMatchObject({ ok: true, value: { card: { cardId: 'start' } } });
    expect(await handlers.handle('card.details', { cardId: 'nope' })).toMatchObject({ ok: false });
    expect(await handlers.handle('card.details', { cardId: 5 })).toMatchObject({ ok: false });
    expect(await handlers.handle('card.details', null)).toMatchObject({ ok: false });
  });
  it('validates the project', async () => {
    const { handlers } = await openTestSession();
    expect(await handlers.handle('project.validate', {})).toEqual({ ok: true, value: { valid: true } });
  });
});
describe('proposal.submit', () => {
  it('enqueues a plan that applies and leaves the Stack untouched', async () => {
    const { session, handlers } = await openTestSession();
    const before = JSON.stringify(session.getStack());
    const r = await handlers.handle('proposal.submit', { plan: addCardPlan() });
    expect(r).toMatchObject({ ok: true, value: { stepCount: 1, waitingForApproval: 1 } });
    expect(listProposals()).toHaveLength(1);
    expect(listProposals()[0]).toMatchObject({ source: 'mcp' });
    expect(JSON.stringify(session.getStack())).toBe(before);
    expect(session.getStatus().canUndo).toBe(false);
  });
  it('refuses a plan that fails the dry run and queues nothing', async () => {
    const { session, handlers } = await openTestSession();
    const plan = addCardPlan('start', 'Duplicate id');
    const r = await handlers.handle('proposal.submit', { plan });
    expect(r).toMatchObject({ ok: false });
    expect(listProposals()).toHaveLength(0);
    expect(session.getStack().cards['start']?.title).not.toBe('Duplicate id');
  });
  it('refuses a malformed plan', async () => {
    const { handlers } = await openTestSession();
    expect(await handlers.handle('proposal.submit', { plan: { schemaVersion: 1 } })).toMatchObject({
      ok: false,
      error: { code: 'INVALID_AI_PLAN' },
    });
    expect(await handlers.handle('proposal.submit', undefined)).toMatchObject({ ok: false });
    expect(listProposals()).toHaveLength(0);
  });
  it('caps the number of waiting proposals', async () => {
    const { handlers } = await openTestSession();
    for (let i = 0; i < MAX_PENDING_PROPOSALS; i++) {
      expect((await handlers.handle('proposal.submit', { plan: addCardPlan(`c${i}`, `C${i}`) })).ok).toBe(
        true,
      );
    }
    const r = await handlers.handle('proposal.submit', { plan: addCardPlan('extra', 'Extra') });
    expect(r).toMatchObject({ ok: false });
    expect(listProposals()).toHaveLength(MAX_PENDING_PROPOSALS);
  });
});
describe('checkpoint.create', () => {
  it('stores a labelled copy and does not touch the Stack', async () => {
    const { session, checkpoints, handlers } = await openTestSession();
    const before = JSON.stringify(session.getStack());
    const r = await handlers.handle('checkpoint.create', { label: 'before agent' });
    expect(r.ok).toBe(true);
    const list = await checkpoints.list(session.stackId);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ label: 'Agent: before agent', kind: 'manual' });
    expect(JSON.stringify(session.getStack())).toBe(before);
    expect(session.getStatus().canUndo).toBe(false);
  });
  it('rejects a missing or long label', async () => {
    const { handlers } = await openTestSession();
    expect((await handlers.handle('checkpoint.create', {})).ok).toBe(false);
    expect((await handlers.handle('checkpoint.create', { label: 'x'.repeat(81) })).ok).toBe(false);
  });
  it('reports CHECKPOINT_FAILED when storage fails', async () => {
    const { session } = await openTestSession();
    const { createBridgeHandlers } = await import('./handlers');
    const failing = createBridgeHandlers({
      getSession: () => session,
      checkpoints: { put: () => Promise.reject(new Error('disk full')) },
      enqueue: () => {
        throw new Error('not used');
      },
      pendingCount: () => 0,
      now: () => new Date().toISOString(),
      newId: () => 'k1',
    });
    expect(await failing.handle('checkpoint.create', { label: 'x' })).toMatchObject({
      ok: false,
      error: { code: 'CHECKPOINT_FAILED' },
    });
  });
});
describe('property: nothing the bridge can ask changes the Stack', () => {
  it('leaves the Stack and the undo history unchanged for any sequence of requests', async () => {
    const { session, handlers } = await openTestSession();
    const before = JSON.stringify(session.getStack());
    const params = fc.oneof(
      fc.anything(),
      fc.record({ cardId: fc.string({ maxLength: 12 }) }),
      fc.record({ label: fc.string({ maxLength: 100 }) }),
      fc.record({
        plan: fc.oneof(fc.anything(), fc.constantFrom(addCardPlan('p1', 'P1'), addCardPlan('start', 'X'))),
      }),
    );
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.tuple(fc.constantFrom(...BRIDGE_METHODS), params), { maxLength: 6 }),
        async (calls) => {
          for (const [method, p] of calls) await handlers.handle(method, p);
          expect(JSON.stringify(session.getStack())).toBe(before);
          expect(session.getStatus().canUndo).toBe(false);
          expect(session.getStatus().canRedo).toBe(false);
          clearQueue();
        },
      ),
      { numRuns: 40 },
    );
  });
});
