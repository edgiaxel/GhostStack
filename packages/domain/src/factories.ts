import { defaultClock } from './clock';
import type { Clock } from './clock';
import { generateId } from './ids';
import type { IdGenerator } from './ids';
import { err, ok } from './result';
import type { Result } from './result';
import { DEFAULT_VIEWPORT, FORMAT_VERSION, MAX_TITLE_CODE_POINTS } from './schemas';
import type { Card, Stack } from './schemas';

export interface FactoryDeps {
  readonly clock: Clock;
  readonly newId: IdGenerator;
}

export const defaultDeps: FactoryDeps = { clock: defaultClock, newId: generateId };

export type DomainError = {
  code: 'INVALID_TITLE';
  message: string;
  reason: 'empty' | 'too-long';
};

const INITIAL_CARD_TITLE = 'Card 1';

function checkTitle(title: string): Result<string, DomainError> {
  const trimmed = title.trim();
  const length = Array.from(trimmed).length;
  if (length === 0) {
    return err({ code: 'INVALID_TITLE', reason: 'empty', message: 'Title must not be empty.' });
  }
  if (length > MAX_TITLE_CODE_POINTS) {
    return err({
      code: 'INVALID_TITLE',
      reason: 'too-long',
      message: `Title must be at most ${MAX_TITLE_CODE_POINTS} characters.`,
    });
  }
  return ok(trimmed);
}

export function createCard(
  title: string,
  deps: Partial<FactoryDeps> = {},
): Result<Card, DomainError> {
  const checked = checkTitle(title);
  if (!checked.ok) return checked;
  const { newId } = { ...defaultDeps, ...deps };
  return ok({ cardId: newId('crd'), title: checked.value, elements: [] });
}

export function createStack(
  title: string,
  deps: Partial<FactoryDeps> = {},
): Result<Stack, DomainError> {
  const checked = checkTitle(title);
  if (!checked.ok) return checked;
  const { clock, newId } = { ...defaultDeps, ...deps };

  const now = clock();
  const stackId = newId('stk');
  const cardId = newId('crd');
  const card: Card = { cardId, title: INITIAL_CARD_TITLE, elements: [] };

  return ok({
    stackId,
    title: checked.value,
    formatVersion: FORMAT_VERSION,
    createdAt: now,
    updatedAt: now,
    entryCardId: cardId,
    cardOrder: [cardId],
    cards: { [cardId]: card },
    assetRegistry: {},
    stateSchema: {},
    viewportDefaults: { width: DEFAULT_VIEWPORT.width, height: DEFAULT_VIEWPORT.height },
  });
}
