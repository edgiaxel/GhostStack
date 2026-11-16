import { err, isValid, ok, validateProject } from '@ghoststack/domain';
import type { ProjectBundle, Result, Stack } from '@ghoststack/domain';
import { wrap } from 'idb';
import type { DBSchema, IDBPDatabase, IDBPTransaction, StoreNames } from 'idb';
import { checkBundle } from '../port';
import type { ProjectListing, StorageError, StoragePort } from '../port';
import { DB_NAME, DB_VERSION, mapIdbError } from './mapIdbError';
import type { IdbErrorContext } from './mapIdbError';

/** Points inside a write at which tests can make the transaction fail. */
export type FaultStage =
  'after-stack-put' | 'after-asset-put' | 'after-project-delete' | 'after-asset-delete';

export interface IndexedDbStorageOptions {
  /**
   * Defaults to `globalThis.indexedDB`. Tests inject a `fake-indexeddb` factory.
   * `idb` and the key-range queries still use the global `IDB*` classes.
   */
  readonly factory?: IDBFactory;
  readonly databaseName?: string;
  /** Tests only. A throw aborts the transaction and is mapped like any other write failure. */
  readonly faultInjection?: (stage: FaultStage) => void;
}

interface GhostStackDb extends DBSchema {
  stacks: { key: string; value: unknown };
  assets: { key: [string, string]; value: unknown };
}

type Db = IDBPDatabase<GhostStackDb>;
type Mode = 'readonly' | 'readwrite';
type Tx<M extends Mode> = IDBPTransaction<GhostStackDb, StoreNames<GhostStackDb>[], M>;
type Track = (request: Promise<unknown>) => void;

const STORES: StoreNames<GhostStackDb>[] = ['stacks', 'assets'];

