import { StackSchema, err, ok } from '@ghoststack/shared-contracts';
import type { GhostError, Result, Stack } from '@ghoststack/shared-contracts';

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
