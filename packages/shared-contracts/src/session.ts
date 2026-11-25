import type { ProjectCommand } from './commands';
import type { GhostError, Result } from './errors';
import type { Stack } from './project';

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

export interface SessionStatus {
  saveState: SaveState;
  canUndo: boolean;
  canRedo: boolean;
  /** Set when `saveState` is `error`. */
  error?: string;
  /** True when `open` restored unsaved work from an interrupted session. */
  recovered?: boolean;
}

export interface DispatchOptions {
  /**
   * Consecutive dispatches with the same key collapse into one undo step (a drag, a typing burst).
   * A different key, no key, `undo` or `redo` ends the group.
   */
  coalesceKey?: string;
}

/**
 * The single editing handle for one open Stack. Features never call `applyCommand` or
 * `StackRepository.save` themselves; they `dispatch` and the session validates, records undo
 * history and debounces the save.
 *
 * `getStack` and `getStatus` return referentially stable values between changes, so they work
 * with React's `useSyncExternalStore`.
 */
export interface StackSession {
  readonly stackId: string;
  getStack(): Stack;
  getStatus(): SessionStatus;
  subscribe(listener: () => void): () => void;
  /** Synchronous. On error the Stack is unchanged and nothing is recorded. */
  dispatch(command: ProjectCommand, options?: DispatchOptions): Result<Stack, GhostError>;
  /**
   * Replaces the whole Stack with a snapshot (checkpoint restore) as one undoable step. The snapshot
   * must have this session's `stackId` and pass `validateStack`. On error nothing changes.
   */
  restore(snapshot: Stack): Result<Stack, GhostError>;
  /** Returns false when there is nothing to undo or redo. */
  undo(): boolean;
  redo(): boolean;
  /** Resolves when pending changes are durably saved. Call before preview, export or leaving. */
  flush(): Promise<void>;
  dispose(): void;
}

export interface StackSessionFactory {
  /** Loads the Stack, restores interrupted work if any, and returns a session. STACK_NOT_FOUND if absent. */
  open(stackId: string): Promise<Result<StackSession, GhostError>>;
}
