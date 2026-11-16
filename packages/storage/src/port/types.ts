import type { ProjectBundle, Result, ValidationError } from '@ghoststack/domain';

export type StorageErrorCode =
  | 'not-found'
  | 'validation-failed'
  | 'quota-exceeded'
  | 'storage-unavailable'
  | 'unsupported-version'
  | 'write-failed';

export interface StorageError {
  readonly code: StorageErrorCode;
  readonly message: string;
  readonly stackId?: string;
  readonly assetId?: string;
  /** Present for `validation-failed` caused by the project validator. */
  readonly validationErrors?: readonly ValidationError[];
  /** Present for `unsupported-version`, when the engine reports it. */
  readonly storedVersion?: number;
  readonly supportedVersion?: number;
}

export interface ProjectSummary {
  readonly stackId: string;
  readonly title: string;
  readonly updatedAt: string;
}

/** A stored record that cannot be summarised. Listed so it stays visible (T-025). */
export interface UnreadableProject {
  readonly stackId: string;
  readonly message: string;
}

export interface ProjectListing {
  readonly summaries: readonly ProjectSummary[];
  readonly unreadable: readonly UnreadableProject[];
}

/** Every method returns a `Result` and never throws. */
export interface StoragePort {
  /** Replaces the whole stored project: stack, listed assets, and drops assets not in the bundle. */
  saveProject(bundle: ProjectBundle): Promise<Result<void, StorageError>>;
  loadProject(stackId: string): Promise<Result<ProjectBundle, StorageError>>;
  listProjects(): Promise<Result<ProjectListing, StorageError>>;
  /** Removes the stack and every asset scoped to it. */
  deleteProject(stackId: string): Promise<Result<void, StorageError>>;

  saveAsset(
    stackId: string,
    assetId: string,
    bytes: Uint8Array,
  ): Promise<Result<void, StorageError>>;
  loadAsset(stackId: string, assetId: string): Promise<Result<Uint8Array, StorageError>>;
  deleteAsset(stackId: string, assetId: string): Promise<Result<void, StorageError>>;
}
