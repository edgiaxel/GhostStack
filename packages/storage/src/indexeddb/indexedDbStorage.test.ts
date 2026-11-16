import 'fake-indexeddb/auto';
import { buildFixtureBundle } from '@ghoststack/domain/testing';
import type { Result } from '@ghoststack/domain';
import { IDBFactory } from 'fake-indexeddb';
import { wrap } from 'idb';
import type { IDBPDatabase } from 'idb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StorageError } from '../port';
import { createIndexedDbStorage } from './indexedDbStorage';
import type { FaultStage } from './indexedDbStorage';
import { DB_NAME, DB_VERSION, mapIdbError } from './mapIdbError';

const PICTURE = 'ast_00000000-0000-4000-8000-000000000001';
const EMPTY = 'ast_00000000-0000-4000-8000-000000000002';
const EMPTY_CARD = 'crd_00000000-0000-4000-8000-000000000003';

function unwrap<T>(result: Result<T, StorageError>): T {
  if (!result.ok) throw new Error(`expected ok, got ${result.error.code}`);
  return result.value;
}

function errorOf<T>(result: Result<T, StorageError>): StorageError {
  if (result.ok) throw new Error('expected an error');
  return result.error;
}

async function openRaw(factory: IDBFactory, version?: number): Promise<IDBPDatabase> {
  const request = factory.open(DB_NAME, version);
  request.addEventListener('upgradeneeded', () => {
    const db = request.result;
    if (db.objectStoreNames.length === 0) {
      db.createObjectStore('stacks', { keyPath: 'stackId' });
      db.createObjectStore('assets', { keyPath: ['stackId', 'assetId'] });
    }
  });
  return (await wrap(request)) as IDBPDatabase;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createIndexedDbStorage', () => {
  it('creates both stores at version 1 on a fresh open and stores only the stack JSON', async () => {
    const factory = new IDBFactory();
    const bundle = buildFixtureBundle();
    unwrap(await createIndexedDbStorage({ factory }).saveProject(bundle));
    const db = await openRaw(factory);
    expect(db.version).toBe(DB_VERSION);
    expect([...db.objectStoreNames].sort()).toEqual(['assets', 'stacks']);
    expect(await db.getAll('stacks')).toEqual([bundle.stack]);
    expect((await db.getAll('assets')).map((r) => Object.keys(r as object).sort())).toEqual([
      ['assetId', 'bytes', 'stackId'],
      ['assetId', 'bytes', 'stackId'],
    ]);
    db.close();
  });

  it('reads saved data through a new adapter on the same factory, as after a reload', async () => {
    const factory = new IDBFactory();
    const bundle = buildFixtureBundle();
    unwrap(await createIndexedDbStorage({ factory }).saveProject(bundle));
    const reloaded = unwrap(
      await createIndexedDbStorage({ factory }).loadProject(bundle.stack.stackId),
    );
    expect(reloaded.stack).toEqual(bundle.stack);
    expect(reloaded.assets[PICTURE]).toEqual(bundle.assets[PICTURE]);
  });

  describe('unsupported-version', () => {
    it('returns unsupported-version for a newer database and leaves it at version 99 unchanged', async () => {
      const factory = new IDBFactory();
      const seeded = await openRaw(factory, 99);
      await seeded.put('stacks', { stackId: 'stk_keep', title: 'Keep' });
      seeded.close();
      const port = createIndexedDbStorage({ factory });
      const bundle = buildFixtureBundle();

      const results: Result<unknown, StorageError>[] = [
        await port.saveProject(bundle),
        await port.loadProject(bundle.stack.stackId),
        await port.listProjects(),
        await port.deleteProject(bundle.stack.stackId),
        await port.saveAsset(bundle.stack.stackId, PICTURE, Uint8Array.of(1)),
        await port.loadAsset(bundle.stack.stackId, PICTURE),
        await port.deleteAsset(bundle.stack.stackId, PICTURE),
      ];
      for (const result of results) {
        expect(errorOf(result)).toMatchObject({
          code: 'unsupported-version',
          supportedVersion: DB_VERSION,
        });
      }

      const after = await openRaw(factory);
      expect(after.version).toBe(99);
      expect(await after.getAll('stacks')).toEqual([{ stackId: 'stk_keep', title: 'Keep' }]);
      expect(await after.getAll('assets')).toEqual([]);
      after.close();
    });
  });

  describe('storage-unavailable', () => {
    it('is returned when no IndexedDB exists', async () => {
      vi.stubGlobal('indexedDB', undefined);
      const port = createIndexedDbStorage();
      expect(errorOf(await port.listProjects()).code).toBe('storage-unavailable');
      expect(errorOf(await port.saveProject(buildFixtureBundle())).code).toBe(
        'storage-unavailable',
      );
    });

    it('retries the open on the next call after a failed open', async () => {
      const real = new IDBFactory();
      let attempts = 0;
      const flaky = {
        open(...args: Parameters<IDBFactory['open']>) {
          attempts += 1;
          if (attempts === 1) throw new DOMException('Denied.', 'SecurityError');
          return real.open(...args);
        },
      } as unknown as IDBFactory;
      const port = createIndexedDbStorage({ factory: flaky });
      expect(errorOf(await port.listProjects()).code).toBe('storage-unavailable');
      expect(unwrap(await port.listProjects())).toEqual({ summaries: [], unreadable: [] });
      expect(attempts).toBe(2);
    });
  });

  describe('unreadable records (T-025)', () => {
    async function seedDamaged() {
      const factory = new IDBFactory();
      const port = createIndexedDbStorage({ factory });
      const bundle = buildFixtureBundle();
      unwrap(await port.saveProject(bundle));
      const db = await openRaw(factory);
      const damagedStack = { stackId: 'stk_damaged', title: 42 };
      const noStructure = { stackId: 'stk_no_title' };
      await db.put('stacks', damagedStack);
      await db.put('stacks', noStructure);
      return { factory, port, bundle, db, damagedStack, noStructure };
    }

    it('lists damaged records in unreadable and keeps the readable projects', async () => {
      const { port, bundle, db } = await seedDamaged();
      const listing = unwrap(await port.listProjects());
      expect(listing.summaries.map((s) => s.stackId)).toEqual([bundle.stack.stackId]);
      expect(listing.unreadable.map((u) => u.stackId).sort()).toEqual([
        'stk_damaged',
        'stk_no_title',
      ]);
      db.close();
    });

    it('returns validation-failed for a corrupt stack and does not modify it', async () => {
      const { port, db, damagedStack } = await seedDamaged();
      const error = errorOf(await port.loadProject('stk_damaged'));
      expect(error.code).toBe('validation-failed');
      expect(error.validationErrors?.length).toBeGreaterThan(0);
      expect(await db.get('stacks', 'stk_damaged')).toEqual(damagedStack);
      db.close();
    });

    it('returns validation-failed for damaged asset bytes and does not modify them', async () => {
      const { port, bundle, db } = await seedDamaged();
      const damaged = { stackId: bundle.stack.stackId, assetId: PICTURE, bytes: 'not bytes' };
      await db.put('assets', damaged);
      expect(errorOf(await port.loadProject(bundle.stack.stackId))).toMatchObject({
        code: 'validation-failed',
        assetId: PICTURE,
      });
      expect(errorOf(await port.loadAsset(bundle.stack.stackId, PICTURE)).code).toBe(
        'validation-failed',
      );
      expect(await db.get('assets', [bundle.stack.stackId, PICTURE])).toEqual(damaged);
      db.close();
    });
  });

  describe('fault during save', () => {
    it.each<FaultStage>(['after-stack-put', 'after-asset-put'])(
      'a fault %s aborts the whole transaction',
      async (stage) => {
        const factory = new IDBFactory();
        let armed = false;
        const port = createIndexedDbStorage({
          factory,
          faultInjection: (current) => {
            if (armed && current === stage) throw new Error('Injected.');
          },
        });
        const bundle = buildFixtureBundle();
        unwrap(await port.saveProject(bundle));

        const keptAssets = Object.fromEntries(
          Object.entries(bundle.assets).filter(([id]) => id !== EMPTY),
        );
        const changed = {
          stack: {
            ...bundle.stack,
            title: 'Changed',
            assetRegistry: Object.fromEntries(
              Object.entries(bundle.stack.assetRegistry).filter(([id]) => id !== EMPTY),
            ),
            cards: {
              ...bundle.stack.cards,
              [EMPTY_CARD]: { cardId: EMPTY_CARD, title: 'Empty file', elements: [] },
            },
          },
          assets: keptAssets,
        };
        armed = true;
        expect(errorOf(await port.saveProject(changed)).code).toBe('write-failed');
        armed = false;

        const loaded = unwrap(await port.loadProject(bundle.stack.stackId));
        expect(loaded.stack).toEqual(bundle.stack);
        expect(loaded.assets).toEqual(bundle.assets);
      },
    );
  });
});

