import { describe, expect, it } from 'vitest';
import { createDemoProvider } from '@ghoststack/ai-providers';
import { validateStack } from '@ghoststack/domain';
import { exportGsp, importGsp } from '@ghoststack/project-format';
import { buildContext } from './context';
import { parsePlan, serializePlan } from './plan';
import { NOW, baseStack, createMemorySession } from './testing';
import { runTransaction } from './transaction';

const PROMPTS = [
  'Add a quiz question card with three answers and a result card',
  'Add a recipe card with an ingredients list and an add item button',
  'Add an inventory list with items',
];

describe('demo provider plans against a real Stack', () => {
  it.each(PROMPTS)('plans, parses, commits and round-trips: %s', async (prompt) => {
    const session = createMemorySession(baseStack());
    const ctx = buildContext(session.getStack(), { kind: 'stack' });
    if (!ctx.ok) throw new Error(ctx.error.message);
    const generated = await createDemoProvider().generatePlan({ context: ctx.value, prompt });
    if (!generated.ok) throw new Error(generated.error.message);
    const parsed = parsePlan(generated.value);
    if (!parsed.ok) throw new Error(parsed.error.message);
    let n = 0;
    const done = await runTransaction(session, parsed.value, {
      approvedPlan: serializePlan(parsed.value),
      checkpoints: { put: () => Promise.resolve() },
      now: NOW,
      newId: () => `op-${++n}`,
    });
    if (!done.ok) throw new Error(done.error.message);
    expect(done.value.state).toBe('done');
    expect(validateStack(session.getStack()).ok).toBe(true);
    const exported = exportGsp(session.getStack());
    if (!exported.ok) throw new Error(exported.error.message);
    const imported = importGsp(exported.value);
    if (!imported.ok) throw new Error(imported.error.message);
    expect(imported.value.stack).toEqual(session.getStack());
  });
});
