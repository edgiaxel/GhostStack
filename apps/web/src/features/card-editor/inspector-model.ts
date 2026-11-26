import { resolveLayout } from '@ghoststack/shared-contracts';
import type { ActionNode, Behavior, Layout, Rect, Size, Stack } from '@ghoststack/shared-contracts';

/** Marker for a property whose value differs across the selected elements. */
export const MIXED = Symbol('mixed');
export type Shared<T> = T | typeof MIXED;

/** The common value of `values`, or MIXED when they differ. An empty list yields MIXED. */
export function sharedValue<T>(values: readonly T[]): Shared<T> {
  const [first, ...rest] = values;
  if (values.length === 0) return MIXED;
  return rest.every((v) => Object.is(v, first)) ? (first as T) : MIXED;
}

/** Short instruction that tells the creator how to fix a rejected value. */
export function fixHint(property: string, message: string): string {
  const m = message.toLowerCase();
  if (/color|hex|#/.test(m) || /color|fill|stroke|background/.test(property))
    return 'Use a hex color such as #1a2b3c, or "transparent".';
  if (/number|finite|nan/.test(m)) return 'Enter a plain number.';
  if (/at least|min|too small|negative|positive/.test(m)) return 'Enter a larger value.';
  if (/at most|max|too large|exceed/.test(m)) return 'Enter a smaller value.';
  if (/state|variable/.test(m)) return 'Pick a variable that exists in the state editor.';
  if (/asset|image/.test(m)) return 'Choose the image file again.';
  return 'Change the value and try again. Undo returns to the last good state.';
}

export function withHint(property: string, message: string): string {
  return `${message} ${fixHint(property, message)}`;
}

const TRIGGER_TEXT: Record<Behavior['trigger'], string> = {
  'card.enter': 'When the card opens',
  'element.click': 'When clicked',
  'element.change': 'When the value changes',
};

export function describeAction(action: ActionNode, stack: Stack): string {
  const elementName = (id: string): string =>
    Object.values(stack.cards)
      .flatMap((c) => c.elements)
      .find((e) => e.elementId === id)?.name ?? 'a removed element';
  switch (action.type) {
    case 'navigate':
      return `go to card "${stack.cards[action.cardId]?.title ?? 'a removed card'}"`;
    case 'nextCard':
      return 'go to the next card';
    case 'prevCard':
      return 'go to the previous card';
    case 'setState':
      return `set variable ${action.key}`;
    case 'setText':
      return `change the text of ${elementName(action.elementId)}`;
    case 'show':
      return `show ${elementName(action.elementId)}`;
    case 'hide':
      return `hide ${elementName(action.elementId)}`;
    case 'if':
      return `if a condition holds, run ${action.then.length} action(s), otherwise ${action.else.length}`;
    case 'listAdd':
      return `add an item to list ${action.key}`;
    case 'listRemove':
      return `remove an item from list ${action.key}`;
    case 'listSet':
      return `replace an item in list ${action.key}`;
    case 'listClear':
      return `clear list ${action.key}`;
    default:
      return 'run an action';
  }
}

/** One readable sentence per behavior. */
export function describeBehavior(behavior: Behavior, stack: Stack): string {
  const what = behavior.actions.length
    ? behavior.actions.map((a) => describeAction(a, stack)).join(', then ')
    : 'do nothing yet';
  const off = behavior.enabled ? '' : ' (turned off)';
  const cond = behavior.conditions.length ? ' if its conditions hold' : '';
  return `${TRIGGER_TEXT[behavior.trigger]}${cond}: ${what}${off}.`;
}

/** Where an element lands at `view`, used by the mini previews. */
export function miniRect(layout: Layout, design: Size, view: Size): Rect {
  return resolveLayout(layout, design, view);
}