const notFound = (
  message: string,
  ids: Pick<StorageError, 'stackId' | 'assetId'>,
): StorageError => ({
  code: 'not-found',
  message,
  ...ids,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** Returns the bytes of a stored asset record, or undefined when the record is damaged. */
function bytesOf(record: unknown): Uint8Array | undefined {
  return isRecord(record) && record['bytes'] instanceof Uint8Array ? record['bytes'] : undefined;
}

function openDatabase(
  factory: IDBFactory,
  name: string,
  onConnectionLost: () => void,
): Promise<Db> {
  const request = factory.open(name, DB_VERSION);
  request.addEventListener('upgradeneeded', (event) => {
    const upgrade = request.result;
    if (event.oldVersion < 1) {
      upgrade.createObjectStore('stacks', { keyPath: 'stackId' });
      upgrade.createObjectStore('assets', { keyPath: ['stackId', 'assetId'] });
    }
  });
  return (wrap(request) as unknown as Promise<Db>).then((db) => {
    // Another tab wants to upgrade: release the connection so it is not blocked.
    db.addEventListener('versionchange', () => {
      db.close();
      onConnectionLost();
    });
    db.addEventListener('close', onConnectionLost);
    return db;
  });
}

/**
 * Runs `work` in one transaction and resolves after the transaction completes.
 * `work` must only await IndexedDB requests, or the transaction commits early.
 * Any failure aborts the transaction, so a failed write changes nothing.
 */
async function transact<T, M extends Mode>(
  db: Db,
  mode: M,
  work: (tx: Tx<M>, track: Track) => Promise<T> | T,
): Promise<T> {
  const tx = db.transaction(STORES, mode);
  const done = tx.done;
  // Mark rejections as handled at once; they are awaited and reported below.
  void done.catch(() => undefined);
  const tracked: Promise<unknown>[] = [];
  try {
    const value = await work(tx, (request) => {
      void request.catch(() => undefined);
      tracked.push(request);
    });
    await Promise.all(tracked);
    await done;
    return value;
  } catch (error) {
    try {
      tx.abort();
    } catch {
      // The transaction already finished or aborted.
    }
    await Promise.allSettled(tracked);
    await done.catch(() => undefined);
    throw error;
  }
}

export function createIndexedDbStorage(options: IndexedDbStorageOptions = {}): StoragePort {
  const databaseName = options.databaseName ?? DB_NAME;
  const fault = options.faultInjection;
  const assetRange = (stackId: string): IDBKeyRange =>
    IDBKeyRange.bound([stackId, ''], [stackId, '\uffff']);
  let connection: Promise<Db> | undefined;

  /** Opens lazily and caches the connection. A failed open is not cached. */
  const getDb = (): Promise<Db> => {
    if (connection !== undefined) return connection;
    const factory = options.factory ?? (globalThis as { indexedDB?: IDBFactory }).indexedDB;
    if (factory === undefined) {
      return Promise.reject(new DOMException('IndexedDB is not available.', 'NotSupportedError'));
    }
    const opening = openDatabase(factory, databaseName, () => {
      if (connection === opening) connection = undefined;
    }).catch((error: unknown) => {
      if (connection === opening) connection = undefined;
      throw error;
    });
    connection = opening;
    return opening;
  };

  /** Runs an operation and turns any thrown IndexedDB failure into a StorageError. */
  async function guarded<T>(
    context: IdbErrorContext & { phase: 'read' | 'write' },
    run: (db: Db) => Promise<Result<T, StorageError>>,
  ): Promise<Result<T, StorageError>> {
    let db: Db;
    try {
      db = await getDb();
    } catch (error) {
      return err(mapIdbError(error, { ...context, phase: 'open' }));
    }
    try {
      return await run(db);
    } catch (error) {
      return err(mapIdbError(error, context));
    }
  }

  return {
    saveProject(bundle: ProjectBundle) {
      const invalid = checkBundle(bundle);
      if (invalid) return Promise.resolve(err(invalid));
      const { stack } = bundle;
      return guarded({ phase: 'write', stackId: stack.stackId }, (db) =>
        transact(db, 'readwrite', (tx, track) => {
          const stacks = tx.objectStore('stacks');
          const assets = tx.objectStore('assets');
          track(stacks.put(stack));
          fault?.('after-stack-put');
          // Clearing the stack's key range first removes assets the bundle drops.
          track(assets.delete(assetRange(stack.stackId)));
          for (const [assetId, bytes] of Object.entries(bundle.assets)) {
            track(assets.put({ stackId: stack.stackId, assetId, bytes }));
          }
          fault?.('after-asset-put');
          return ok(undefined);
        }),
      );
    },

    loadProject(stackId) {
      return guarded({ phase: 'read', stackId }, (db) =>
        transact(db, 'readonly', async (tx) => {
          const stored: unknown = await tx.objectStore('stacks').get(stackId);
          if (stored === undefined) {
            return err(notFound('No project with this stack ID.', { stackId }));
          }
          const validation = validateProject(stored);
          if (!isValid(validation)) {
            return err({
              code: 'validation-failed',
              message: 'The stored project is not valid.',
              stackId,
              validationErrors: validation.errors,
            });
          }
          const stack = stored as Stack;
          const records = await tx.objectStore('assets').getAll(assetRange(stackId));
          const byId = new Map<string, unknown>();
          for (const record of records) {
            if (isRecord(record) && typeof record['assetId'] === 'string') {
              byId.set(record['assetId'], record);
            }
          }
          const assets: Record<string, Uint8Array> = {};
          for (const [assetId, asset] of Object.entries(stack.assetRegistry)) {
            const record = byId.get(assetId);
            if (record === undefined) {
              return err(notFound('A registered asset has no stored bytes.', { stackId, assetId }));
            }
            const bytes = bytesOf(record);
            if (bytes === undefined || bytes.length !== asset.byteSize) {
              return err({
                code: 'validation-failed',
                message: 'Stored asset bytes are damaged or do not match the registered size.',
                stackId,
                assetId,
              });
            }
            assets[assetId] = bytes;
          }
          return ok({ stack, assets });
        }),
      );
    },

    listProjects() {
      return guarded({ phase: 'read' }, (db) =>
        transact(db, 'readonly', async (tx) => {
          const listing: {
            summaries: ProjectListing['summaries'][number][];
            unreadable: ProjectListing['unreadable'][number][];
          } = {
            summaries: [],
            unreadable: [],
          };
          let cursor = await tx.objectStore('stacks').openCursor();
          while (cursor) {
            const record = cursor.value;
            const stackId = String(cursor.key);
            if (
              isRecord(record) &&
              typeof record['title'] === 'string' &&
              typeof record['updatedAt'] === 'string'
            ) {
              listing.summaries.push({
                stackId,
                title: record['title'],
                updatedAt: record['updatedAt'],
              });
            } else {
              listing.unreadable.push({
                stackId,
                message: 'The stored record has no readable title or update time.',
              });
            }
            cursor = await cursor.continue();
          }
          return ok(listing);
        }),
      );
    },

    deleteProject(stackId) {
      return guarded({ phase: 'write', stackId }, (db) =>
        transact(db, 'readwrite', async (tx, track) => {
          const stacks = tx.objectStore('stacks');
          const assets = tx.objectStore('assets');
          const [stackCount, assetCount] = await Promise.all([
            stacks.count(stackId),
            assets.count(assetRange(stackId)),
          ]);
          if (stackCount + assetCount === 0) {
            return err(notFound('No project with this stack ID.', { stackId }));
          }
          track(stacks.delete(stackId));
          track(assets.delete(assetRange(stackId)));
          fault?.('after-project-delete');
          return ok(undefined);
        }),
      );
    },

    saveAsset(stackId, assetId, bytes) {
      return guarded({ phase: 'write', stackId, assetId }, (db) =>
        transact(db, 'readwrite', (tx, track) => {
          track(tx.objectStore('assets').put({ stackId, assetId, bytes }));
          fault?.('after-asset-put');
          return ok(undefined);
        }),
      );
    },

    loadAsset(stackId, assetId) {
      return guarded({ phase: 'read', stackId, assetId }, (db) =>
        transact(db, 'readonly', async (tx) => {
          const record: unknown = await tx.objectStore('assets').get([stackId, assetId]);
          if (record === undefined) {
            return err(notFound('No asset with this ID.', { stackId, assetId }));
          }
          const bytes = bytesOf(record);
          if (bytes === undefined) {
            return err({
              code: 'validation-failed',
              message: 'The stored asset record is damaged.',
              stackId,
              assetId,
            });
          }
          return ok(bytes);
        }),
      );
    },

    deleteAsset(stackId, assetId) {
      return guarded({ phase: 'write', stackId, assetId }, (db) =>
        transact(db, 'readwrite', async (tx, track) => {
          const assets = tx.objectStore('assets');
          if ((await assets.count([stackId, assetId])) === 0) {
            return err(notFound('No asset with this ID.', { stackId, assetId }));
          }
          track(assets.delete([stackId, assetId]));
          fault?.('after-asset-delete');
          return ok(undefined);
        }),
      );
    },
  };
}
