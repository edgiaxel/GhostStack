import { ISO_TIMESTAMP } from '../clock';
import { ID_PATTERNS } from '../ids';
import type { IdPrefix } from '../ids';
import { MAX_ASSET_BYTES, MAX_TITLE_CODE_POINTS } from '../schemas';
import type { PathSegment, ValidationError, ValidationErrorCode } from './types';

type Details = Record<string, string | number | undefined>;
type Rec = Record<string, unknown>;

const CHECKSUM_PATTERN = /^sha256:[0-9a-f]{64}$/;
const ASSET_NAME_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;
const ASSET_PREFIX = 'assets/';

// Tolerant accessors: a value of the wrong shape yields undefined and the check is skipped.
const asRecord = (value: unknown): Rec | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Rec) : undefined;
const asArray = (value: unknown): readonly unknown[] | undefined =>
  Array.isArray(value) ? (value as unknown[]) : undefined;
const asString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const byKey = (a: [string, unknown], b: [string, unknown]): number =>
  a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
const sortedEntries = (rec: Rec): [string, unknown][] => Object.entries(rec).sort(byKey);

function exceedsCodePoints(text: string, limit: number): boolean {
  if (text.length <= limit) return false;
  let count = 0;
  for (let i = 0; i < text.length; i += 1) {
    count += 1;
    if (count > limit) return true;
    const unit = text.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff && i + 1 < text.length) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) i += 1;
    }
  }
  return false;
}

export type AssetPathRule =
  'null-char' | 'backslash' | 'absolute' | 'dot-dot' | 'prefix' | 'charset';

export function assetPathViolation(relativePath: string): AssetPathRule | undefined {
  if (relativePath.includes('\u0000')) return 'null-char';
  if (relativePath.includes('\\')) return 'backslash';
  if (relativePath.startsWith('/') || /^[A-Za-z]:/.test(relativePath)) return 'absolute';
  if (relativePath.split('/').includes('..')) return 'dot-dot';
  if (!relativePath.startsWith(ASSET_PREFIX)) return 'prefix';
  const name = relativePath.slice(ASSET_PREFIX.length);
  if (!ASSET_NAME_PATTERN.test(name) || name === '.') return 'charset';
  return undefined;
}

export type AssetSizeRule = 'non-integer' | 'negative' | 'too-large';

export function assetSizeViolation(byteSize: number): AssetSizeRule | undefined {
  if (!Number.isInteger(byteSize)) return 'non-integer';
  if (byteSize < 0) return 'negative';
  if (byteSize > MAX_ASSET_BYTES) return 'too-large';
  return undefined;
}

function isRealTimestamp(value: string): boolean {
  if (!ISO_TIMESTAMP.test(value)) return false;
  const time = Date.parse(value);
  // Round trip rejects calendar overflow such as February 30.
  return !Number.isNaN(time) && new Date(time).toISOString() === value;
}

export function semanticErrors(input: unknown): ValidationError[] {
  const errors: ValidationError[] = [];
  const stack = asRecord(input);
  if (stack === undefined) return errors;

  const add = (
    code: ValidationErrorCode,
    message: string,
    path: readonly PathSegment[],
    details: Details = {},
  ): void => {
    const clean: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(details)) {
      if (value !== undefined) clean[key] = value;
    }
    errors.push({ code, message, path, details: clean });
  };

  const checkId = (
    value: unknown,
    prefix: IdPrefix,
    path: readonly PathSegment[],
    field: string,
  ): void => {
    const text = asString(value);
    if (text !== undefined && !ID_PATTERNS[prefix].test(text)) {
      add('INVALID_ID', `Identifier does not match the ${prefix} pattern.`, path, { field });
    }
  };

  const cards = asRecord(stack['cards']);
  const registry = asRecord(stack['assetRegistry']);

  checkId(stack['stackId'], 'stk', ['stackId'], 'stackId');

  const title = asString(stack['title']);
  if (title !== undefined && exceedsCodePoints(title, MAX_TITLE_CODE_POINTS)) {
    add('TITLE_TOO_LONG', 'Title is longer than 100 characters.', ['title'], { field: 'title' });
  }

  for (const field of ['createdAt', 'updatedAt'] as const) {
    const value = asString(stack[field]);
    if (value !== undefined && !isRealTimestamp(value)) {
      add('TIMESTAMP_INVALID', 'Timestamp is not a valid UTC ISO 8601 value.', [field], { field });
    }
  }

  checkCardReferences(stack, cards, add, checkId);
  if (cards !== undefined) checkCards(cards, registry, add, checkId);
  if (registry !== undefined) checkAssets(registry, add, checkId);

  return errors;
}

type Add = (
  code: ValidationErrorCode,
  message: string,
  path: readonly PathSegment[],
  details?: Details,
) => void;
type CheckId = (
  value: unknown,
  prefix: IdPrefix,
  path: readonly PathSegment[],
  field: string,
) => void;

