import { buildFixtureBundle } from '@ghoststack/domain/testing';
import type { FactoryDeps, ProjectBundle } from '@ghoststack/domain';
import { createFaultController, createMemoryStorage } from '@ghoststack/storage';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createMemoryCheckpointStore } from './checkpoints';
import { parseAIPlan } from './plan';
import { CrashSignal, approvePlan, createTransactionManager } from './transaction';
import type { TransactionStage } from './transaction';

const NOW = '2030-01-01T00:00:00.000Z';

const counterDeps = (): FactoryDeps => {
  let n = 0;
  return {
    clock: () => NOW,
    newId: (prefix) =>
      `${prefix}_00000000-0000-4000-8000-aaaaaa${(n += 1).toString(16).padStart(6, '0')}`,
  };
};

const textElement = {
  type: 'text',
  name: 'Heading',
  layout: { x: 0, y: 0, width: 200, height: 40 },
  properties: { text: 'Hello' },
};

const parsePlan = (commands: unknown[], planId = 'plan-1') => {
  const parsed = parseAIPlan({ planVersion: 1, planId, requestSummary: 'test', commands });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
  return approvePlan(parsed.plan, () => NOW);
};

const threeCommands = () =>
  parsePlan([
    { command: 'ADD_CARD', ref: 'a', title: 'A' },
    { command: 'ADD_ELEMENT', cardId: 'a', element: textElement },
    { command: 'UPDATE_STATE_SCHEMA', set: { score: { type: 'number', initial: 0 } } },
  ]);

async function setup() {
  const faults = createFaultController();
  const storage = createMemoryStorage({ faults });
  const original = buildFixtureBundle();
  const saved = await storage.saveProject(original);
  if (!saved.ok) throw new Error('fixture save');
  const checkpoints = createMemoryCheckpointStore();
  let op = 0;
  const manager = createTransactionManager({
    storage,
    checkpoints,
    deps: counterDeps(),
    newOperationId: () => `op_${(op += 1)}`,
  });
  const stackId = original.stack.stackId;
  const stored = async (): Promise<ProjectBundle> => {
    const loaded = await storage.loadProject(stackId);
    if (!loaded.ok) throw new Error('load');
    return loaded.value;
  };
  return { faults, storage, original, checkpoints, manager, stackId, stored, op: () => op };
}

describe('execute', () => {
  it('commits a valid plan and preserves asset bytes', async () => {
    const { manager, stackId, stored, original, checkpoints } = await setup();
    const result = await manager.execute(stackId, threeCommands());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.commands.map((c) => c.command)).toEqual([
      'ADD_CARD',
      'ADD_ELEMENT',
      'UPDATE_STATE_SCHEMA',
    ]);
    const after = await stored();
    expect(after.stack.cardOrder).toHaveLength(original.stack.cardOrder.length + 1);
    expect(after.assets).toEqual(original.assets);
    const record = await checkpoints.get(result.value.operationId);
    expect(record.ok && record.value.status).toBe('committed');
  });

  it.each<TransactionStage>(['load', 'checkpoint', 'apply', 'validate', 'commit'])(
    'leaves the stored project unchanged when the %s step fails',
    async (stage) => {
      const { manager, stackId, stored, original } = await setup();
      const result = await manager.execute(stackId, threeCommands(), {
        beforeStep: (s) => {
          if (s === stage) throw new Error('injected');
        },
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.stage).toBe(stage);
      expect(await stored()).toEqual(original);
    },
  );

  it('leaves the project unchanged when a failure hits between commands', async () => {
    const { manager, stackId, stored, original } = await setup();
    const result = await manager.execute(stackId, threeCommands(), {
      beforeCommand: (index) => {
        if (index === 2) throw new Error('injected');
      },
    });
    expect(result.ok).toBe(false);
    expect(await stored()).toEqual(original);
  });

  it('leaves the project unchanged when the storage write fails', async () => {
    const { manager, stackId, stored, original, faults } = await setup();
    faults.failNextWrite('write-failed');
    const result = await manager.execute(stackId, threeCommands());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.stage).toBe('commit');
    expect(await stored()).toEqual(original);
  });

  it('does not touch the project when the checkpoint cannot be saved', async () => {
    const { manager, stackId, stored, original, checkpoints } = await setup();
    checkpoints.failNextPut();
    const result = await manager.execute(stackId, threeCommands());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CHECKPOINT_FAILED');
    expect(await stored()).toEqual(original);
  });

  it('rejects a result that fails validation and keeps the original', async () => {
    const { manager, stackId, stored, original, checkpoints } = await setup();
    const plan = parsePlan([
      {
        command: 'ADD_ELEMENT',
        cardId: original.stack.entryCardId,
        element: {
          type: 'image',
          name: 'Pic',
          layout: { x: 0, y: 0, width: 10, height: 10 },
          properties: { assetId: 'ast_00000000-0000-4000-8000-ffffffffffff', alt: '' },
        },
      },
    ]);
    const result = await manager.execute(stackId, plan);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('PROJECT_VALIDATION_FAILED');
      expect(result.error.validationErrorCount).toBeGreaterThan(0);
    }
    expect(await stored()).toEqual(original);
    const record = await checkpoints.get('op_1');
    expect(record.ok && record.value.status).toBe('failed');
  });

  it('reports an unknown stack without creating a checkpoint', async () => {
    const { manager, checkpoints } = await setup();
    const result = await manager.execute('stk_missing', threeCommands());
    expect(result.ok).toBe(false);
    const listed = await checkpoints.list('stk_missing');
    expect(listed.ok && listed.value).toEqual([]);
  });
});

