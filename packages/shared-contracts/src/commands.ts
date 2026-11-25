import type { Result, GhostError } from './errors';
import type { Stack } from './project';

/**
 * Domain command contract (ARCHITECTURE 7.1). Every Stack change goes through
 * `applyCommand` in `@ghoststack/domain`. Element/behavior commands are added by the
 * contract owner when VS-03 / VS-04 start.
 */
export type ProjectCommand =
  | { type: 'RENAME_STACK'; title: string }
  | { type: 'ADD_CARD'; cardId: string; title: string; index?: number }
  | { type: 'RENAME_CARD'; cardId: string; title: string }
  | { type: 'DUPLICATE_CARD'; cardId: string; newCardId: string }
  | { type: 'REORDER_CARDS'; cardOrder: string[] }
  | { type: 'DELETE_CARD'; cardId: string };

/** Signature `@ghoststack/domain` must export as `applyCommand`. `now` is ISO 8601. */
export type ApplyCommand = (stack: Stack, command: ProjectCommand, now: string) => Result<Stack, GhostError>;
