import { err, ok } from '@ghoststack/shared-contracts';
import type {
  ActionNode,
  ApplyCommand,
  Behavior,
  Card,
  Element,
  GhostError,
  ProjectCommand,
  Result,
  Stack,
} from '@ghoststack/shared-contracts';
import { filterActions } from './behavior-refs';
import { deepClone } from './deep-clone';
import { validateStack } from './validate';

const invalid = (message: string): Result<never, GhostError> =>
  err({ code: 'INVALID_PATCH_COMMAND', message });

const has = (record: object, key: string): boolean => Object.prototype.hasOwnProperty.call(record, key);

const blank = (title: string): boolean => title.trim().length === 0;

const withCard = (stack: Stack, card: Card): Stack => ({
  ...stack,
  cards: { ...stack.cards, [card.cardId]: card },
});

const scrubBehaviors = (behaviors: Behavior[], drop: (a: ActionNode) => boolean): Behavior[] =>
  behaviors.map((b) => ({ ...b, actions: filterActions(b.actions, drop) }));

/** Applies `drop` to every behavior of the given Cards (Card-level and Element-level). */
function scrubCards(cards: Card[], drop: (a: ActionNode) => boolean): Card[] {
  return cards.map((card) => ({
    ...card,
    behaviors: scrubBehaviors(card.behaviors, drop),
    elements: card.elements.map((el) => ({ ...el, behaviors: scrubBehaviors(el.behaviors, drop) })),
  }));
}

function findElement(card: Card, elementId: string): Element | undefined {
  return card.elements.find((e) => e.elementId === elementId);
}

function replaceElement(card: Card, element: Element): Card {
  return { ...card, elements: card.elements.map((e) => (e.elementId === element.elementId ? element : e)) };
}

/** Elements ordered back to front. Ties keep authoring order. */
const byZ = (elements: Element[]): Element[] =>
  elements
    .map((e, i) => ({ e, i }))
    .sort((a, b) => a.e.layout.zIndex - b.e.layout.zIndex || a.i - b.i)
    .map(({ e }) => e);

