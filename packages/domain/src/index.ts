import { DEFAULT_VIEWPORT, FORMAT_VERSION } from '@ghoststack/shared-contracts';
import type { Stack } from '@ghoststack/shared-contracts';

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

export { validateStack } from './validate';
export { applyCommand } from './apply-command';
export { findCardReferences, listBehaviors, walkActions, walkExpr } from './behavior-refs';
export type { BehaviorOwner, CardReference } from './behavior-refs';
