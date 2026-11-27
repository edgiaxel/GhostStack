import { describe, expect, it } from 'vitest';
import { exportGsp, importGsp } from '@ghoststack/project-format';
import { serializePlan } from './plan';
import { NOW, baseStack, createMemorySession, quizPlan, recipePlan } from './testing';
import { runTransaction } from './transaction';

describe('.gsp round trip of an AI-planned Stack', () => {
  it.each([
    ['quiz', quizPlan],
    ['recipe', recipePlan],
  ])('exports and re-imports the committed %s Stack unchanged', async (_name, make) => {
    const session = createMemorySession(baseStack());
    const p = make();
    let n = 0;
    const r = await runTransaction(session, p, {
      approvedPlan: serializePlan(p),
      checkpoints: { put: () => Promise.resolve() },
      now: NOW,
      newId: () => `op-${++n}`,
    });
    if (!r.ok || r.value.state !== 'done') throw new Error('expected done');
    const exported = exportGsp(session.getStack());
    if (!exported.ok) throw new Error(exported.error.message);
    const imported = importGsp(exported.value);
    if (!imported.ok) throw new Error(imported.error.message);
    expect(imported.value.stack).toEqual(session.getStack());
  });
});