describe('rollback', () => {
  it('restores the exact pre-operation project and assets', async () => {
    const { manager, stackId, stored, original } = await setup();
    const executed = await manager.execute(stackId, threeCommands());
    if (!executed.ok) throw new Error('execute');
    expect(await stored()).not.toEqual(original);
    const rolled = await manager.rollback(executed.value.operationId);
    expect(rolled.ok).toBe(true);
    expect(await stored()).toEqual(original);
  });

  it('refuses a second rollback', async () => {
    const { manager, stackId } = await setup();
    const executed = await manager.execute(stackId, threeCommands());
    if (!executed.ok) throw new Error('execute');
    expect((await manager.rollback(executed.value.operationId)).ok).toBe(true);
    const again = await manager.rollback(executed.value.operationId);
    expect(again.ok).toBe(false);
  });

  it('refuses to discard edits made after the operation', async () => {
    const { manager, stackId, storage, stored } = await setup();
    const executed = await manager.execute(stackId, threeCommands());
    if (!executed.ok) throw new Error('execute');
    const current = await stored();
    const edited = {
      stack: { ...current.stack, title: 'Edited later', updatedAt: '2031-01-01T00:00:00.000Z' },
      assets: current.assets,
    };
    expect((await storage.saveProject(edited)).ok).toBe(true);
    const rolled = await manager.rollback(executed.value.operationId);
    expect(rolled.ok).toBe(false);
    if (!rolled.ok) expect(rolled.error.code).toBe('ROLLBACK_CONFLICT');
    expect((await stored()).stack.title).toBe('Edited later');
  });

  it('rejects rollback of an unknown or failed operation', async () => {
    const { manager } = await setup();
    expect((await manager.rollback('op_unknown')).ok).toBe(false);
  });
});

describe('crash recovery', () => {
  it('settles an operation that crashed before the commit as failed', async () => {
    const { manager, stackId, stored, original, checkpoints } = await setup();
    await expect(
      manager.execute(stackId, threeCommands(), {
        beforeStep: (s) => {
          if (s === 'commit') throw new CrashSignal(s);
        },
      }),
    ).rejects.toBeInstanceOf(CrashSignal);
    expect(await stored()).toEqual(original);
    const settled = await manager.recover(stackId);
    expect(settled.ok && settled.value).toBe(1);
    const record = await checkpoints.get('op_1');
    expect(record.ok && record.value.status).toBe('failed');
  });

  it('settles an operation that crashed after the commit as committed and rollback still works', async () => {
    const { manager, stackId, stored, original, checkpoints } = await setup();
    await expect(
      manager.execute(stackId, threeCommands(), {
        beforeStep: (s) => {
          if (s === 'finalize') throw new CrashSignal(s);
        },
      }),
    ).rejects.toBeInstanceOf(CrashSignal);
    expect(await stored()).not.toEqual(original);
    const settled = await manager.recover(stackId);
    expect(settled.ok && settled.value).toBe(1);
    const record = await checkpoints.get('op_1');
    expect(record.ok && record.value.status).toBe('committed');
    expect((await manager.rollback('op_1')).ok).toBe(true);
    expect(await stored()).toEqual(original);
  });
});

describe('manual checkpoints', () => {
  it('stores a snapshot of the current project', async () => {
    const { manager, stackId, original } = await setup();
    const made = await manager.createManualCheckpoint(stackId, 'before experiment');
    expect(made.ok && made.value.status).toBe('manual');
    expect(made.ok && made.value.bundle).toEqual(original);
  });
});

describe('invariants', () => {
  it('any single injected failure leaves the stored project unchanged', async () => {
    const stages: TransactionStage[] = ['load', 'checkpoint', 'apply', 'validate', 'commit'];
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constantFrom(...stages).map((stage) => ({ stage, command: -1 })),
          fc.integer({ min: 0, max: 2 }).map((command) => ({ stage: 'apply' as const, command })),
        ),
        async (fault) => {
          const { manager, stackId, stored, original } = await setup();
          const result = await manager.execute(stackId, threeCommands(), {
            beforeStep: (s) => {
              if (fault.command < 0 && s === fault.stage) throw new Error('injected');
            },
            beforeCommand: (index) => {
              if (index === fault.command) throw new Error('injected');
            },
          });
          expect(result.ok).toBe(false);
          expect(await stored()).toEqual(original);
        },
      ),
      { numRuns: 60 },
    );
  });

  it('restoring after a valid batch equals the original', async () => {
    const title = fc
      .string({ minLength: 1, maxLength: 30 })
      .filter((value) => value.trim().length > 0);
    await fc.assert(
      fc.asyncProperty(fc.array(title, { minLength: 1, maxLength: 5 }), async (titles) => {
        const { manager, stackId, stored, original } = await setup();
        const plan = parsePlan(titles.map((t) => ({ command: 'ADD_CARD', title: t })));
        const executed = await manager.execute(stackId, plan);
        if (!executed.ok) throw new Error('execute');
        expect((await manager.rollback(executed.value.operationId)).ok).toBe(true);
        expect(await stored()).toEqual(original);
      }),
      { numRuns: 40 },
    );
  });
});