function checkCardReferences(stack: Rec, cards: Rec | undefined, add: Add, checkId: CheckId): void {
  const cardKeys = cards === undefined ? undefined : new Set(Object.keys(cards));

  const entryCardId = asString(stack['entryCardId']);
  checkId(entryCardId, 'crd', ['entryCardId'], 'entryCardId');
  if (entryCardId !== undefined && cardKeys !== undefined && !cardKeys.has(entryCardId)) {
    add('ENTRY_CARD_NOT_FOUND', 'Entry card does not exist in the stack.', ['entryCardId'], {
      cardId: entryCardId,
    });
  }

  const cardOrder = asArray(stack['cardOrder']);
  if (cardOrder === undefined) return;

  const seen = new Set<string>();
  const reportedDuplicates = new Set<string>();
  cardOrder.forEach((value, index) => {
    const cardId = asString(value);
    if (cardId === undefined) return;
    const path = ['cardOrder', index];
    checkId(cardId, 'crd', path, 'cardOrder');
    if (cardKeys !== undefined && !cardKeys.has(cardId)) {
      add('CARD_ORDER_REFERENCE_NOT_FOUND', 'Card order names a card that does not exist.', path, {
        cardId,
      });
    }
    if (seen.has(cardId) && !reportedDuplicates.has(cardId)) {
      reportedDuplicates.add(cardId);
      add('CARD_ORDER_DUPLICATE', 'Card order lists the same card more than once.', path, {
        cardId,
      });
    }
    seen.add(cardId);
  });

  if (cardKeys !== undefined) {
    for (const cardId of cardKeys) {
      if (!seen.has(cardId)) {
        add('CARD_ORDER_OMITS_CARD', 'Card order does not list an existing card.', ['cardOrder'], {
          cardId,
        });
      }
    }
  }
}

function checkCards(cards: Rec, registry: Rec | undefined, add: Add, checkId: CheckId): void {
  const declaredIds = new Map<string, number>();

  for (const [key, rawCard] of sortedEntries(cards)) {
    checkId(key, 'crd', ['cards', key], 'cards key');
    const card = asRecord(rawCard);
    if (card === undefined) continue;

    const cardId = asString(card['cardId']);
    if (cardId !== undefined) {
      checkId(cardId, 'crd', ['cards', key, 'cardId'], 'cardId');
      declaredIds.set(cardId, (declaredIds.get(cardId) ?? 0) + 1);
      if (cardId !== key) {
        add(
          'CARD_KEY_MISMATCH',
          'Card key differs from the cardId it holds.',
          ['cards', key, 'cardId'],
          {
            cardId,
            key,
          },
        );
      }
    }

    const title = asString(card['title']);
    if (title !== undefined && exceedsCodePoints(title, MAX_TITLE_CODE_POINTS)) {
      add('TITLE_TOO_LONG', 'Title is longer than 100 characters.', ['cards', key, 'title'], {
        field: 'title',
        cardId: key,
      });
    }

    checkElements(key, asArray(card['elements']), registry, add, checkId);
  }

  for (const [cardId, count] of declaredIds) {
    if (count > 1) {
      add('CARD_ID_DUPLICATE', 'More than one card has the same cardId.', ['cards'], { cardId });
    }
  }
}

function checkElements(
  cardId: string,
  elements: readonly unknown[] | undefined,
  registry: Rec | undefined,
  add: Add,
  checkId: CheckId,
): void {
  if (elements === undefined) return;
  const seen = new Set<string>();
  const reportedDuplicates = new Set<string>();

  elements.forEach((rawElement, index) => {
    const element = asRecord(rawElement);
    if (element === undefined) return;
    const base = ['cards', cardId, 'elements', index];

    const elementId = asString(element['elementId']);
    if (elementId !== undefined) {
      checkId(elementId, 'elm', [...base, 'elementId'], 'elementId');
      if (seen.has(elementId) && !reportedDuplicates.has(elementId)) {
        reportedDuplicates.add(elementId);
        add(
          'ELEMENT_ID_DUPLICATE',
          'Card has two elements with the same elementId.',
          [...base, 'elementId'],
          {
            elementId,
            cardId,
          },
        );
      }
      seen.add(elementId);
    }

    if (element['type'] !== 'image') return;
    const assetId = asString(asRecord(element['properties'])?.['assetId']);
    if (assetId === undefined) return;
    const path = [...base, 'properties', 'assetId'];
    checkId(assetId, 'ast', path, 'properties.assetId');
    if (registry !== undefined && !Object.hasOwn(registry, assetId)) {
      add(
        'ELEMENT_ASSET_NOT_FOUND',
        'Image element references an asset that is not registered.',
        path,
        {
          elementId,
          cardId,
          assetId,
        },
      );
    }
  });
}

function checkAssets(registry: Rec, add: Add, checkId: CheckId): void {
  for (const [key, rawAsset] of sortedEntries(registry)) {
    checkId(key, 'ast', ['assetRegistry', key], 'assetRegistry key');
    const asset = asRecord(rawAsset);
    if (asset === undefined) continue;
    const base = ['assetRegistry', key];

    const assetId = asString(asset['assetId']);
    if (assetId !== undefined) {
      checkId(assetId, 'ast', [...base, 'assetId'], 'assetId');
      if (assetId !== key) {
        add(
          'ASSET_KEY_MISMATCH',
          'Asset key differs from the assetId it holds.',
          [...base, 'assetId'],
          {
            assetId,
            key,
          },
        );
      }
    }

    const relativePath = asString(asset['relativePath']);
    const pathRule = relativePath === undefined ? undefined : assetPathViolation(relativePath);
    if (pathRule !== undefined) {
      add(
        'ASSET_PATH_INVALID',
        `Asset path breaks the ${pathRule} rule.`,
        [...base, 'relativePath'],
        {
          assetId: key,
          rule: pathRule,
        },
      );
    }

    const byteSize = asset['byteSize'];
    const sizeRule = typeof byteSize === 'number' ? assetSizeViolation(byteSize) : undefined;
    if (sizeRule !== undefined) {
      add('ASSET_SIZE_INVALID', `Asset size breaks the ${sizeRule} rule.`, [...base, 'byteSize'], {
        assetId: key,
        rule: sizeRule,
      });
    }

    const checksum = asString(asset['checksum']);
    if (checksum !== undefined && !CHECKSUM_PATTERN.test(checksum)) {
      add(
        'ASSET_CHECKSUM_INVALID',
        'Asset checksum is not sha256 followed by 64 lowercase hex digits.',
        [...base, 'checksum'],
        {
          assetId: key,
        },
      );
    }
  }
}
