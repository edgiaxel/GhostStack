import type { Result } from '@ghoststack/domain';
import type { StorageError } from './types';

/** Fields the repository needs. The rest of a record is stored as given and validated by the reader. */
export interface CheckpointRow {
  readonly checkpointId: string;
  readonly stackId: string;
  readonly createdAt: string;
}

/**
 * Durable storage for operation checkpoints. Reads return `unknown` on purpose: stored data is not
 * trusted, so the caller validates it before use.
 */
export interface CheckpointRepository {
  /** Creates or replaces the record. Resolves only after the transaction completed. */
  put(record: CheckpointRow): Promise<Result<void, StorageError>>;
  get(checkpointId: string): Promise<Result<unknown, StorageError>>;
  /** Every record for the stack, in no guaranteed order. */
  list(stackId: string): Promise<Result<readonly unknown[], StorageError>>;
}
