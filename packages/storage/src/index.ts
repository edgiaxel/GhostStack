import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';
import { StackSchema } from '@ghoststack/shared-contracts';
import type { ErrorCode, Stack, StackRepository, StackSummary } from '@ghoststack/shared-contracts';

export const DB_NAME = 'ghoststack';
export const DB_VERSION = 1;
const STACKS = 'stacks';

export class StorageError extends Error {
  readonly code: ErrorCode;
  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
  }
}

function open(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STACKS)) {
        db.createObjectStore(STACKS, { keyPath: 'stackId' });
      }
    },
  });
}

function parse(value: unknown): Stack {
  const r = StackSchema.safeParse(value);
  if (!r.success) throw new StorageError('PROJECT_VALIDATION_FAILED', r.error.message);
  return r.data;
}

/** Browser IndexedDB implementation of the StackRepository port. */
export function createIdbStackRepository(): StackRepository {
  const db = open();
  return {
    async list(): Promise<StackSummary[]> {
      const all = await (await db).getAll(STACKS);
      return all
        .map(parse)
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
      return raw === undefined ? undefined : parse(raw);
    },
    async save(stack) {
      const valid = parse(stack);
      const d = await db;
      const tx = d.transaction(STACKS, 'readwrite');
      await tx.store.put(valid);
      await tx.done;
    },
    async delete(stackId) {
      const d = await db;
      const tx = d.transaction(STACKS, 'readwrite');
      await tx.store.delete(stackId);
      await tx.done;
    },
  };
}
