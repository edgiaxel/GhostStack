import { describe, expect, it } from 'vitest';
import type { AbortSignalLike, Checkpoint } from '@ghoststack/shared-contracts';
import { revertOperation, runTransaction } from './transaction';
import type { TransactionOptions, TransactionProgress } from './transaction';
import { serializePlan } from './plan';
import { NOW, baseStack, createMemorySession, plan, quizPlan, recipePlan, step } from './testing';
import { clone } from './util';

const newSignal = (): AbortSignalLike & { aborted: boolean } => ({
  aborted: false,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
});

function harness(overrides: Partial<TransactionOptions> = {}) {
  const puts: Checkpoint[] = [];
  let n = 0;
  const options: TransactionOptions = {
    approvedPlan: serializePlan(quizPlan()),
    checkpoints: {
      put: (c) => {
        puts.push(clone(c));
        return Promise.resolve();
      },
    },
    now: NOW,
    newId: () => `id-${++n}`,
    ...overrides,
  };
  return { options, puts };
}

describe('runTransaction', () => {
  it('commits through one restore, writes a recovery checkpoint and returns a report', async () => {
    const session = createMemorySession(baseStack());
    const base = clone(session.getStack());
    const phases: TransactionProgress[] = [];
    const { options, puts } = harness({ onProgress: (p) => phases.push(p) });
    const r = await runTransaction(session, quizPlan(), options);
    if (!r.ok || r.value.state !== 'done') throw new Error('expected done');
    expect(session.restoreCalls).toBe(1);
    expect(session.dispatchCalls).toBe(0);
    expect(puts).toHaveLength(1);
    expect(puts[0]).toMatchObject({
      kind: 'recovery',
      stackId: 'stack-1',
      label: 'Before AI: Add a quiz question that branches to a result card',
      createdAt: NOW,
    });
    expect(puts[0]?.stack).toEqual(base);
    const report = r.value.report;
    expect(report).toMatchObject({ operationId: 'id-1', checkpointId: 'id-2', stepCount: 7 });
    expect(report.snapshot).toEqual(base);
    expect(session.getStack()).toEqual(report.resultStack);
    expect(Object.keys(session.getStack().cards)).toEqual(['c1', 'question', 'result']);
    expect(phases.map((p) => p.phase)).toEqual([
      'checkpoint',
      ...Array<string>(7).fill('step'),
      'validate',
      'commit',
      'finish',
    ]);
    expect(phases.at(-1)).toMatchObject({ state: 'done', stepIndex: 7, stepCount: 7 });
    expect(phases.filter((p) => p.phase === 'step').map((p) => p.stepIndex)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('is undone by a single undo', async () => {
    const session = createMemorySession(baseStack());
    const base = clone(session.getStack());
    const { options } = harness();
    await runTransaction(session, quizPlan(), options);
    expect(session.undo()).toBe(true);
    expect(session.getStack()).toEqual(base);
    expect(session.undo()).toBe(false);
  });

  describe('approval', () => {
    it('refuses without a marker', async () => {
      const session = createMemorySession(baseStack());
      const { options, puts } = harness({ approvedPlan: '' });
      const r = await runTransaction(session, quizPlan(), options);
      expect(!r.ok && r.error.code).toBe('TRANSACTION_FAILED');
      expect(session.restoreCalls).toBe(0);
      expect(puts).toHaveLength(0);
    });

    it('refuses a plan that differs from the approved one', async () => {
      const session = createMemorySession(baseStack());
      const { options } = harness({ approvedPlan: serializePlan(recipePlan()) });
      const r = await runTransaction(session, quizPlan(), options);
      expect(!r.ok && r.error.code).toBe('TRANSACTION_FAILED');
      expect(session.restoreCalls).toBe(0);
    });

    it('refuses a plan edited after approval', async () => {
      const session = createMemorySession(baseStack());
      const approved = quizPlan();
      const { options } = harness({ approvedPlan: serializePlan(approved) });
      approved.steps[1] = step('q', { type: 'ADD_CARD', cardId: 'evil', title: 'Evil' });
      const r = await runTransaction(session, approved, options);
      expect(r.ok).toBe(false);
      expect(session.getStack()).toEqual(baseStack());
    });
  });

  describe('failures leave the Stack unchanged', () => {
    it('checkpoint write rejects: CHECKPOINT_FAILED, no restore', async () => {
      const session = createMemorySession(baseStack());
      const { options } = harness({
        checkpoints: { put: () => Promise.reject(new Error('disk full: sk-secret')) },
      });
      const r = await runTransaction(session, quizPlan(), options);
      expect(!r.ok && r.error.code).toBe('CHECKPOINT_FAILED');
      expect(JSON.stringify(r)).not.toContain('sk-secret');
      expect(session.restoreCalls).toBe(0);
      expect(session.getStack()).toEqual(baseStack());
    });

    it('checkpoint write throws synchronously', async () => {
      const session = createMemorySession(baseStack());
      const { options } = harness({
        checkpoints: {
          put: () => {
            throw new Error('sync');
          },
        },
      });
      const r = await runTransaction(session, quizPlan(), options);
      expect(!r.ok && r.error.code).toBe('CHECKPOINT_FAILED');
      expect(session.getStack()).toEqual(baseStack());
    });

    it('step N fails: error names the step, no restore', async () => {
      const session = createMemorySession(baseStack());
      const bad = quizPlan();
      bad.steps[4] = step('r-text', { type: 'DELETE_CARD', cardId: 'does-not-exist' });
      const { options } = harness({ approvedPlan: serializePlan(bad) });
      const r = await runTransaction(session, bad, options);
      expect(!r.ok && r.error.code).toBe('INVALID_PATCH_COMMAND');
      expect(!r.ok && 'stepId' in r.error && r.error.stepId).toBe('r-text');
      expect(session.restoreCalls).toBe(0);
      expect(session.getStack()).toEqual(baseStack());
    });

    it('final validation fails', async () => {
      const session = createMemorySession(baseStack());
      const { options } = harness({
        inject: {
          validateStack: () => ({ ok: false, error: { code: 'PROJECT_VALIDATION_FAILED', message: 'nope' } }),
        },
      });
      const r = await runTransaction(session, quizPlan(), options);
      expect(!r.ok && r.error.code).toBe('PROJECT_VALIDATION_FAILED');
      expect(session.restoreCalls).toBe(0);
      expect(session.getStack()).toEqual(baseStack());
    });

    it('restore returns an error: TRANSACTION_FAILED with the session message', async () => {
      const session = createMemorySession(baseStack(), { restoreFails: 'error' });
      const { options } = harness();
      const r = await runTransaction(session, quizPlan(), options);
      expect(!r.ok && r.error.code).toBe('TRANSACTION_FAILED');
      expect(!r.ok && r.error.message).toBe('Could not save the restored project');
      expect(session.restoreCalls).toBe(1);
      expect(session.getStack()).toEqual(baseStack());
    });

    it('restore throws: caught, not rethrown', async () => {
      const session = createMemorySession(baseStack(), { restoreFails: 'throw' });
      const { options } = harness();
      const r = await runTransaction(session, quizPlan(), options);
      expect(!r.ok && r.error.code).toBe('TRANSACTION_FAILED');
      expect(session.getStack()).toEqual(baseStack());
    });

    it('a concurrent edit during the checkpoint write is detected and nothing is applied', async () => {
      const session = createMemorySession(baseStack());
      const { options } = harness({
        checkpoints: {
          put: () => {
            const edited = clone(session.getStack());
            edited.title = 'Edited meanwhile';
            session.forceStack(edited);
            return Promise.resolve();
          },
        },
      });
      const r = await runTransaction(session, quizPlan(), options);
      expect(!r.ok && r.error.code).toBe('TRANSACTION_FAILED');
      expect(!r.ok && r.error.message).toContain('changed during the operation');
      expect(session.restoreCalls).toBe(0);
      expect(session.getStack().title).toBe('Edited meanwhile');
    });

    it('a throwing id generator is reported, not thrown', async () => {
      const session = createMemorySession(baseStack());
      const { options } = harness({
        newId: () => {
          throw new Error('no ids');
        },
      });
      const r = await runTransaction(session, quizPlan(), options);
      expect(!r.ok && r.error.code).toBe('TRANSACTION_FAILED');
    });

    it('does not retry the commit', async () => {
      const session = createMemorySession(baseStack(), { restoreFails: 'error' });
      const { options } = harness();
      await runTransaction(session, quizPlan(), options);
      expect(session.restoreCalls).toBe(1);
    });
  });

  describe('cancellation', () => {
    it('before start', async () => {
      const session = createMemorySession(baseStack());
      const signal = newSignal();
      signal.aborted = true;
      const { options, puts } = harness({ signal });
      const r = await runTransaction(session, quizPlan(), options);
      expect(r.ok && r.value.state).toBe('cancelled');
      expect(puts).toHaveLength(0);
      expect(session.restoreCalls).toBe(0);
    });

    it('between steps of the dry run', async () => {
      const session = createMemorySession(baseStack());
      const signal = newSignal();
      const { options } = harness({
        signal,
        onProgress: (p) => {
          if (p.phase === 'step' && p.stepIndex === 3) signal.aborted = true;
        },
      });
      const r = await runTransaction(session, quizPlan(), options);
      expect(r.ok && r.value.state).toBe('cancelled');
      expect(session.restoreCalls).toBe(0);
      expect(session.getStack()).toEqual(baseStack());
    });

    it('after validation, before the commit', async () => {
      const session = createMemorySession(baseStack());
      const signal = newSignal();
      const { options } = harness({
        signal,
        onProgress: (p) => {
          if (p.phase === 'validate') signal.aborted = true;
        },
      });
      const r = await runTransaction(session, quizPlan(), options);
      expect(r.ok && r.value.state).toBe('cancelled');
      expect(session.restoreCalls).toBe(0);
      expect(session.getStack()).toEqual(baseStack());
    });

    it('after the commit the operation counts as done', async () => {
      const session = createMemorySession(baseStack());
      const signal = newSignal();
      const { options } = harness({
        signal,
      });
      const original = session.restore;
      session.restore = (s) => {
        const r = original(s);
        signal.aborted = true;
        return r;
      };
      const r = await runTransaction(session, quizPlan(), options);
      expect(r.ok && r.value.state).toBe('done');
      expect(session.restoreCalls).toBe(1);
    });
  });
});

describe('revertOperation', () => {
  async function committed() {
    const session = createMemorySession(baseStack());
    const base = clone(session.getStack());
    const { options } = harness();
    const r = await runTransaction(session, quizPlan(), options);
    if (!r.ok || r.value.state !== 'done') throw new Error('expected done');
    return { session, base, report: r.value.report };
  }

  it('restores the Stack from before the operation as one undo step', async () => {
    const { session, base, report } = await committed();
    const r = revertOperation(session, report);
    expect(r.ok).toBe(true);
    expect(session.getStack()).toEqual(base);
    expect(session.restoreCalls).toBe(2);
    expect(session.undo()).toBe(true);
    expect(session.getStack()).toEqual(report.resultStack);
  });

  it('refuses when the Stack was edited afterwards and leaves it unchanged', async () => {
    const { session, report } = await committed();
    const edit = session.dispatch({ type: 'RENAME_CARD', cardId: 'c1', title: 'Edited later' });
    expect(edit.ok).toBe(true);
    const after = clone(session.getStack());
    const r = revertOperation(session, report);
    expect(!r.ok && r.error.code).toBe('TRANSACTION_FAILED');
    expect(session.getStack()).toEqual(after);
  });

  it('refuses an operation from another Stack', async () => {
    const { report } = await committed();
    const other = baseStack();
    other.stackId = 'stack-2';
    const session = createMemorySession(other);
    const calls = session.restoreCalls;
    const r = revertOperation(session, report);
    expect(!r.ok && r.error.code).toBe('TRANSACTION_FAILED');
    expect(session.restoreCalls).toBe(calls);
  });

  it('reports a failing restore without throwing', async () => {
    const { report } = await committed();
    const session = createMemorySession(report.resultStack, { restoreFails: 'throw' });
    const r = revertOperation(session, report);
    expect(!r.ok && r.error.code).toBe('TRANSACTION_FAILED');
    expect(session.getStack()).toEqual(report.resultStack);
  });

  it('works for a plan that only reorders and renames', async () => {
    const session = createMemorySession(baseStack());
    const p = plan(
      [step('r', { type: 'RENAME_CARD', cardId: 'c1', title: 'Home' })],
      'Rename the first card',
    );
    const { options } = harness({ approvedPlan: serializePlan(p) });
    const r = await runTransaction(session, p, options);
    if (!r.ok || r.value.state !== 'done') throw new Error('expected done');
    expect(session.getStack().cards['c1']?.title).toBe('Home');
    revertOperation(session, r.value.report);
    expect(session.getStack()).toEqual(baseStack());
  });
});