describe('mapIdbError', () => {
  const quota = new DOMException('Full.', 'QuotaExceededError');
  const abortedByQuota = new DOMException('Aborted.', 'AbortError');
  Object.defineProperty(abortedByQuota, 'cause', { value: quota });

  it.each([
    ['QuotaExceededError on write', quota, 'write', 'quota-exceeded'],
    ['QuotaExceededError on open', quota, 'open', 'quota-exceeded'],
    ['AbortError caused by quota', abortedByQuota, 'write', 'quota-exceeded'],
    ['VersionError on open', new DOMException('v', 'VersionError'), 'open', 'unsupported-version'],
    [
      'SecurityError on open',
      new DOMException('s', 'SecurityError'),
      'open',
      'storage-unavailable',
    ],
    [
      'InvalidStateError on open',
      new DOMException('i', 'InvalidStateError'),
      'open',
      'storage-unavailable',
    ],
    ['UnknownError on open', new DOMException('u', 'UnknownError'), 'open', 'storage-unavailable'],
    ['Error on open', new Error('x'), 'open', 'storage-unavailable'],
    ['NotFoundError on write', new DOMException('n', 'NotFoundError'), 'write', 'write-failed'],
    ['Error on write', new Error('x'), 'write', 'write-failed'],
    ['non-error value on write', 'boom', 'write', 'write-failed'],
    ['null on write', null, 'write', 'write-failed'],
    ['Error on read', new Error('x'), 'read', 'storage-unavailable'],
  ] as const)('%s', (_name, error, phase, code) => {
    expect(mapIdbError(error, { phase, stackId: 'stk_1' })).toMatchObject({
      code,
      stackId: 'stk_1',
    });
  });

  it('reports the supported version and the stored version when the message has it', () => {
    const error = new DOMException(
      'The requested version (1) is less than the existing version (99).',
      'VersionError',
    );
    expect(mapIdbError(error, { phase: 'open' })).toMatchObject({
      code: 'unsupported-version',
      supportedVersion: DB_VERSION,
      storedVersion: 99,
    });
  });

  it('omits the stored version when the message has none', () => {
    const mapped = mapIdbError(new DOMException('No details.', 'VersionError'), { phase: 'open' });
    expect(mapped.storedVersion).toBeUndefined();
  });
});
