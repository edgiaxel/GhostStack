import 'fake-indexeddb/auto';
import { buildFixtureBundle } from '@ghoststack/domain/testing';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { createIndexedDbBackend } from './indexedDbStorage';
import { DB_NAME, DB_VERSION } from './mapIdbError';

const row = (id: string, stackId: string, extra: Record<string, unknown> = {}) => ({
  checkpointId: id,
  stackId,
  createdAt: '2030-01-01T00:00:00.000Z',
  ...extra,
});

/** Opens the database at version 1 with the M1 schema and seeds one project, as M1 left it. */
async function seedVersion1(factory: IDBFactory): Promise<ReturnType<typeof buildFixtureBundle>> {
  const bundle = buildFixtureBundle();
  const request = factory.open(DB_NAME, 1);
  request.addEventListener('upgradeneeded', () => {
    const db = request.result;
    db.createObjectStore('stacks', { keyPath: 'stackId' });
    db.createObjectStore('assets', { keyPath: ['stackId', 'assetId'] });
  });
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () => reject(new Error('open failed')));
  });
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['stacks', 'assets'], 'readwrite');
    tx.objectStore('stacks').put(bundle.stack);
    for (const [assetId, bytes] of Object.entries(bundle.assets)) {
      tx.objectStore('assets').put({ stackId: bundle.stack.stackId, assetId, bytes });
    }
    tx.addEventListener('complete', () => resolve());
    tx.addEventListener('error', () => reject(new Error('seed failed')));
  });
  db.close();
  return bundle;
}

describe('IndexedDB checkpoint repository', () => {
  it('stores, replaces, reads and lists records by stack', async () => {
    const { checkpoints } = createIndexedDbBackend({ factory: new IDBFactory() });
    expect((await checkpoints.put(row('op_1', 'stk_a', { status: 'pending' }))).ok).toBe(true);
    expect((await checkpoints.put(row('op_2', 'stk_a'))).ok).toBe(true);
    expect((await checkpoints.put(row('op_3', 'stk_b'))).ok).toBe(true);
    expect((await checkpoints.put(row('op_1', 'stk_a', { status: 'committed' }))).ok).toBe(true);

    const one = await checkpoints.get('op_1');
    expect(one.ok && one.value).toMatchObject({ status: 'committed' });
    const listed = await checkpoints.list('stk_a');
    expect(listed.ok && listed.value).toHaveLength(2);
  });

  it('reports a missing checkpoint as not-found', async () => {
    const { checkpoints } = createIndexedDbBackend({ factory: new IDBFactory() });
    const result = await checkpoints.get('op_missing');
    expect(!result.ok && result.error.code).toBe('not-found');
  });

  it('keeps bytes intact through a reload', async () => {
    const factory = new IDBFactory();
    const bundle = buildFixtureBundle();
    const first = createIndexedDbBackend({ factory });
    await first.checkpoints.put(row('op_1', bundle.stack.stackId, { bundle }));
    const second = createIndexedDbBackend({ factory });
    const loaded = await second.checkpoints.get('op_1');
    expect(loaded.ok && (loaded.value as { bundle: unknown }).bundle).toEqual(bundle);
  });

  it('deletes a project together with its checkpoints and leaves other projects alone', async () => {
    const { storage, checkpoints } = createIndexedDbBackend({ factory: new IDBFactory() });
    const bundle = buildFixtureBundle();
    await storage.saveProject(bundle);
    await checkpoints.put(row('op_1', bundle.stack.stackId));
    await checkpoints.put(row('op_2', 'stk_other'));
    expect((await storage.deleteProject(bundle.stack.stackId)).ok).toBe(true);
    const gone = await checkpoints.list(bundle.stack.stackId);
    expect(gone.ok && gone.value).toEqual([]);
    const kept = await checkpoints.list('stk_other');
    expect(kept.ok && kept.value).toHaveLength(1);
  });
});

describe('database upgrade from version 1', () => {
  it('keeps existing projects and assets readable and adds the checkpoints store', async () => {
    const factory = new IDBFactory();
    const bundle = await seedVersion1(factory);

    const { storage, checkpoints } = createIndexedDbBackend({ factory });
    const loaded = await storage.loadProject(bundle.stack.stackId);
    expect(loaded.ok && loaded.value).toEqual(bundle);
    expect((await checkpoints.put(row('op_1', bundle.stack.stackId))).ok).toBe(true);

    const probe = factory.open(DB_NAME);
    const db = await new Promise<IDBDatabase>((resolve) =>
      probe.addEventListener('success', () => resolve(probe.result)),
    );
    expect(db.version).toBe(DB_VERSION);
    expect([...db.objectStoreNames].sort()).toEqual(['assets', 'checkpoints', 'stacks']);
    db.close();
  });

  it('still refuses to open a database written by a newer version', async () => {
    const factory = new IDBFactory();
    const request = factory.open(DB_NAME, DB_VERSION + 1);
    await new Promise<void>((resolve) =>
      request.addEventListener('success', () => {
        request.result.close();
        resolve();
      }),
    );
    const { storage } = createIndexedDbBackend({ factory });
    const result = await storage.listProjects();
    expect(!result.ok && result.error.code).toBe('unsupported-version');
  });
});
