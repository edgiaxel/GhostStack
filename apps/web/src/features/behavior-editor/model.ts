import { applyCommand } from '@ghoststack/domain';
import { KEYWORDS, TRIGGER_NAMES, locateDomainIssue, parseGhostScript } from '@ghoststack/behavior';
import type { GhostScriptIssue, GhostScriptRefs } from '@ghoststack/behavior';
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
  /** Scalar variables (text, number, true / false). */
  stateKeys: string[];
  /** List variables. */
  listKeys: string[];
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

export function defaultExpr(
  kind: Expr['kind'],
  keys: string[],
  previous?: Expr,
  listKeys: string[] = [],
): Expr {
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
      return { kind: 'listLength', key: listKeys[0] ?? '' };
    case 'listItem':
      return { kind: 'listItem', key: listKeys[0] ?? '', index: lit(0) };
    case 'listJoin':
      return { kind: 'listJoin', key: listKeys[0] ?? '', separator: ', ' };
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
      return { type, key: ctx.listKeys[0] ?? '', value: lit('') };
    case 'listRemove':
      return { type, key: ctx.listKeys[0] ?? '', index: lit(0) };
    case 'listSet':
      return { type, key: ctx.listKeys[0] ?? '', index: lit(0), value: lit('') };
    case 'listClear':
      return { type, key: ctx.listKeys[0] ?? '' };
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
  const keys = Object.keys(stack.stateSchema);
  const isList = (k: string): boolean => stack.stateSchema[k]?.type === 'list';
  return {
    cards: stack.cardOrder.map((id) => ({ id, title: stack.cards[id]?.title ?? id })),
    elements: (card?.elements ?? []).map((e) => ({ id: e.elementId, name: e.name, type: e.type })),
    stateKeys: keys.filter((k) => !isList(k)),
    listKeys: keys.filter(isList),
    typing,
  };
}

/** Names GhostScript may use for cards and elements of the current card. */
export function scriptRefs(ctx: EditorContext): GhostScriptRefs {
  return {
    cards: ctx.cards.map((c) => ({ id: c.id, name: c.title })),
    elements: ctx.elements.map((e) => ({ id: e.id, name: e.name })),
  };
}

/* Sentences */

const nameOf = (list: { id: string; name: string }[], id: string): string =>
  list.find((x) => x.id === id)?.name || id || '(none)';

export function describeExpr(e: Expr, ctx: EditorContext): string {
  switch (e.kind) {
    case 'literal':
      return typeof e.value === 'string' ? `"${e.value}"` : String(e.value);
    case 'state':
      return e.key || '(no variable)';
    case 'not':
      return `not ${describeExpr(e.arg, ctx)}`;
    case 'binary':
      return `${describeExpr(e.left, ctx)} ${e.op} ${describeExpr(e.right, ctx)}`;
    case 'listLength':
      return `the number of items in ${e.key || '(no list)'}`;
    case 'listItem':
      return `item ${describeExpr(e.index, ctx)} of ${e.key || '(no list)'}`;
    case 'listJoin':
      return `${e.key || '(no list)'} as text`;
  }
}

export function describeAction(a: ActionNode, ctx: EditorContext): string {
  const x = (e: Expr): string => describeExpr(e, ctx);
  switch (a.type) {
    case 'navigate':
      return `go to card "${ctx.cards.find((c) => c.id === a.cardId)?.title || a.cardId || '(none)'}"`;
    case 'setState':
      return `set ${a.key || '(no variable)'} to ${x(a.value)}`;
    case 'setText':
      return `set the text of "${nameOf(ctx.elements, a.elementId)}" to ${x(a.value)}`;
    case 'show':
      return `show "${nameOf(ctx.elements, a.elementId)}"`;
    case 'hide':
      return `hide "${nameOf(ctx.elements, a.elementId)}"`;
    case 'if':
      return `if ${x(a.condition)}, ${describeActions(a.then, ctx)}${
        a.else.length > 0 ? `, otherwise ${describeActions(a.else, ctx)}` : ''
      }`;
    case 'nextCard':
      return 'go to the next card';
    case 'prevCard':
      return 'go to the previous card';
    case 'listAdd':
      return `add ${x(a.value)} to ${a.key || '(no list)'}`;
    case 'listRemove':
      return `remove item ${x(a.index)} from ${a.key || '(no list)'}`;
    case 'listSet':
      return `set item ${x(a.index)} of ${a.key || '(no list)'} to ${x(a.value)}`;
    case 'listClear':
      return `clear ${a.key || '(no list)'}`;
  }
}

export function describeActions(actions: ActionNode[], ctx: EditorContext): string {
  return actions.length === 0 ? 'do nothing' : actions.map((a) => describeAction(a, ctx)).join(', then ');
}

/** One sentence for a behavior, for example "When Button 1 is clicked, set score to score + 1". */
export function describeBehavior(b: Behavior, ctx: EditorContext, ownerName: string): string {
  const when =
    b.trigger === 'card.enter'
      ? 'When the card opens'
      : b.trigger === 'element.click'
        ? `When ${ownerName} is clicked`
        : `When ${ownerName} changes`;
  const only =
    b.conditions.length > 0 ? `, only if ${b.conditions.map((c) => describeExpr(c, ctx)).join(' and ')}` : '';
  const text = `${when}${only}, ${describeActions(b.actions, ctx)}`;
  return b.enabled ? text : `${text} (disabled)`;
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
export function checkScript(
  source: string,
  stack: Stack,
  owner: Owner,
  now: string,
  refs: GhostScriptRefs = {},
): ScriptCheck {
  const parsed = parseGhostScript(source, refs);
  if (!parsed.ok) return { issues: parsed.issues };
  const message = dryRun(stack, owner, parsed.behaviors, now);
  if (message) return { issues: [{ ...locateDomainIssue(source, message), message }] };
  return { behaviors: parsed.behaviors, issues: [] };
}

/** The name when it is unique among `list`, else the id. Same rule as the printer. */
function refText<T extends { id: string }>(list: T[], id: string, field: 'title' | 'name'): string {
  const item = list.find((x) => x.id === id) as (T & Record<string, string>) | undefined;
  const name = item?.[field] ?? '';
  const taken =
    list.some((x) => x.id === name) ||
    list.filter((x) => (x as T & Record<string, string>)[field] === name).length !== 1;
  return name === '' || taken ? id : name;
}

/** Words offered by autocomplete inside GhostScript. */
export function completionWords(ctx: EditorContext): { label: string; detail: string }[] {
  return [
    ...KEYWORDS.map((label) => ({ label: label as string, detail: 'keyword' })),
    ...['next card', 'previous card', 'list add', 'list remove', 'list set', 'list clear'].map((label) => ({
      label,
      detail: 'action',
    })),
    ...TRIGGER_NAMES.map((label) => ({ label: label as string, detail: 'trigger' })),
    ...ctx.stateKeys.map((label) => ({ label, detail: 'variable' })),
    ...ctx.listKeys.map((label) => ({ label, detail: 'list' })),
    ...ctx.cards.map((c) => ({ label: JSON.stringify(refText(ctx.cards, c.id, 'title')), detail: `card` })),
    ...ctx.elements.map((e) => ({
      label: JSON.stringify(refText(ctx.elements, e.id, 'name')),
      detail: `element ${e.type}`,
    })),
  ];
}
