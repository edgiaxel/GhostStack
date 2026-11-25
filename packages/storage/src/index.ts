import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';
import { AssetSchema, StackSchema } from '@ghoststack/shared-contracts';
import type {
  Asset,
  AssetRepository,
  Checkpoint,
  CheckpointRepository,
  CheckpointSummary,
  ErrorCode,
  Stack,
  StackRepository,
  StackSummary,
} from '@ghoststack/shared-contracts';

export const DB_NAME = 'ghoststack';
/** v1: `stacks`. v2: adds `assets` and `checkpoints`. Upgrades keep existing data. */
export const DB_VERSION = 2;
const STACKS = 'stacks';
const ASSETS = 'assets';
const CHECKPOINTS = 'checkpoints';
const BY_STACK = 'byStack';

export class StorageError extends Error {
  readonly code: ErrorCode;
  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
  }
}

interface AssetRecord {
  stackId: string;
  assetId: string;
  asset: Asset;
  bytes: Uint8Array;
}

function open(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STACKS)) {
        db.createObjectStore(STACKS, { keyPath: 'stackId' });
      }
      if (!db.objectStoreNames.contains(ASSETS)) {
        db.createObjectStore(ASSETS, { keyPath: ['stackId', 'assetId'] });
      }
      if (!db.objectStoreNames.contains(CHECKPOINTS)) {
        const store = db.createObjectStore(CHECKPOINTS, { keyPath: 'checkpointId' });
        store.createIndex(BY_STACK, 'stackId');
      }
    },
  });
}

function parseStack(value: unknown): Stack {
  const r = StackSchema.safeParse(value);
  if (!r.success) throw new StorageError('PROJECT_VALIDATION_FAILED', r.error.message);
  return r.data;
}

/** All stored assets of one Stack, using the compound key range [stackId, '' .. stackId, max]. */
const assetRange = (stackId: string): IDBKeyRange => IDBKeyRange.bound([stackId, ''], [stackId, '\uffff']);

export interface IdbStorage {
  stacks: StackRepository;
  assets: AssetRepository;
  checkpoints: CheckpointRepository;
}

/** Browser IndexedDB implementation of the storage ports, sharing one connection. */
export function createIdbStorage(): IdbStorage {
  const db = open();

  const stacks: StackRepository = {
    async list(): Promise<StackSummary[]> {
      const all = await (await db).getAll(STACKS);
      return all
        .map(parseStack)
        .map((s) => ({
          stackId: s.stackId,
          title: s.title,
          updatedAt: s.updatedAt,
          cardCount: s.cardOrder.length,
        }))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    async get(stackId) {
      const raw: unknown = await (await db).get(STACKS, stackId);
      return raw === undefined ? undefined : parseStack(raw);
    },
    async save(stack) {
      const valid = parseStack(stack);
      const d = await db;
      const tx = d.transaction(STACKS, 'readwrite');
      await tx.store.put(valid);
      await tx.done;
    },
    async delete(stackId) {
      const d = await db;
      const tx = d.transaction([STACKS, ASSETS, CHECKPOINTS], 'readwrite');
      await tx.objectStore(STACKS).delete(stackId);
      await tx.objectStore(ASSETS).delete(assetRange(stackId));
      const index = tx.objectStore(CHECKPOINTS).index(BY_STACK);
      for (let cursor = await index.openCursor(stackId); cursor; cursor = await cursor.continue()) {
        await cursor.delete();
      }
      await tx.done;
    },
  };

  const assets: AssetRepository = {
    async put(stackId, asset, bytes) {
      const parsed = AssetSchema.safeParse(asset);
      if (!parsed.success) throw new StorageError('STORAGE_FAILED', `Invalid asset: ${parsed.error.message}`);
      if (bytes.length !== parsed.data.byteSize) {
        throw new StorageError(
          'STORAGE_FAILED',
          `Asset ${asset.assetId} has ${bytes.length} bytes but byteSize is ${parsed.data.byteSize}`,
        );
      }
      const record: AssetRecord = { stackId, assetId: parsed.data.assetId, asset: parsed.data, bytes };
      const d = await db;
      const tx = d.transaction(ASSETS, 'readwrite');
      await tx.store.put(record);
      await tx.done;
    },
    async get(stackId, assetId) {
      const record = (await (await db).get(ASSETS, [stackId, assetId])) as AssetRecord | undefined;
      return record?.bytes;
    },
    async getAll(stackId) {
      const records = (await (await db).getAll(ASSETS, assetRange(stackId))) as AssetRecord[];
      return Object.fromEntries(records.map((r) => [r.assetId, r.bytes]));
    },
    async delete(stackId, assetId) {
      const d = await db;
      const tx = d.transaction(ASSETS, 'readwrite');
      await tx.store.delete([stackId, assetId]);
      await tx.done;
    },
  };

  const summarize = ({ checkpointId, stackId, label, kind, createdAt }: Checkpoint): CheckpointSummary => ({
    checkpointId,
    stackId,
    label,
    kind,
    createdAt,
  });

  const checkpoints: CheckpointRepository = {
    async list(stackId) {
      const all = (await (await db).getAllFromIndex(CHECKPOINTS, BY_STACK, stackId)) as Checkpoint[];
      return all.map(summarize).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async get(checkpointId) {
      const raw = (await (await db).get(CHECKPOINTS, checkpointId)) as Checkpoint | undefined;
      return raw === undefined ? undefined : { ...raw, stack: parseStack(raw.stack) };
    },
    async put(checkpoint) {
      const stack = parseStack(checkpoint.stack);
      if (stack.stackId !== checkpoint.stackId) {
        throw new StorageError('CHECKPOINT_FAILED', 'Checkpoint stackId does not match its Stack');
      }
      const d = await db;
      const tx = d.transaction(CHECKPOINTS, 'readwrite');
      await tx.store.put({ ...checkpoint, stack });
      await tx.done;
    },
    async delete(checkpointId) {
      const d = await db;
      const tx = d.transaction(CHECKPOINTS, 'readwrite');
      await tx.store.delete(checkpointId);
      await tx.done;
    },
  };

  return { stacks, assets, checkpoints };
}

/** Kept for callers that only need Stacks. Prefer `createIdbStorage()` so connections are shared. */
export function createIdbStackRepository(): StackRepository {
  return createIdbStorage().stacks;
}
