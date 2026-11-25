import { StackSchema, DEFAULT_VIEWPORT, FORMAT_VERSION, err, ok } from '@ghoststack/shared-contracts';
import type { ApplyCommand, GhostError, Result, Stack } from '@ghoststack/shared-contracts';

export interface CreateStackInput {
  stackId: string;
  cardId: string;
  title: string;
  /** ISO 8601 */
  now: string;
}

/** Pure: callers supply ids and time so the domain has no browser or random dependency. */
export function createStack(input: CreateStackInput): Stack {
  return {
    stackId: input.stackId,
    title: input.title,
    formatVersion: FORMAT_VERSION,
    createdAt: input.now,
    updatedAt: input.now,
    entryCardId: input.cardId,
    cardOrder: [input.cardId],
    stateSchema: {},
    cards: { [input.cardId]: { cardId: input.cardId, title: 'Card 1', elements: [], behaviors: [] } },
    assetRegistry: {},
    viewportDefaults: { ...DEFAULT_VIEWPORT },
  };
}

export function validateStack(value: unknown): Result<Stack, GhostError> {
  const parsed = StackSchema.safeParse(value);
  if (!parsed.success) {
    return err({ code: 'PROJECT_VALIDATION_FAILED', message: parsed.error.message });
  }
  const stack = parsed.data;
  const ids = Object.keys(stack.cards);
  if (stack.cardOrder.length !== ids.length || stack.cardOrder.some((id) => !(id in stack.cards))) {
    return err({ code: 'PROJECT_VALIDATION_FAILED', message: 'cardOrder must list every card exactly once' });
  }
  if (!(stack.entryCardId in stack.cards)) {
    return err({ code: 'PROJECT_VALIDATION_FAILED', message: 'entryCardId does not reference a card' });
  }
  return ok(stack);
}

/** Command handlers are implemented in VS-02 (worktree `domain`). */
export const applyCommand: ApplyCommand = () =>
  err({ code: 'INVALID_PATCH_COMMAND', message: 'applyCommand is not implemented yet (VS-02)' });
