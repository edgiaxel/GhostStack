import 'fake-indexeddb/auto';
import { buildFixtureBundle } from '@ghoststack/domain/testing';
import type { FactoryDeps } from '@ghoststack/domain';
import { createIndexedDbBackend } from '@ghoststack/storage/indexeddb';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { createRepositoryCheckpointStore, parseCheckpointRecord } from './checkpoints';
import { parseAIPlan } from './plan';
import { CrashSignal, approvePlan, createTransactionManager } from './transaction';

const NOW = '2030-01-01T00:00:00.000Z';
const deps = (): FactoryDeps => {
  let n = 0;
  return {
    clock: () => NOW,
    newId: (prefix) =>
      `${prefix}_00000000-0000-4000-8000-bbbbbb${(n += 1).toString(16).padStart(6, '0')}`,
  };
};
const plan = () => {
  const parsed = parseAIPlan({
    planVersion: 1,
    planId: 'plan-1',
    requestSummary: 'durable',
    commands: [{ command: 'ADD_CARD', title: 'Durable card' }],
  });
  if (!parsed.ok) throw new Error('plan');
  return approvePlan(parsed.plan, () => NOW);
};

/** A fresh "process": new connections and a new manager over the same browser database. */
const boot = (factory: IDBFactory, operationId: string) => {
  const backend = createIndexedDbBackend({ factory });
  return {
    storage: backend.storage,
    manager: createTransactionManager({
      storage: backend.storage,
      checkpoints: createRepositoryCheckpointStore(backend.checkpoints),
      deps: deps(),
      newOperationId: () => operationId,
    }),
  };
};

describe('transactions on IndexedDB', () => {
  it('commits, then rolls back after a reload using the durable checkpoint', async () => {
    const factory = new IDBFactory();
    const original = buildFixtureBundle();
    const first = boot(factory, 'op_1');
    await first.storage.saveProject(original);
    const executed = await first.manager.execute(original.stack.stackId, plan());
    expect(executed.ok).toBe(true);

    const second = boot(factory, 'op_2');
    const rolled = await second.manager.rollback('op_1');
    expect(rolled.ok).toBe(true);
    const loaded = await second.storage.loadProject(original.stack.stackId);
    expect(loaded.ok && loaded.value).toEqual(original);
  });

  it('settles a crash before the commit after a reload and leaves the project unchanged', async () => {
    const factory = new IDBFactory();
    const original = buildFixtureBundle();
    const first = boot(factory, 'op_1');
    await first.storage.saveProject(original);
    await expect(
      first.manager.execute(original.stack.stackId, plan(), {
        beforeStep: (stage) => {
          if (stage === 'commit') throw new CrashSignal(stage);
        },
      }),
    ).rejects.toBeInstanceOf(CrashSignal);

    const second = boot(factory, 'op_2');
    const settled = await second.manager.recover(original.stack.stackId);
    expect(settled.ok && settled.value).toBe(1);
    const loaded = await second.storage.loadProject(original.stack.stackId);
    expect(loaded.ok && loaded.value).toEqual(original);
    const record = await second.manager.checkpoints.get('op_1');
    expect(record.ok && record.value.status).toBe('failed');
  });

  it('settles a crash after the commit as committed and keeps rollback available', async () => {
    const factory = new IDBFactory();
    const original = buildFixtureBundle();
    const first = boot(factory, 'op_1');
    await first.storage.saveProject(original);
    await expect(
      first.manager.execute(original.stack.stackId, plan(), {
        beforeStep: (stage) => {
          if (stage === 'finalize') throw new CrashSignal(stage);
        },
      }),
    ).rejects.toBeInstanceOf(CrashSignal);

    const second = boot(factory, 'op_2');
    expect((await second.manager.recover(original.stack.stackId)).ok).toBe(true);
    expect((await second.manager.rollback('op_1')).ok).toBe(true);
    const loaded = await second.storage.loadProject(original.stack.stackId);
    expect(loaded.ok && loaded.value).toEqual(original);
  });
});

describe('stored checkpoint validation', () => {
  it('rejects damaged records instead of trusting them', () => {
    const bundle = buildFixtureBundle();
    const good = {
      checkpointId: 'op_1',
      stackId: bundle.stack.stackId,
      label: 'x',
      status: 'committed',
      createdAt: NOW,
      bundle,
    };
    expect(parseCheckpointRecord(good)).toBeDefined();
    expect(parseCheckpointRecord({ ...good, status: 'weird' })).toBeUndefined();
    expect(
      parseCheckpointRecord({ ...good, bundle: { ...bundle, stack: { title: 1 } } }),
    ).toBeUndefined();
    expect(
      parseCheckpointRecord({ ...good, bundle: { ...bundle, assets: { a: 'not bytes' } } }),
    ).toBeUndefined();
    expect(parseCheckpointRecord(null)).toBeUndefined();
    expect(parseCheckpointRecord('text')).toBeUndefined();
  });

  it('skips damaged records when listing and reports them on get', async () => {
    const factory = new IDBFactory();
    const backend = createIndexedDbBackend({ factory });
    const store = createRepositoryCheckpointStore(backend.checkpoints);
    await backend.checkpoints.put({
      checkpointId: 'op_bad',
      stackId: 'stk_1',
      createdAt: NOW,
    });
    const got = await store.get('op_bad');
    expect(!got.ok && got.error.code).toBe('CHECKPOINT_FAILED');
    const listed = await store.list('stk_1');
    expect(listed.ok && listed.value).toEqual([]);
  });
});
