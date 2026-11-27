import { ACTION_TYPES } from '@ghoststack/shared-contracts';

type ActionName = (typeof ACTION_TYPES)[number];

/**
 * One line per runtime action, keyed by the contract's `ACTION_TYPES`. The `Record` type makes the
 * build fail when an action is added to the contract without a description here.
 */
const DESCRIPTIONS: Record<ActionName, string> = {
  navigate: 'Go to a Card. Arguments: cardId (an existing Card id).',
  setState: 'Set a state variable. Arguments: key (a declared variable), value (an expression).',
  setText: 'Replace the text of an Element. Arguments: elementId, value (an expression).',
  show: 'Show a hidden Element. Arguments: elementId.',
  hide: 'Hide an Element. Arguments: elementId.',
  if: 'Run one of two action lists. Arguments: condition (an expression), then (actions), else (actions).',
  nextCard: 'Go to the next Card in card order. No arguments. Does nothing on the last Card.',
  prevCard: 'Go to the previous Card in card order. No arguments. Does nothing on the first Card.',
  listAdd: 'Append an item to a list variable. Arguments: key (a list variable), value (an expression).',
  listRemove:
    'Remove the item at a zero-based index. Arguments: key (a list variable), index (an expression).',
  listSet:
    'Replace the item at a zero-based index. Arguments: key, index (an expression), value (an expression).',
  listClear: 'Remove every item of a list variable. Arguments: key (a list variable).',
};

/** Runtime action names with their argument shapes, generated from the shared contract. */
export function getRegisteredActions(): { type: string; description: string }[] {
  return ACTION_TYPES.map((type) => ({ type, description: DESCRIPTIONS[type] }));
}
