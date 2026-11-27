import { isAllowedCommandType } from '@ghoststack/shared-contracts';
import type { AIPlan, AIPlanStep, Stack } from '@ghoststack/shared-contracts';

export type CardChangeState = 'new' | 'changed' | 'removed';

/** Everything a plan does to one Card. Plain data: no functions, no ids in `sentences`. */
export interface CardChangeGroup {
  cardId: string;
  /** Display title: the new title, or the current title in the Stack. */
  title: string;
  state: CardChangeState;
  elementsAdded: number;
  elementsChanged: number;
  elementsRemoved: number;
  behaviorChanges: number;
  /** Plain sentences for the review screen. */
  sentences: string[];
  /** Ids of the steps that contribute to this group. */
  stepIds: string[];
}

export interface StackChangeGroup {
  stateSchemaChanged: boolean;
  cardOrderChanged: boolean;
  sentences: string[];
  stepIds: string[];
}

export interface PlanSummary {
  /** The plan's own one-line summary. */
  summary: string;
  stepCount: number;
  cards: CardChangeGroup[];
  stack: StackChangeGroup;
}

const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/** Collapses whitespace and bounds length so a title cannot break the layout of a sentence. */
const label = (text: string): string => {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > 60 ? `${flat.slice(0, 57)}...` : flat;
};

interface Draft {
  cardId: string;
  title: string;
  created: boolean;
  removed: boolean;
  renamedTo?: string;
  recolored: boolean;
  duplicatedFrom?: string;
  added: number;
  changed: Set<string>;
  removedElements: number;
  behaviors: number;
  stepIds: string[];
}

/** The Card a step belongs to for review, or undefined for a Stack-level step. */
function targetCardId(step: AIPlanStep): string | undefined {
  const c = step.command;
  if (!isAllowedCommandType(c.type)) return undefined;
  switch (c.type) {
    case 'DUPLICATE_CARD':
      return c.newCardId;
    case 'REORDER_CARDS':
    case 'UPDATE_STATE_SCHEMA':
      return undefined;
    default:
      return c.cardId;
  }
}

/**
 * Groups plan steps by the Card they change, plus one Stack-level group. Every step lands in exactly
 * one group. Pure: reads `stack` and `plan`, mutates neither, returns plain data.
 */
export function summarizePlan(stack: Stack, plan: AIPlan): PlanSummary {
  const drafts = new Map<string, Draft>();
  const stackGroup: StackChangeGroup = {
    stateSchemaChanged: false,
    cardOrderChanged: false,
    sentences: [],
    stepIds: [],
  };

  const draftFor = (cardId: string): Draft => {
    let draft = drafts.get(cardId);
    if (!draft) {
      const existing = Object.prototype.hasOwnProperty.call(stack.cards, cardId)
        ? stack.cards[cardId]
        : undefined;
      draft = {
        cardId,
        title: existing?.title ?? '',
        created: false,
        removed: false,
        recolored: false,
        added: 0,
        changed: new Set(),
        removedElements: 0,
        behaviors: 0,
        stepIds: [],
      };
      drafts.set(cardId, draft);
    }
    return draft;
  };

  for (const step of plan.steps) {
    const c = step.command;
    const cardId = targetCardId(step);
    if (cardId === undefined) {
      stackGroup.stepIds.push(step.id);
      if (c.type === 'UPDATE_STATE_SCHEMA') stackGroup.stateSchemaChanged = true;
      if (c.type === 'REORDER_CARDS') stackGroup.cardOrderChanged = true;
      continue;
    }
    const d = draftFor(cardId);
    d.stepIds.push(step.id);
    switch (c.type) {
      case 'ADD_CARD':
        d.created = true;
        d.title = c.title;
        break;
      case 'DUPLICATE_CARD': {
        d.created = true;
        d.duplicatedFrom = label(
          Object.prototype.hasOwnProperty.call(stack.cards, c.cardId)
            ? (stack.cards[c.cardId]?.title ?? '')
            : '',
        );
        const source = Object.prototype.hasOwnProperty.call(stack.cards, c.cardId)
          ? stack.cards[c.cardId]
          : undefined;
        if (source) {
          d.title = `${source.title} copy`;
          d.added += source.elements.length;
        }
        break;
      }
      case 'RENAME_CARD':
        d.renamedTo = c.title;
        break;
      case 'DELETE_CARD':
        d.removed = true;
        break;
      case 'ADD_ELEMENT':
        d.added += 1;
        break;
      case 'UPDATE_ELEMENT':
      case 'REORDER_ELEMENT':
        d.changed.add(c.elementId);
        break;
      case 'DELETE_ELEMENT':
        d.removedElements += 1;
        break;
      case 'UPDATE_BEHAVIOR':
        d.behaviors += 1;
        break;
      case 'SET_CARD_BACKGROUND':
        d.recolored = true;
        break;
      default:
        break;
    }
  }

  const cards: CardChangeGroup[] = [...drafts.values()].map((d) => {
    const title = label(d.title) || 'Untitled';
    const state: CardChangeState = d.created ? 'new' : d.removed ? 'removed' : 'changed';
    const sentences: string[] = [];
    if (state === 'new') {
      const copy =
        d.duplicatedFrom !== undefined ? ` as a copy of ${d.duplicatedFrom || 'another card'}` : '';
      const withElements = d.added > 0 ? ` with ${plural(d.added, 'element')}` : '';
      sentences.push(`Adds a card named ${title}${copy}${withElements}.`);
    } else if (state === 'removed') {
      sentences.push(`Removes the card named ${title}.`);
    } else {
      if (d.renamedTo !== undefined)
        sentences.push(`Renames the card ${title} to ${label(d.renamedTo) || 'Untitled'}.`);
      if (d.added > 0) sentences.push(`Adds ${plural(d.added, 'element')} to ${title}.`);
      if (d.changed.size > 0) sentences.push(`Changes ${plural(d.changed.size, 'element')} on ${title}.`);
      if (d.removedElements > 0)
        sentences.push(`Removes ${plural(d.removedElements, 'element')} from ${title}.`);
    }
    if (state !== 'removed') {
      if (d.behaviors > 0) sentences.push(`Changes how ${title} behaves when people use it.`);
      if (d.recolored) sentences.push(`Changes the background of ${title}.`);
      if (state === 'new' && d.renamedTo !== undefined)
        sentences.push(`Names it ${label(d.renamedTo) || 'Untitled'}.`);
    }
    if (sentences.length === 0) sentences.push(`Updates the card named ${title}.`);
    return {
      cardId: d.cardId,
      title,
      state,
      elementsAdded: d.added,
      elementsChanged: d.changed.size,
      elementsRemoved: d.removedElements,
      behaviorChanges: d.behaviors,
      sentences,
      stepIds: d.stepIds,
    };
  });

  if (stackGroup.stateSchemaChanged) stackGroup.sentences.push('Changes the variables the app remembers.');
  if (stackGroup.cardOrderChanged) stackGroup.sentences.push('Changes the order of the cards.');

  return { summary: plan.summary, stepCount: plan.steps.length, cards, stack: stackGroup };
}
