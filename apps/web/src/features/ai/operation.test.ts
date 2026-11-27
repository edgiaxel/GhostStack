import { beforeEach, describe, expect, it } from 'vitest';
import { err, ok } from '@ghoststack/shared-contracts';
import { createOperationController, evaluatePlan } from './operation';
import type { OperationController } from './operation';
import { dismissProposal, enqueueProposal, listProposals } from './proposals';
import { createProviderStore } from './store';
import type { ProviderStore } from './store';
import { addCardPlan, brokenPlan, openRealSession, scriptedAdapter } from './testing';
import type { ScriptedAdapter } from './testing';
const memoryStorage = () => {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
};
async function setup(adapter: ScriptedAdapter): Promise<{
  controller: OperationController;
  providers: ProviderStore;
  session: Awaited<ReturnType<typeof openRealSession>>['session'];
}> {
  const { session, checkpoints } = await openRealSession();
  const providers = createProviderStore({ storage: () => memoryStorage(), createProvider: () => adapter });
  providers.saveSettings({ kind: 'demo' });
  const controller = createOperationController({ session, checkpoints, providers });
  controller.setDraft({ prompt: 'add a card', scopeKind: 'stack' });
  return { controller, providers, session };
}
beforeEach(() => {
  for (const p of listProposals()) dismissProposal(p.id);
});
describe('evaluatePlan', () => {
  it('marks steps ok, failed and unchecked in run order', async () => {
    const { session } = await openRealSession();
    const result = evaluatePlan(session.getStack(), brokenPlan(), '2026-12-01T00:00:00.000Z');
    expect(result.ok).toBe(false);
    expect(result.steps).toEqual({ s1: 'ok', s2: 'failed' });
    expect(result.error?.code).toBe('INVALID_PATCH_COMMAND');
  });
  it('passes a plan that applies', async () => {
    const { session } = await openRealSession();
    const result = evaluatePlan(session.getStack(), addCardPlan(), '2026-12-01T00:00:00.000Z');
    expect(result).toMatchObject({ ok: true, steps: { s1: 'ok' } });
    expect(session.getStack().cardOrder).toHaveLength(1);
  });
});
describe('prompt journey', () => {
  it('plans, reviews, applies as one undo step with a checkpoint, then reverts', async () => {
    const adapter = scriptedAdapter(() => ok(addCardPlan()));
    const { controller, session } = await setup(adapter);
    await controller.submit({ kind: 'stack' });
    expect(controller.getSnapshot().state.phase).toBe('review');
    expect(session.getStack().cardOrder).toHaveLength(1);
    await controller.approve();
    const done = controller.getSnapshot().state;
    expect(done.phase).toBe('done');
    expect(session.getStack().cardOrder).toHaveLength(2);
    expect(session.undo()).toBe(true);
    expect(session.getStack().cardOrder).toHaveLength(1);
    expect(session.redo()).toBe(true);
    expect(session.getStack().cardOrder).toHaveLength(2);
  });
  it('reverts as one undo step, and undo brings the change back', async () => {
    const { controller, session } = await setup(scriptedAdapter(() => ok(addCardPlan())));
    await controller.submit({ kind: 'stack' });
    await controller.approve();
    controller.revert();
    expect(controller.getSnapshot().state.phase).toBe('reverted');
    expect(session.getStack().cardOrder).toHaveLength(1);
    expect(session.undo()).toBe(true);
    expect(session.getStack().cardOrder).toHaveLength(2);
  });
  it('sends the request text and context to the adapter and nothing else', async () => {
    const adapter = scriptedAdapter(() => ok(addCardPlan()));
    const { controller } = await setup(adapter);
    await controller.submit({ kind: 'stack' });
    expect(adapter.requests).toHaveLength(1);
    expect(adapter.requests[0]?.prompt).toBe('add a card');
    expect(adapter.requests[0]?.context.scope).toEqual({ kind: 'stack' });
  });
  it('refuses to approve a plan that fails the dry run, without touching the Stack', async () => {
    const adapter = scriptedAdapter(() => ok(brokenPlan()));
    const { controller, session } = await setup(adapter);
    await controller.submit({ kind: 'stack' });
    await controller.approve();
    const state = controller.getSnapshot().state;
    expect(state.phase).toBe('review');
    expect(state.phase === 'review' && state.applyError?.code).toBe('INVALID_PATCH_COMMAND');
    expect(session.getStack().cardOrder).toHaveLength(1);
    expect(session.getStatus().canUndo).toBe(false);
  });
  it('shows a provider failure and keeps the request text', async () => {
    const adapter = scriptedAdapter(() =>
      err({ code: 'PROVIDER_AUTH_FAILED', message: 'The provider rejected the credentials.' }),
    );
    const { controller, session } = await setup(adapter);
    await controller.submit({ kind: 'stack' });
    const s = controller.getSnapshot();
    expect(s.state).toMatchObject({ phase: 'idle', error: { code: 'PROVIDER_AUTH_FAILED' } });
    expect(s.draft.prompt).toBe('add a card');
    expect(session.getStack().cardOrder).toHaveLength(1);
  });
  it('turns an adapter that throws into a provider error', async () => {
    const adapter = scriptedAdapter(() => {
      throw new Error('boom with sk-secret');
    });
    const { controller } = await setup(adapter);
    await controller.submit({ kind: 'stack' });
    const s = controller.getSnapshot().state;
    expect(s).toMatchObject({ phase: 'idle', error: { code: 'PROVIDER_UNAVAILABLE' } });
    expect(JSON.stringify(s)).not.toContain('sk-secret');
  });
  it('rejects output that is not a plan', async () => {
    const adapter = scriptedAdapter(() => ok({ nonsense: true } as never));
    const { controller } = await setup(adapter);
    await controller.submit({ kind: 'stack' });
    expect(controller.getSnapshot().state).toMatchObject({
      phase: 'idle',
      error: { code: 'INVALID_AI_PLAN' },
    });
  });
  it('cancels a slow request and ignores its late answer', async () => {
    let release: () => void = () => undefined;
    const adapter = scriptedAdapter(
      () => new Promise((resolve) => (release = () => resolve(ok(addCardPlan())))),
    );
    const { controller } = await setup(adapter);
    const pending = controller.submit({ kind: 'stack' });
    await Promise.resolve();
    expect(controller.getSnapshot().state.phase).toBe('planning');
    controller.cancel();
    expect(controller.getSnapshot().state).toMatchObject({
      phase: 'idle',
      notice: expect.stringContaining('cancelled'),
    });
    release();
    await pending;
    expect(controller.getSnapshot().state.phase).toBe('idle');
  });
  it('does not revert after a manual edit', async () => {
    const adapter = scriptedAdapter(() => ok(addCardPlan()));
    const { controller, session } = await setup(adapter);
    await controller.submit({ kind: 'stack' });
    await controller.approve();
    session.dispatch({ type: 'RENAME_CARD', cardId: 'c1', title: 'Mine' });
    controller.revert();
    expect(controller.getSnapshot().state).toMatchObject({
      phase: 'done',
      revertError: { code: 'TRANSACTION_FAILED' },
    });
    expect(session.getStack().cards['c1']?.title).toBe('Mine');
  });
  it('revise keeps the draft and reject changes nothing', async () => {
    const adapter = scriptedAdapter(() => ok(addCardPlan()));
    const { controller, session } = await setup(adapter);
    await controller.submit({ kind: 'stack' });
    controller.revise();
    expect(controller.getSnapshot()).toMatchObject({
      state: { phase: 'idle' },
      draft: { prompt: 'add a card' },
    });
    await controller.submit({ kind: 'stack' });
    controller.reject();
    expect(controller.getSnapshot().state.phase).toBe('idle');
    expect(session.getStack().cardOrder).toHaveLength(1);
  });
});
describe('remote consent', () => {
  it('sends nothing until the creator confirms, then asks only once per session', async () => {
    const adapter = scriptedAdapter(() => ok(addCardPlan()), false);
    const { controller } = await setup(adapter);
    await controller.submit({ kind: 'stack' });
    expect(adapter.requests).toHaveLength(0);
    expect(controller.getSnapshot().consentPending).toBe(true);
    controller.declineConsent();
    expect(controller.getSnapshot().consentPending).toBe(false);
    expect(adapter.requests).toHaveLength(0);
    await controller.submit({ kind: 'stack' });
    await controller.confirmConsent({ kind: 'stack' });
    expect(adapter.requests).toHaveLength(1);
    controller.reject();
    await controller.submit({ kind: 'stack' });
    expect(controller.getSnapshot().consentPending).toBe(false);
    expect(adapter.requests).toHaveLength(2);
  });
  it('confirmConsent without a pending request does nothing', async () => {
    const adapter = scriptedAdapter(() => ok(addCardPlan()), false);
    const { controller } = await setup(adapter);
    await controller.confirmConsent({ kind: 'stack' });
    expect(adapter.requests).toHaveLength(0);
  });
});
describe('proposal queue', () => {
  it('applies a proposal only after Approve and removes it from the queue', async () => {
    const { controller, session } = await setup(scriptedAdapter(() => ok(addCardPlan())));
    const proposal = enqueueProposal({ plan: addCardPlan('mcp-card', 'From agent'), source: 'mcp' });
    controller.openProposal(proposal);
    expect(controller.getSnapshot().state.phase).toBe('review');
    expect(session.getStack().cardOrder).toHaveLength(1);
    expect(listProposals()).toHaveLength(1);
    await controller.approve();
    expect(session.getStack().cardOrder).toHaveLength(2);
    expect(listProposals()).toHaveLength(0);
  });
  it('rejecting a proposal removes it and changes nothing', async () => {
    const { controller, session } = await setup(scriptedAdapter(() => ok(addCardPlan())));
    controller.openProposal(enqueueProposal({ plan: addCardPlan(), source: 'file' }));
    controller.reject();
    expect(listProposals()).toHaveLength(0);
    expect(session.getStack().cardOrder).toHaveLength(1);
  });
  it('keeps a proposal that no longer fits the Stack in review with Approve blocked', async () => {
    const { controller, session } = await setup(scriptedAdapter(() => ok(addCardPlan())));
    controller.openProposal(enqueueProposal({ plan: brokenPlan(), source: 'mcp' }));
    await controller.approve();
    expect(session.getStack().cardOrder).toHaveLength(1);
    expect(controller.getSnapshot().state.phase).toBe('review');
    expect(listProposals()).toHaveLength(1);
  });
  it('drops a proposal that fails schema validation', async () => {
    const { controller } = await setup(scriptedAdapter(() => ok(addCardPlan())));
    const bad = enqueueProposal({ plan: { nope: 1 } as never, source: 'mcp' });
    controller.openProposal(bad);
    expect(controller.getSnapshot().state).toMatchObject({
      phase: 'idle',
      error: { code: 'INVALID_AI_PLAN' },
    });
    expect(listProposals()).toHaveLength(0);
  });
});
