import { applyCommand } from '@ghoststack/domain';
import { parseGhostScript } from '@ghoststack/behavior';
import type { GhostScriptIssue } from '@ghoststack/behavior';
import type {
  ActionNode,
  Behavior,
  ElementType,
  Expr,
  Stack,
  StateValue,
  Trigger,
} from '@ghoststack/shared-contracts';

/** Lookup data every block editor needs. Built once per render from the Stack. */
export interface EditorContext {
  cards: { id: string; title: string }[];
  elements: { id: string; name: string; type: ElementType }[];
  stateKeys: string[];
  /** Call right before an `onChange` that comes from typing, so it joins one undo step. */
  typing: () => void;
}

export type Owner = { cardId: string; elementId?: string };

export function allowedTriggers(ownerType: ElementType | 'card'): Trigger[] {
  if (ownerType === 'card') return ['card.enter'];
  return ownerType === 'input' ? ['element.click', 'element.change'] : ['element.click'];
}

export const ACTION_LABELS = {
  navigate: 'Go to card',
  setState: 'Set variable',
  setText: 'Set text',
  show: 'Show element',
  hide: 'Hide element',
  if: 'If / else',
  nextCard: 'Go to next card',
  prevCard: 'Go to previous card',
  listAdd: 'Add to list',
  listRemove: 'Remove from list',
  listSet: 'Set list item',
  listClear: 'Clear list',
} as const;

export const TRIGGER_LABELS: Record<Trigger, string> = {
  'card.enter': 'When the card opens',
  'element.click': 'When clicked',
  'element.change': 'When the value changes',
};

export const OPERATORS = ['+', '-', '*', '/', '%', '==', '!=', '<', '<=', '>', '>=', 'and', 'or'] as const;

export const lit = (value: StateValue): Expr => ({ kind: 'literal', value });

export function defaultExpr(kind: Expr['kind'], keys: string[], previous?: Expr): Expr {
  switch (kind) {
    case 'literal':
      return previous?.kind === 'literal' ? previous : lit(true);
    case 'state':
      return { kind: 'state', key: keys[0] ?? '' };
    case 'not':
      return { kind: 'not', arg: previous ?? lit(true) };
    case 'binary':
      return { kind: 'binary', op: '==', left: previous ?? lit(0), right: lit(0) };
    case 'listLength':
      return { kind: 'listLength', key: keys[0] ?? '' };
    case 'listItem':
      return { kind: 'listItem', key: keys[0] ?? '', index: lit(0) };
    case 'listJoin':
      return { kind: 'listJoin', key: keys[0] ?? '', separator: ', ' };
  }
}

export function defaultAction(type: ActionNode['type'], ctx: EditorContext): ActionNode {
  switch (type) {
    case 'navigate':
      return { type, cardId: ctx.cards[0]?.id ?? '' };
    case 'setState':
      return { type, key: ctx.stateKeys[0] ?? '', value: lit(0) };
    case 'setText':
      return {
        type,
        elementId: ctx.elements.find((e) => e.type === 'text' || e.type === 'button')?.id ?? '',
        value: lit(''),
      };
    case 'show':
    case 'hide':
      return { type, elementId: ctx.elements[0]?.id ?? '' };
    case 'if':
      return { type, condition: lit(true), then: [], else: [] };
    case 'nextCard':
    case 'prevCard':
      return { type };
    case 'listAdd':
      return { type, key: ctx.stateKeys[0] ?? '', value: lit('') };
    case 'listRemove':
      return { type, key: ctx.stateKeys[0] ?? '', index: lit(0) };
    case 'listSet':
      return { type, key: ctx.stateKeys[0] ?? '', index: lit(0), value: lit('') };
    case 'listClear':
      return { type, key: ctx.stateKeys[0] ?? '' };
  }
}

export function moveItem<T>(list: readonly T[], from: number, delta: -1 | 1): T[] {
  const to = from + delta;
  if (from < 0 || from >= list.length || to < 0 || to >= list.length) return [...list];
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}

export const replaceAt = <T>(list: readonly T[], index: number, value: T): T[] =>
  list.map((x, i) => (i === index ? value : x));
export const removeAt = <T>(list: readonly T[], index: number): T[] => list.filter((_, i) => i !== index);

export function newBehavior(id: string, ownerType: ElementType | 'card'): Behavior {
  return {
    behaviorId: id,
    trigger: allowedTriggers(ownerType)[0] as Trigger,
    conditions: [],
    actions: [],
    enabled: true,
  };
}

export function buildContext(stack: Stack, cardId: string, typing: () => void): EditorContext {
  const card = stack.cards[cardId];
  return {
    cards: stack.cardOrder.map((id) => ({ id, title: stack.cards[id]?.title ?? id })),
    elements: (card?.elements ?? []).map((e) => ({ id: e.elementId, name: e.name, type: e.type })),
    stateKeys: Object.keys(stack.stateSchema),
    typing,
  };
}

/** Read-only check: would the domain accept these behaviors? Returns the rejection message. */
export function dryRun(stack: Stack, owner: Owner, behaviors: Behavior[], now: string): string | undefined {
  const r = applyCommand(
    stack,
    {
      type: 'UPDATE_BEHAVIOR',
      cardId: owner.cardId,
      ...(owner.elementId === undefined ? {} : { elementId: owner.elementId }),
      behaviors,
    },
    now,
  );
  return r.ok ? undefined : r.error.message;
}

export interface ScriptCheck {
  behaviors?: Behavior[];
  issues: GhostScriptIssue[];
}

/** Parser errors first, then domain rejections (unknown cards, elements, variables, triggers). */
export function checkScript(source: string, stack: Stack, owner: Owner, now: string): ScriptCheck {
  const parsed = parseGhostScript(source);
  if (!parsed.ok) return { issues: parsed.issues };
  const message = dryRun(stack, owner, parsed.behaviors, now);
  if (message) return { issues: [{ line: 1, column: 1, message }] };
  return { behaviors: parsed.behaviors, issues: [] };
}

/** Words offered by autocomplete inside GhostScript. */
export function completionWords(ctx: EditorContext): { label: string; detail: string }[] {
  return [
    ...[
      'behavior',
      'on',
      'disabled',
      'when',
      'go',
      'set',
      'text',
      'show',
      'hide',
      'if',
      'else',
      'and',
      'or',
      'not',
      'true',
      'false',
    ].map((label) => ({ label, detail: 'keyword' })),
    ...(['card.enter', 'element.click', 'element.change'] as const).map((label) => ({
      label,
      detail: 'trigger',
    })),
    ...ctx.stateKeys.map((label) => ({ label, detail: 'variable' })),
    ...ctx.cards.map((c) => ({ label: JSON.stringify(c.id), detail: `card ${c.title}` })),
    ...ctx.elements.map((e) => ({ label: JSON.stringify(e.id), detail: `element ${e.name}` })),
  ];
}
