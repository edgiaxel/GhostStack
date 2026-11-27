import { walkActions } from '@ghoststack/domain';
import { err, ok } from '@ghoststack/shared-contracts';
import type {
  Behavior,
  Card,
  ContextScope,
  GhostError,
  ProjectContext,
  Result,
  Stack,
} from '@ghoststack/shared-contracts';
import { getRegisteredActions } from './actions';
import { clone } from './util';

/** Default context size in characters of JSON text. A tunable default, not an approved limit. */
export const DEFAULT_CONTEXT_BUDGET = 24_000;

export interface ContextOptions {
  /** Maximum length of `JSON.stringify(context)`. */
  budget?: number;
}

/** Longest string kept in `detail`. Longer text is cut so one element cannot use the budget. */
const MAX_STRING = 400;
const DATA_URL = /data:[a-z0-9.+/-]*(?:;[a-z0-9=.+-]+)*,[^\s"'\\]*/gi;
const OMITTED = '[data omitted]';

/** Removes data URLs (inline bytes) and bounds string length. Applies to keys and values. */
function scrub(value: unknown): unknown {
  if (typeof value === 'string') {
    const text = value.replace(DATA_URL, OMITTED);
    return text.length > MAX_STRING ? `${text.slice(0, MAX_STRING)}...` : text;
  }
  if (Array.isArray(value)) return value.map(scrub);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k.replace(DATA_URL, OMITTED)] = scrub(v);
    }
    return out;
  }
  return value;
}

const own = <T>(record: Record<string, T>, key: string): T | undefined =>
  Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;

function navigationTargets(card: Card): string[] {
  const targets = new Set<string>();
  const collect = (behaviors: Behavior[]): void => {
    for (const b of behaviors) {
      walkActions(b.actions, (a) => {
        if (a.type === 'navigate') targets.add(a.cardId);
      });
    }
  };
  collect(card.behaviors);
  for (const el of card.elements) collect(el.behaviors);
  return [...targets].sort();
}

const behaviorSummary = (b: Behavior): unknown => {
  const types: string[] = [];
  walkActions(b.actions, (a) => types.push(a.type));
  return { behaviorId: b.behaviorId, trigger: b.trigger, enabled: b.enabled, actionTypes: types };
};

/** Full detail of one Card. `compact` replaces behaviors with summaries. */
function cardDetail(card: Card, compact: boolean): unknown {
  const behaviors = (list: Behavior[]): unknown[] => (compact ? list.map(behaviorSummary) : list);
  return scrub({
    cardId: card.cardId,
    title: card.title,
    ...(card.background !== undefined ? { background: card.background } : {}),
    elements: card.elements.map((el) => ({
      elementId: el.elementId,
      type: el.type,
      name: el.name,
      properties: el.properties,
      layout: el.layout,
      ...(el.assetId !== undefined ? { assetId: el.assetId } : {}),
      behaviors: behaviors(el.behaviors),
    })),
    behaviors: behaviors(card.behaviors),
  });
}

const textLength = (ctx: ProjectContext): number => JSON.stringify(ctx).length;

/** Sets `charCount` to the length of the JSON text that includes the `charCount` field itself. */
function withCharCount(ctx: ProjectContext): ProjectContext {
  let count = 0;
  for (let i = 0; i < 6; i++) {
    const length = textLength({ ...ctx, charCount: count });
    if (length === count) break;
    count = Math.max(length, count);
  }
  return { ...ctx, charCount: count };
}

/**
 * Bounded context for a provider. Truncation order when over budget, always the same:
 * 1. drop `detail` Cards from the end, 2. turn the remaining behaviors into summaries,
 * 3. drop `detail`, 4. cut the Card list and `cardOrder` from the end, 5. empty `stateSchema`.
 * Fixed sections (title, registered actions) are never cut, so a budget below their size is not met;
 * `truncated` is true then and `charCount` shows the real size.
 */
export function buildContext(
  stack: Stack,
  scope: ContextScope,
  options: ContextOptions = {},
): Result<ProjectContext, GhostError> {
  const budget = options.budget ?? DEFAULT_CONTEXT_BUDGET;
  const source = clone(stack);
  if (scope.kind === 'card' && own(source.cards, scope.cardId) === undefined) {
    return err({
      code: 'INVALID_AI_PLAN',
      message: `Card ${scope.cardId.slice(0, 128)} is not in the Stack`,
    });
  }

  const order = source.cardOrder.filter((id) => own(source.cards, id) !== undefined);
  const cards = order.map((id) => source.cards[id] as Card);
  const detailCards = scope.kind === 'card' ? [source.cards[scope.cardId] as Card] : cards;

  let truncated = false;
  const make = (
    detail: unknown[],
    cardList: ProjectContext['cards'],
    cardOrder: string[],
    stateSchema: Record<string, unknown>,
  ): ProjectContext =>
    withCharCount({
      schemaVersion: 1,
      scope: clone(scope),
      stack: {
        title: scrub(source.title) as string,
        entryCardId: source.entryCardId,
        cardOrder,
        stateSchema,
        viewport: { width: source.viewportDefaults.width, height: source.viewportDefaults.height },
      },
      cards: cardList,
      detail,
      registeredActions: getRegisteredActions(),
      truncated,
      charCount: 0,
    });

  const cardList: ProjectContext['cards'] = cards.map((c) => ({
    cardId: c.cardId,
    title: scrub(c.title) as string,
    elementCount: c.elements.length,
    navigatesTo: navigationTargets(c),
  }));
  const stateSchema = scrub(source.stateSchema) as Record<string, unknown>;
  const fits = (ctx: ProjectContext): boolean => ctx.charCount <= budget;

  let detail = detailCards.map((c) => cardDetail(c, false));
  let ctx = make(detail, cardList, order, stateSchema);
  if (fits(ctx)) return ok(ctx);

  truncated = true;
  while (detail.length > 1 && !fits(ctx)) {
    detail = detail.slice(0, -1);
    ctx = make(detail, cardList, order, stateSchema);
  }
  if (!fits(ctx)) {
    detail = detailCards.slice(0, detail.length).map((c) => cardDetail(c, true));
    ctx = make(detail, cardList, order, stateSchema);
  }
  if (!fits(ctx)) {
    ctx = make([], cardList, order, stateSchema);
  }
  let keep = cardList.length;
  while (!fits(ctx) && keep > 0) {
    keep = Math.max(0, keep - Math.max(1, Math.ceil(keep / 10)));
    ctx = make([], cardList.slice(0, keep), order.slice(0, keep), stateSchema);
  }
  if (!fits(ctx)) ctx = make([], cardList.slice(0, keep), order.slice(0, keep), {});
  return ok(ctx);
}
