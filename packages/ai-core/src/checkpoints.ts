import { err, ok } from '@ghoststack/domain';
import type { ProjectBundle, Result } from '@ghoststack/domain';
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
