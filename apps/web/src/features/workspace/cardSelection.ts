import type { Stack } from '@ghoststack/shared-contracts';

/** Returns the card to show: the URL card if it exists, else the entry card, else the first card, else undefined. */
export function resolveSelectedCardId(
  stack: Pick<Stack, 'cards' | 'cardOrder' | 'entryCardId'>,
  requestedCardId: string | undefined,
): string | undefined {
  if (requestedCardId !== undefined && requestedCardId in stack.cards) return requestedCardId;
  if (stack.entryCardId in stack.cards) return stack.entryCardId;
  return stack.cardOrder.find((id) => id in stack.cards);
}

/** Returns a new order with `cardId` moved by `delta` positions, or undefined when the move is not possible. */
export function moveCardInOrder(
  order: readonly string[],
  cardId: string,
  delta: -1 | 1,
): string[] | undefined {
  const from = order.indexOf(cardId);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= order.length) return undefined;
  const next = [...order];
  next.splice(from, 1);
  next.splice(to, 0, cardId);
  return next;
}

/** Card to select after deleting `deletedId`: the next neighbour, else the previous, else undefined. */
export function nextSelectionAfterDelete(order: readonly string[], deletedId: string): string | undefined {
  const i = order.indexOf(deletedId);
  if (i < 0) return undefined;
  return order[i + 1] ?? order[i - 1];
}
