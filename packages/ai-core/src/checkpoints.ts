import { err, isValid, ok, validateProject } from '@ghoststack/domain';
import type { ProjectBundle, Result, Stack } from '@ghoststack/domain';
import type { CheckpointRepository } from '@ghoststack/storage';
import type { AIIssue } from './errors';

export type CheckpointStatus = 'manual' | 'pending' | 'committed' | 'failed' | 'rolled-back';

/** One snapshot taken before an operation. For AI operations the checkpoint id is the operation id. */
export interface CheckpointRecord {
  readonly checkpointId: string;
  readonly stackId: string;
  readonly label: string;
  readonly planId?: string;
  readonly status: CheckpointStatus;
  readonly createdAt: string;
  /** `updatedAt` the project will have once the operation commits. Lets recovery detect a landed commit. */
  readonly expectedUpdatedAt?: string;
  /** Project and asset bytes as they were before the operation. */
  readonly bundle: ProjectBundle;
}

export interface CheckpointStore {
  /** Creates or replaces the record with the same `checkpointId`. Resolves only once it is durable. */
  put(record: CheckpointRecord): Promise<Result<void, AIIssue>>;
  get(checkpointId: string): Promise<Result<CheckpointRecord, AIIssue>>;
  /** Oldest first. */
  list(stackId: string): Promise<Result<readonly CheckpointRecord[], AIIssue>>;
}

const failed = (message: string): AIIssue => ({
  code: 'CHECKPOINT_FAILED',
  message,
  path: [],
});

/** In-memory store for tests and offline demos. Copies on write and on read. */
export function createMemoryCheckpointStore(): CheckpointStore & {
  failNextPut(): void;
} {
  const records = new Map<string, CheckpointRecord>();
  let failNext = false;
  return {
    failNextPut() {
      failNext = true;
    },
    put(record) {
      if (failNext) {
        failNext = false;
        return Promise.resolve(err(failed('Checkpoint could not be saved.')));
      }
      records.set(record.checkpointId, structuredClone(record));
      return Promise.resolve(ok(undefined));
    },
    get(checkpointId) {
      const found = records.get(checkpointId);
      return Promise.resolve(
        found === undefined ? err(failed('Checkpoint not found.')) : ok(structuredClone(found)),
      );
    },
    list(stackId) {
      const all = [...records.values()]
        .filter((record) => record.stackId === stackId)
        .sort(
          (a, b) =>
            a.createdAt.localeCompare(b.createdAt) || a.checkpointId.localeCompare(b.checkpointId),
        );
      return Promise.resolve(ok(structuredClone(all)));
    },
  };
}

const STATUSES: ReadonlySet<string> = new Set([
  'manual',
  'pending',
  'committed',
  'failed',
  'rolled-back',
]);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** Stored data is not trusted: shape and project are re-validated on every read. */
export function parseCheckpointRecord(value: unknown): CheckpointRecord | undefined {
  if (!isObject(value)) return undefined;
  const { checkpointId, stackId, label, status, createdAt, bundle } = value;
  if (
    typeof checkpointId !== 'string' ||
    typeof stackId !== 'string' ||
    typeof label !== 'string' ||
    typeof status !== 'string' ||
    !STATUSES.has(status) ||
    typeof createdAt !== 'string' ||
    !isObject(bundle) ||
    !isObject(bundle['assets'])
  ) {
    return undefined;
  }
  if (value['planId'] !== undefined && typeof value['planId'] !== 'string') return undefined;
  if (value['expectedUpdatedAt'] !== undefined && typeof value['expectedUpdatedAt'] !== 'string') {
    return undefined;
  }
  if (!isValid(validateProject(bundle['stack']))) return undefined;
  const assets = bundle['assets'];
  for (const bytes of Object.values(assets)) {
    if (!(bytes instanceof Uint8Array)) return undefined;
  }
  return value as unknown as CheckpointRecord & { bundle: { stack: Stack } };
}

/** A durable store on top of a storage repository. Damaged records are reported, never trusted. */
export function createRepositoryCheckpointStore(repository: CheckpointRepository): CheckpointStore {
  const damaged = (): AIIssue => failed('A stored checkpoint is damaged.');
  return {
    async put(record) {
      const stored = await repository.put(record);
      return stored.ok ? ok(undefined) : err(failed(stored.error.message));
    },
    async get(checkpointId) {
      const found = await repository.get(checkpointId);
      if (!found.ok) return err(failed(found.error.message));
      const record = parseCheckpointRecord(found.value);
      return record === undefined ? err(damaged()) : ok(record);
    },
    async list(stackId) {
      const found = await repository.list(stackId);
      if (!found.ok) return err(failed(found.error.message));
      // Damaged records are skipped so one bad record cannot block recovery of the others.
      const records = found.value
        .map(parseCheckpointRecord)
        .filter((record): record is CheckpointRecord => record !== undefined)
        .sort(
          (a, b) =>
            a.createdAt.localeCompare(b.createdAt) || a.checkpointId.localeCompare(b.checkpointId),
        );
      return ok(records);
    },
  };
}
