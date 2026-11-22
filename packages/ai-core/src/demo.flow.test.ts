import { buildFixtureBundle } from '@ghoststack/domain/testing';
import type { FactoryDeps } from '@ghoststack/domain';
import { createMemoryStorage } from '@ghoststack/storage';
import { describe, expect, it } from 'vitest';
import { createMemoryCheckpointStore } from './checkpoints';
import { createDemoAdapter } from './demo';
import { buildProjectContext, requestPlan } from './provider';
import { reviewPlan } from './review';
import { approvePlan, createTransactionManager } from './transaction';

const NOW = '2030-01-01T00:00:00.000Z';
const deps = (): FactoryDeps => {
  let n = 0;
  return {
    clock: () => NOW,
    newId: (prefix) =>
      `${prefix}_00000000-0000-4000-8000-cccccc${(n += 1).toString(16).padStart(6, '0')}`,
  };
};

/** Offline flow: request, review, approve, execute, report, roll back. No network is touched. */
describe('offline plan flow (demo adapter)', () => {
  it('runs end to end and restores the original project on rollback', async () => {
    const lines: string[] = [];
    const log = (line: string) => lines.push(line);

    const storage = createMemoryStorage();
    const original = buildFixtureBundle();
    await storage.saveProject(original);
    const manager = createTransactionManager({
      storage,
      checkpoints: createMemoryCheckpointStore(),
      deps: deps(),
      newOperationId: () => 'op_demo',
    });

    const context = buildProjectContext(original.stack);
    const planned = await requestPlan(createDemoAdapter(), context, 'add a question', {
      allowRemote: false,
    });
    if (!planned.ok) throw new Error('plan');
    log(`plan: ${planned.value.requestSummary}`);

    const review = reviewPlan(planned.value);
    log(`review: ${review.commandCount} commands, ${review.newCardCount} new card(s)`);
    log(`review: counts ${JSON.stringify(review.countsByCommand)}`);
    expect(review.unsupportedCommands).toEqual([]);

    const executed = await manager.execute(
      original.stack.stackId,
      approvePlan(planned.value, () => NOW),
    );
    if (!executed.ok) throw new Error('execute');
    for (const command of executed.value.commands) {
      log(`report: #${command.index} ${command.command} - ${command.summary}`);
    }
    const after = await storage.loadProject(original.stack.stackId);
    if (!after.ok) throw new Error('load');
    log(
      `result: ${after.value.stack.cardOrder.length} cards (was ${original.stack.cardOrder.length})`,
    );
    expect(after.value.stack.cardOrder).toHaveLength(original.stack.cardOrder.length + 1);
    expect(after.value.stack.stateSchema['score']).toBeDefined();

    expect((await manager.rollback(executed.value.operationId)).ok).toBe(true);
    const restored = await storage.loadProject(original.stack.stackId);
    expect(restored.ok && restored.value).toEqual(original);
    log('rollback: restored the original project');

    console.info(['--- offline demo flow ---', ...lines].join('\n'));
  });
});
