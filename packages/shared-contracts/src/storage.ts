import type { Asset, Stack } from './project';

export interface StackSummary {
  stackId: string;
  title: string;
  updatedAt: string;
  cardCount: number;
}

/**
 * Storage port. Implemented by `@ghoststack/storage`; UI code depends on this interface only.
 * Methods reject with an Error whose `code` is an `ErrorCode` when persistence or validation fails.
 * `save` validates before writing and replaces the whole Stack atomically.
 * `delete` also removes the Stack's assets and checkpoints in the same transaction.
 */
export interface StackRepository {
  list(): Promise<StackSummary[]>;
  get(stackId: string): Promise<Stack | undefined>;
  save(stack: Stack): Promise<void>;
  delete(stackId: string): Promise<void>;
}

/**
 * Asset bytes, scoped per Stack. Metadata lives in `Stack.assetRegistry`; this port holds the
 * binary. A registered asset whose bytes are absent is a normal state (missing-asset fallback).
 */
export interface AssetRepository {
  /** Rejects with STORAGE_FAILED when the byte length differs from asset.byteSize. */
  put(stackId: string, asset: Asset, bytes: Uint8Array): Promise<void>;
  get(stackId: string, assetId: string): Promise<Uint8Array | undefined>;
  /** Every stored asset of the Stack, keyed by assetId. Shape accepted by `exportGsp`. */
  getAll(stackId: string): Promise<Record<string, Uint8Array>>;
  delete(stackId: string, assetId: string): Promise<void>;
}

export type CheckpointKind = 'auto' | 'manual' | 'recovery';

export interface CheckpointSummary {
  checkpointId: string;
  stackId: string;
  label: string;
  kind: CheckpointKind;
  /** ISO 8601 */
  createdAt: string;
}

export interface Checkpoint extends CheckpointSummary {
  stack: Stack;
}

/** Recovery snapshots. `put` validates the Stack and overwrites an existing `checkpointId`. */
export interface CheckpointRepository {
  /** Newest first. */
  list(stackId: string): Promise<CheckpointSummary[]>;
  get(checkpointId: string): Promise<Checkpoint | undefined>;
  put(checkpoint: Checkpoint): Promise<void>;
  delete(checkpointId: string): Promise<void>;
}
