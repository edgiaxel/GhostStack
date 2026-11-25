import { err, ok } from '@ghoststack/shared-contracts';
import type { ApplyCommand, Card, GhostError, Result, Stack } from '@ghoststack/shared-contracts';
import { deepClone } from './deep-clone';
import { validateStack } from './validate';

const invalid = (message: string): Result<never, GhostError> =>
  err({ code: 'INVALID_PATCH_COMMAND', message });

const hasCard = (stack: Stack, cardId: string): boolean =>
  Object.prototype.hasOwnProperty.call(stack.cards, cardId);

const blank = (title: string): boolean => title.trim().length === 0;

/** Returns the next Stack (never mutates `stack`), or an INVALID_PATCH_COMMAND error. */
function reduce(stack: Stack, command: Parameters<ApplyCommand>[1]): Result<Stack, GhostError> {
  switch (command.type) {
    case 'RENAME_STACK':
      if (blank(command.title)) return invalid('Stack title must not be empty');
      return ok({ ...stack, title: command.title });

    case 'ADD_CARD': {
      if (command.cardId.length === 0) return invalid('cardId must not be empty');
      if (hasCard(stack, command.cardId)) return invalid(`Card id already exists: ${command.cardId}`);
      if (blank(command.title)) return invalid('Card title must not be empty');
      const index = command.index ?? stack.cardOrder.length;
      if (!Number.isInteger(index) || index < 0 || index > stack.cardOrder.length) {
        return invalid(`Card index out of range: ${index}`);
      }
      const card: Card = { cardId: command.cardId, title: command.title, elements: [], behaviors: [] };
      const cardOrder = [...stack.cardOrder];
      cardOrder.splice(index, 0, card.cardId);
      return ok({ ...stack, cards: { ...stack.cards, [card.cardId]: card }, cardOrder });
    }

    case 'RENAME_CARD': {
      const card = hasCard(stack, command.cardId) ? stack.cards[command.cardId] : undefined;
      if (!card) return invalid(`Unknown card: ${command.cardId}`);
      if (blank(command.title)) return invalid('Card title must not be empty');
      return ok({ ...stack, cards: { ...stack.cards, [card.cardId]: { ...card, title: command.title } } });
    }

    case 'DUPLICATE_CARD': {
      const source = hasCard(stack, command.cardId) ? stack.cards[command.cardId] : undefined;
      if (!source) return invalid(`Unknown card: ${command.cardId}`);
      if (command.newCardId.length === 0) return invalid('newCardId must not be empty');
      if (hasCard(stack, command.newCardId)) return invalid(`Card id already exists: ${command.newCardId}`);
      // Element ids are scoped per card, so they are kept as-is in the copy.
      const copy: Card = {
        ...deepClone(source),
        cardId: command.newCardId,
        title: `${source.title} copy`,
      };
      const cardOrder = [...stack.cardOrder];
      cardOrder.splice(cardOrder.indexOf(source.cardId) + 1, 0, copy.cardId);
      return ok({ ...stack, cards: { ...stack.cards, [copy.cardId]: copy }, cardOrder });
    }

    case 'REORDER_CARDS': {
      const next = command.cardOrder;
      const unique = new Set(next);
      if (
        next.length !== stack.cardOrder.length ||
        unique.size !== next.length ||
        next.some((id) => !hasCard(stack, id))
      ) {
        return invalid('cardOrder must be a permutation of the existing card ids');
      }
      return ok({ ...stack, cardOrder: [...next] });
    }

    case 'DELETE_CARD': {
      if (!hasCard(stack, command.cardId)) return invalid(`Unknown card: ${command.cardId}`);
      if (stack.cardOrder.length <= 1) return invalid('Cannot delete the last card');
      const cardOrder = stack.cardOrder.filter((id) => id !== command.cardId);
      const cards = Object.fromEntries(Object.entries(stack.cards).filter(([id]) => id !== command.cardId));
      const entryCardId = stack.entryCardId === command.cardId ? (cardOrder[0] as string) : stack.entryCardId;
      return ok({ ...stack, cards, cardOrder, entryCardId });
    }

    default:
      return invalid('Unknown command type');
  }
}

export const applyCommand: ApplyCommand = (stack, command, now) => {
  const next = reduce(stack, command);
  if (!next.ok) return next;
  return validateStack({ ...next.value, updatedAt: now });
};