/** Returns the next Stack (never mutates `stack`), or an INVALID_PATCH_COMMAND error. */
function reduce(stack: Stack, command: ProjectCommand): Result<Stack, GhostError> {
  switch (command.type) {
    case 'RENAME_STACK':
      if (blank(command.title)) return invalid('Stack title must not be empty');
      return ok({ ...stack, title: command.title });

    case 'ADD_CARD': {
      if (command.cardId.length === 0) return invalid('cardId must not be empty');
      if (has(stack.cards, command.cardId)) return invalid(`Card id already exists: ${command.cardId}`);
      if (blank(command.title)) return invalid('Card title must not be empty');
      const index = command.index ?? stack.cardOrder.length;
      if (!Number.isInteger(index) || index < 0 || index > stack.cardOrder.length) {
        return invalid(`Card index out of range: ${index}`);
      }
      const card: Card = { cardId: command.cardId, title: command.title, elements: [], behaviors: [] };
      const cardOrder = [...stack.cardOrder];
      cardOrder.splice(index, 0, card.cardId);
      return ok({ ...withCard(stack, card), cardOrder });
    }

    case 'RENAME_CARD': {
      const card = has(stack.cards, command.cardId) ? stack.cards[command.cardId] : undefined;
      if (!card) return invalid(`Unknown card: ${command.cardId}`);
      if (blank(command.title)) return invalid('Card title must not be empty');
      return ok(withCard(stack, { ...card, title: command.title }));
    }

    case 'DUPLICATE_CARD': {
      const source = has(stack.cards, command.cardId) ? stack.cards[command.cardId] : undefined;
      if (!source) return invalid(`Unknown card: ${command.cardId}`);
      if (command.newCardId.length === 0) return invalid('newCardId must not be empty');
      if (has(stack.cards, command.newCardId)) return invalid(`Card id already exists: ${command.newCardId}`);
      // Element and behavior ids are scoped per card, so they are kept as-is in the copy.
      const copy: Card = {
        ...deepClone(source),
        cardId: command.newCardId,
        title: `${source.title} copy`,
      };
      const cardOrder = [...stack.cardOrder];
      cardOrder.splice(cardOrder.indexOf(source.cardId) + 1, 0, copy.cardId);
      return ok({ ...withCard(stack, copy), cardOrder });
    }

    case 'REORDER_CARDS': {
      const next = command.cardOrder;
      const unique = new Set(next);
      if (
        next.length !== stack.cardOrder.length ||
        unique.size !== next.length ||
        next.some((id) => !has(stack.cards, id))
      ) {
        return invalid('cardOrder must be a permutation of the existing card ids');
      }
      return ok({ ...stack, cardOrder: [...next] });
    }

    case 'DELETE_CARD': {
      if (!has(stack.cards, command.cardId)) return invalid(`Unknown card: ${command.cardId}`);
      if (stack.cardOrder.length <= 1) return invalid('Cannot delete the last card');
      const cardOrder = stack.cardOrder.filter((id) => id !== command.cardId);
      const remaining = Object.values(stack.cards).filter((c) => c.cardId !== command.cardId);
      const cards = Object.fromEntries(
        scrubCards(remaining, (a) => a.type === 'navigate' && a.cardId === command.cardId).map((c) => [
          c.cardId,
          c,
        ]),
      );
      const entryCardId = stack.entryCardId === command.cardId ? (cardOrder[0] as string) : stack.entryCardId;
      return ok({ ...stack, cards, cardOrder, entryCardId });
    }

    case 'ADD_ELEMENT': {
      const card = has(stack.cards, command.cardId) ? stack.cards[command.cardId] : undefined;
      if (!card) return invalid(`Unknown card: ${command.cardId}`);
      const { element } = command;
      if (element.elementId.length === 0) return invalid('elementId must not be empty');
      if (findElement(card, element.elementId))
        return invalid(`Element id already exists: ${element.elementId}`);
      const top = card.elements.reduce((max, e) => Math.max(max, e.layout.zIndex), -1);
      const placed: Element = deepClone({ ...element, layout: { ...element.layout, zIndex: top + 1 } });
      return ok(withCard(stack, { ...card, elements: [...card.elements, placed] }));
    }

    case 'UPDATE_ELEMENT': {
      const card = has(stack.cards, command.cardId) ? stack.cards[command.cardId] : undefined;
      if (!card) return invalid(`Unknown card: ${command.cardId}`);
      const current = findElement(card, command.elementId);
      if (!current) return invalid(`Unknown element: ${command.elementId}`);
      const { patch } = command;
      if (patch.name !== undefined && blank(patch.name)) return invalid('Element name must not be empty');
      const merged: Record<string, unknown> = { ...current.properties, ...patch.properties };
      for (const [k, v] of Object.entries(patch.properties ?? {})) if (v === null) delete merged[k];
      const next: Element = {
        ...current,
        ...(patch.name === undefined ? {} : { name: patch.name }),
        properties: merged,
        layout: { ...current.layout, ...patch.layout },
      };
      if (patch.assetId === null) delete next.assetId;
      else if (patch.assetId !== undefined) next.assetId = patch.assetId;
      return ok(withCard(stack, replaceElement(card, deepClone(next))));
    }

    case 'DELETE_ELEMENT': {
      const card = has(stack.cards, command.cardId) ? stack.cards[command.cardId] : undefined;
      if (!card) return invalid(`Unknown card: ${command.cardId}`);
      if (!findElement(card, command.elementId)) return invalid(`Unknown element: ${command.elementId}`);
      const kept = { ...card, elements: card.elements.filter((e) => e.elementId !== command.elementId) };
      const [scrubbed] = scrubCards(
        [kept],
        (a) =>
          (a.type === 'setText' || a.type === 'show' || a.type === 'hide') &&
          a.elementId === command.elementId,
      );
      return ok(withCard(stack, scrubbed as Card));
    }

    case 'REORDER_ELEMENT': {
      const card = has(stack.cards, command.cardId) ? stack.cards[command.cardId] : undefined;
      if (!card) return invalid(`Unknown card: ${command.cardId}`);
      const ordered = byZ(card.elements);
      const from = ordered.findIndex((e) => e.elementId === command.elementId);
      if (from < 0) return invalid(`Unknown element: ${command.elementId}`);
      const last = ordered.length - 1;
      const to = {
        front: last,
        back: 0,
        forward: Math.min(from + 1, last),
        backward: Math.max(from - 1, 0),
      }[command.placement];
      const moved = [...ordered];
      const [item] = moved.splice(from, 1);
      moved.splice(to, 0, item as Element);
      const zById = new Map(moved.map((e, z) => [e.elementId, z]));
      const elements = card.elements.map((e) => ({
        ...e,
        layout: { ...e.layout, zIndex: zById.get(e.elementId) as number },
      }));
      return ok(withCard(stack, { ...card, elements }));
    }

    case 'UPDATE_BEHAVIOR': {
      const card = has(stack.cards, command.cardId) ? stack.cards[command.cardId] : undefined;
      if (!card) return invalid(`Unknown card: ${command.cardId}`);
      const behaviors = deepClone(command.behaviors);
      if (command.elementId === undefined) return ok(withCard(stack, { ...card, behaviors }));
      const el = findElement(card, command.elementId);
      if (!el) return invalid(`Unknown element: ${command.elementId}`);
      return ok(withCard(stack, replaceElement(card, { ...el, behaviors })));
    }

    case 'UPDATE_STATE_SCHEMA':
      return ok({ ...stack, stateSchema: deepClone(command.stateSchema) });

    case 'REGISTER_ASSET': {
      const { asset } = command;
      if (has(stack.assetRegistry, asset.assetId))
        return invalid(`Asset id already exists: ${asset.assetId}`);
      if (Object.values(stack.assetRegistry).some((a) => a.relativePath === asset.relativePath)) {
        return invalid(`Asset path already in use: ${asset.relativePath}`);
      }
      return ok({ ...stack, assetRegistry: { ...stack.assetRegistry, [asset.assetId]: { ...asset } } });
    }

    case 'SET_CARD_BACKGROUND': {
      const card = has(stack.cards, command.cardId) ? stack.cards[command.cardId] : undefined;
      if (!card) return invalid(`Unknown card: ${command.cardId}`);
      const { background: _drop, ...rest } = card;
      void _drop;
      return ok(
        withCard(stack, command.background === null ? rest : { ...rest, background: command.background }),
      );
    }
    case 'SET_VIEWPORT': {
      const { width, height } = command;
      if (
        !Number.isFinite(width) ||
        !Number.isFinite(height) ||
        width < 120 ||
        height < 120 ||
        width > 8000 ||
        height > 8000
      ) {
        return invalid('Viewport width and height must be between 120 and 8000');
      }
      return ok({ ...stack, viewportDefaults: { width: Math.round(width), height: Math.round(height) } });
    }
    case 'REMOVE_ASSET': {
      if (!has(stack.assetRegistry, command.assetId)) return invalid(`Unknown asset: ${command.assetId}`);
      const used = Object.values(stack.cards).some((c) =>
        c.elements.some((e) => e.assetId === command.assetId),
      );
      if (used) return invalid(`Asset ${command.assetId} is still used by an element`);
      const assetRegistry = { ...stack.assetRegistry };
      delete assetRegistry[command.assetId];
      return ok({ ...stack, assetRegistry });
    }
    case 'REPLACE_ASSET': {
      const { asset } = command;
      if (!has(stack.assetRegistry, asset.assetId)) return invalid(`Unknown asset: ${asset.assetId}`);
      const clash = Object.values(stack.assetRegistry).some(
        (a) => a.assetId !== asset.assetId && a.relativePath === asset.relativePath,
      );
      if (clash) return invalid(`Asset path already in use: ${asset.relativePath}`);
      return ok({ ...stack, assetRegistry: { ...stack.assetRegistry, [asset.assetId]: { ...asset } } });
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
