import { describe, expect, it } from 'vitest';
import { createStack } from '../factories';
import { generateId } from '../ids';
import { MAX_ASSET_BYTES } from '../schemas';
import type { Stack } from '../schemas';
import { assetPathViolation, assetSizeViolation } from './semantic';
import { VALIDATION_ERROR_CODES, isValid } from './types';
import type { ValidationErrorCode, ValidationResult } from './types';
import { validateProject } from './validateProject';

const CHECKSUM = `sha256:${'a'.repeat(64)}`;

interface Fixture {
  stack: Stack;
  cardId: string;
  elementId: string;
  assetId: string;
}

// A valid project with one image element that references one registered asset.
function fixture(): Fixture {
  const created = createStack('Quiz');
  if (!created.ok) throw new Error('expected ok');
  const stack = created.value;
  const cardId = stack.entryCardId;
  const elementId = generateId('elm');
  const assetId = generateId('ast');
  stack.cards[cardId]!.elements.push({
    elementId,
    type: 'image',
    name: 'Logo',
    layout: { x: 0, y: 0, width: 10, height: 10 },
    properties: { assetId, alt: 'Logo' },
  });
  stack.assetRegistry[assetId] = {
    assetId,
    relativePath: 'assets/logo.png',
    mimeType: 'image/png',
    byteSize: 3,
    checksum: CHECKSUM,
  };
  return { stack, cardId, elementId, assetId };
}

// Mutable view of the fixture for fault injection.
type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function codes(result: ValidationResult): ValidationErrorCode[] {
  return result.errors.map((e) => e.code);
}

function only(result: ValidationResult, code: ValidationErrorCode) {
  const matches = result.errors.filter((e) => e.code === code);
  expect(matches).toHaveLength(1);
  return matches[0]!;
}

function deepNest(depth: number): unknown {
  let value: unknown = 'leaf';
  for (let i = 0; i < depth; i += 1) value = { next: value };
  return value;
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

describe('validateProject: valid input', () => {
  it('accepts a factory Stack', () => {
    const created = createStack('Quiz');
    if (!created.ok) throw new Error('expected ok');
    expect(validateProject(created.value)).toEqual({ errors: [] });
  });

  it('accepts a project with an image element and a registered asset', () => {
    expect(isValid(validateProject(fixture().stack))).toBe(true);
  });

  it('accepts a null image assetId, an empty stack title and an astral card title', () => {
    const { stack, cardId, elementId } = fixture();
    const image = stack.cards[cardId]!.elements.find((e) => e.elementId === elementId)!;
    (image.properties as Loose)['assetId'] = null;
    stack.title = '';
    stack.cards[cardId]!.title = '\u{1F47B}'.repeat(100);
    expect(codes(validateProject(stack))).toEqual([]);
  });
});

describe('validateProject: structural phase', () => {
  it('reports MISSING_FIELD for an absent field, with its path', () => {
    const stack: Loose = fixture().stack;
    delete stack['title'];
    const error = only(validateProject(stack), 'MISSING_FIELD');
    expect(error.path).toEqual(['title']);
  });

  it('reports MISSING_FIELD for an absent element type', () => {
    const { stack, cardId } = fixture();
    delete (stack.cards[cardId]!.elements[0] as Loose)['type'];
    const error = only(validateProject(stack), 'MISSING_FIELD');
    expect(error.path).toEqual(['cards', cardId, 'elements', 0, 'type']);
  });

  it('reports MISSING_FIELD for an absent formatVersion and INVALID_VALUE for a wrong one', () => {
    const stack: Loose = fixture().stack;
    delete stack['formatVersion'];
    expect(validateProject(stack).errors).toMatchObject([
      { code: 'MISSING_FIELD', path: ['formatVersion'] },
    ]);
    stack['formatVersion'] = 2;
    expect(validateProject(stack).errors).toMatchObject([
      { code: 'INVALID_VALUE', path: ['formatVersion'] },
    ]);
  });

  it('reports MISSING_FIELD for an absent shape and INVALID_VALUE for a wrong one', () => {
    const { stack, cardId } = fixture();
    stack.cards[cardId]!.elements.push({
      elementId: generateId('elm'),
      type: 'shape',
      name: 'Box',
      layout: { x: 0, y: 0, width: 10, height: 10 },
      properties: { shape: 'rectangle', fill: '#fff' },
    });
    const path = ['cards', cardId, 'elements', 1, 'properties', 'shape'];
    const properties = stack.cards[cardId]!.elements[1]!.properties as Loose;
    properties['shape'] = 'triangle';
    expect(validateProject(stack).errors).toMatchObject([{ code: 'INVALID_VALUE', path }]);
    delete properties['shape'];
    expect(validateProject(stack).errors).toMatchObject([{ code: 'MISSING_FIELD', path }]);
  });

  it('reports MISSING_FIELD for an absent stateSchema type and INVALID_VALUE for a wrong one', () => {
    const stack: Loose = fixture().stack;
    const entry: Loose = { initial: 'a' };
    stack['stateSchema'] = { score: entry };
    entry['type'] = 'date';
    expect(validateProject(stack).errors).toMatchObject([
      { code: 'INVALID_VALUE', path: ['stateSchema', 'score', 'type'] },
    ]);
    delete entry['type'];
    expect(validateProject(stack).errors).toMatchObject([
      { code: 'MISSING_FIELD', path: ['stateSchema', 'score', 'type'] },
    ]);
  });

  it('reports INVALID_TYPE for a wrong type', () => {
    const stack: Loose = fixture().stack;
    stack['title'] = 5;
    const error = only(validateProject(stack), 'INVALID_TYPE');
    expect(error.path).toEqual(['title']);
  });

  it('reports INVALID_TYPE at the root for null, arrays and primitives', () => {
    for (const input of [null, [], 'text', 7, true, undefined]) {
      expect(validateProject(input).errors).toMatchObject([{ code: 'INVALID_TYPE', path: [] }]);
    }
  });

  it('reports UNKNOWN_FIELD with the unknown key appended to the path', () => {
    const { stack, cardId } = fixture();
    (stack as Loose)['apiKey'] = 'secret-value';
    (stack.cards[cardId] as Loose)['extra'] = 1;
    const result = validateProject(stack);
    expect(result.errors.filter((e) => e.code === 'UNKNOWN_FIELD').map((e) => e.path)).toEqual([
      ['apiKey'],
      ['cards', cardId, 'extra'],
    ]);
  });

  it('reports INVALID_VALUE for out-of-range values, bad enums and bad discriminators', () => {
    const { stack, cardId } = fixture();
    (stack as Loose)['formatVersion'] = 2;
    stack.viewportDefaults.width = 0;
    (stack.cards[cardId]!.elements[0] as Loose)['type'] = 'video';
    const result = validateProject(stack);
    expect(result.errors.filter((e) => e.code === 'INVALID_VALUE').map((e) => e.path)).toEqual([
      ['cards', cardId, 'elements', 0, 'type'],
      ['formatVersion'],
      ['viewportDefaults', 'width'],
    ]);
  });

  it('reports a fractional viewport width as INVALID_TYPE (Zod 4 int check)', () => {
    const { stack } = fixture();
    stack.viewportDefaults.width = 1.5;
    expect(only(validateProject(stack), 'INVALID_TYPE').path).toEqual([
      'viewportDefaults',
      'width',
    ]);
  });

  it('reports one error for each broken field', () => {
    const stack: Loose = fixture().stack;
    delete stack['createdAt'];
    delete stack['updatedAt'];
    stack['cardOrder'] = 'no';
    expect(codes(validateProject(stack))).toEqual([
      'INVALID_TYPE',
      'MISSING_FIELD',
      'MISSING_FIELD',
    ]);
  });

  it('never echoes input values in messages', () => {
    const stack: Loose = fixture().stack;
    stack['title'] = 5;
    stack['apiKey'] = 'hunter2-secret';
    stack['formatVersion'] = 'hunter2-secret';
    const text = JSON.stringify(validateProject(stack));
    expect(text).not.toContain('hunter2');
  });
});

describe('validateProject: semantic phase', () => {
  it('INVALID_ID for each identifier field that breaks its pattern', () => {
    const { stack, cardId, elementId, assetId } = fixture();
    const loose: Loose = stack;
    loose['stackId'] = 'stk_nope';
    loose['entryCardId'] = 'card-1';
    loose['cardOrder'] = ['card-1'];
    loose['cards'] = {
      'card-1': {
        cardId: 'card-1',
        title: 'x',
        elements: [
          {
            ...stack.cards[cardId]!.elements[0],
            elementId: 'elm_nope',
            properties: { assetId: 'ast_nope', alt: '' },
          },
        ],
      },
    };
    loose['assetRegistry'] = { ast_nope: { ...stack.assetRegistry[assetId], assetId: 'ast_nope' } };
    const fields = validateProject(loose)
      .errors.filter((e) => e.code === 'INVALID_ID')
      .map((e) => e.details['field']);
    expect(fields.sort()).toEqual(
      [
        'assetId',
        'assetRegistry key',
        'cardId',
        'cardOrder',
        'cards key',
        'elementId',
        'entryCardId',
        'properties.assetId',
        'stackId',
      ].sort(),
    );
    expect(cardId).toBeTruthy();
    expect(elementId).toBeTruthy();
  });

  it('TITLE_TOO_LONG for stack and card titles over 100 code points, once each', () => {
    const { stack, cardId } = fixture();
    stack.title = 'a'.repeat(101);
    stack.cards[cardId]!.title = 'b'.repeat(101);
    const result = validateProject(stack);
    expect(codes(result)).toEqual(['TITLE_TOO_LONG', 'TITLE_TOO_LONG']);
    expect(result.errors.map((e) => e.path)).toEqual([['cards', cardId, 'title'], ['title']]);
  });

  it('counts an astral character as one code point', () => {
    const { stack } = fixture();
    stack.title = '\u{1F47B}'.repeat(100);
    expect(isValid(validateProject(stack))).toBe(true);
    stack.title = '\u{1F47B}'.repeat(101);
    expect(codes(validateProject(stack))).toEqual(['TITLE_TOO_LONG']);
  });

  it('TIMESTAMP_INVALID for a bad format and for calendar overflow', () => {
    const { stack } = fixture();
    stack.createdAt = '2026-11-15';
    stack.updatedAt = '2026-02-30T00:00:00.000Z';
    const result = validateProject(stack);
    expect(result.errors.map((e) => [e.code, e.details['field']])).toEqual([
      ['TIMESTAMP_INVALID', 'createdAt'],
      ['TIMESTAMP_INVALID', 'updatedAt'],
    ]);
  });

  it('ENTRY_CARD_NOT_FOUND names the missing cardId', () => {
    const { stack } = fixture();
    const missing = generateId('crd');
    stack.entryCardId = missing;
    const error = only(validateProject(stack), 'ENTRY_CARD_NOT_FOUND');
    expect(error.details).toEqual({ cardId: missing });
    expect(error.path).toEqual(['entryCardId']);
  });

  it('CARD_ORDER_REFERENCE_NOT_FOUND names the cardId and the index', () => {
    const { stack } = fixture();
    const missing = generateId('crd');
    stack.cardOrder.push(missing);
    const error = only(validateProject(stack), 'CARD_ORDER_REFERENCE_NOT_FOUND');
    expect(error.details).toEqual({ cardId: missing });
    expect(error.path).toEqual(['cardOrder', 1]);
  });

  it('CARD_ORDER_DUPLICATE reports a repeated id once, at its second position', () => {
    const { stack, cardId } = fixture();
    stack.cardOrder.push(cardId, cardId);
    const error = only(validateProject(stack), 'CARD_ORDER_DUPLICATE');
    expect(error.details).toEqual({ cardId });
    expect(error.path).toEqual(['cardOrder', 1]);
  });

  it('CARD_ORDER_OMITS_CARD names the omitted card', () => {
    const { stack, cardId } = fixture();
    stack.cardOrder = [];
    const error = only(validateProject(stack), 'CARD_ORDER_OMITS_CARD');
    expect(error.details).toEqual({ cardId });
  });

  it('CARD_KEY_MISMATCH and CARD_ID_DUPLICATE when two keys hold the same cardId', () => {
    const { stack, cardId } = fixture();
    const otherKey = generateId('crd');
    stack.cards[otherKey] = { ...stack.cards[cardId]!, elements: [] };
    stack.cardOrder.push(otherKey);
    // The copy keeps the original cardId, so it is keyed wrongly and duplicates it.
    const result = validateProject(stack);
    expect(codes(result)).toEqual(['CARD_ID_DUPLICATE', 'CARD_KEY_MISMATCH']);
    expect(only(result, 'CARD_ID_DUPLICATE').details).toEqual({ cardId });
    expect(only(result, 'CARD_KEY_MISMATCH').details).toEqual({ cardId, key: otherKey });
  });

  it('ELEMENT_ID_DUPLICATE names the element and its card', () => {
    const { stack, cardId, elementId } = fixture();
    const elements = stack.cards[cardId]!.elements;
    elements.push({ ...elements[0]! });
    const error = only(validateProject(stack), 'ELEMENT_ID_DUPLICATE');
    expect(error.details).toEqual({ elementId, cardId });
    expect(error.path).toEqual(['cards', cardId, 'elements', 1, 'elementId']);
  });

  it('ELEMENT_ASSET_NOT_FOUND names element, card and asset', () => {
    const { stack, cardId, elementId } = fixture();
    const missing = generateId('ast');
    (stack.cards[cardId]!.elements[0]!.properties as Loose)['assetId'] = missing;
    const error = only(validateProject(stack), 'ELEMENT_ASSET_NOT_FOUND');
    expect(error.details).toEqual({ elementId, cardId, assetId: missing });
  });

  it('ASSET_KEY_MISMATCH when the registry key differs from assetId', () => {
    const { stack, assetId } = fixture();
    const other = generateId('ast');
    stack.assetRegistry[assetId]!.assetId = other;
    const error = only(validateProject(stack), 'ASSET_KEY_MISMATCH');
    expect(error.details).toEqual({ assetId: other, key: assetId });
  });

  it.each([
    ['assets/a\u0000b.png', 'null-char'],
    ['assets\\a.png', 'backslash'],
    ['/assets/a.png', 'absolute'],
    ['C:/assets/a.png', 'absolute'],
    ['assets/../a.png', 'dot-dot'],
    ['assets/..', 'dot-dot'],
    ['images/a.png', 'prefix'],
    ['a.png', 'prefix'],
    ['assets/', 'charset'],
    ['assets/sub/a.png', 'charset'],
    ['assets/a b.png', 'charset'],
    ['assets/.', 'charset'],
    [`assets/${'a'.repeat(129)}`, 'charset'],
  ])('ASSET_PATH_INVALID for %j reports rule %s', (relativePath, rule) => {
    const { stack, assetId } = fixture();
    stack.assetRegistry[assetId]!.relativePath = relativePath;
    const error = only(validateProject(stack), 'ASSET_PATH_INVALID');
    expect(error.details).toEqual({ assetId, rule });
  });

  it('accepts a valid asset path', () => {
    expect(assetPathViolation('assets/photo-1_final.v2.png')).toBeUndefined();
  });

  it.each([
    [-1, 'negative'],
    [1.5, 'non-integer'],
    [MAX_ASSET_BYTES + 1, 'too-large'],
    [1e300, 'too-large'],
  ])('ASSET_SIZE_INVALID for %s reports rule %s', (byteSize, rule) => {
    const { stack, assetId } = fixture();
    stack.assetRegistry[assetId]!.byteSize = byteSize;
    const error = only(validateProject(stack), 'ASSET_SIZE_INVALID');
    expect(error.details).toEqual({ assetId, rule });
  });

  it('accepts sizes 0 and the 25 MiB limit', () => {
    expect(assetSizeViolation(0)).toBeUndefined();
    expect(assetSizeViolation(MAX_ASSET_BYTES)).toBeUndefined();
  });

  it('ASSET_CHECKSUM_INVALID for a wrong prefix, case or length', () => {
    for (const checksum of [`sha1:${'a'.repeat(40)}`, `sha256:${'A'.repeat(64)}`, 'sha256:abc']) {
      const { stack, assetId } = fixture();
      stack.assetRegistry[assetId]!.checksum = checksum;
      expect(only(validateProject(stack), 'ASSET_CHECKSUM_INVALID').details).toEqual({ assetId });
    }
  });

  it('VALIDATOR_INTERNAL_ERROR when reading the input throws', () => {
    const hostile = {
      get stackId(): string {
        throw new Error('boom');
      },
    };
    const result = validateProject(hostile);
    expect(result.errors).toMatchObject([{ code: 'VALIDATOR_INTERNAL_ERROR', path: [] }]);
    expect(JSON.stringify(result)).not.toContain('boom');
  });

  it('has a test for every code in ValidationErrorCode', () => {
    const covered = new Set<ValidationErrorCode>([
      'MISSING_FIELD',
      'INVALID_TYPE',
      'INVALID_VALUE',
      'UNKNOWN_FIELD',
      'INVALID_ID',
      'ENTRY_CARD_NOT_FOUND',
      'CARD_ORDER_REFERENCE_NOT_FOUND',
      'CARD_ORDER_DUPLICATE',
      'CARD_ORDER_OMITS_CARD',
      'CARD_ID_DUPLICATE',
      'CARD_KEY_MISMATCH',
      'ELEMENT_ID_DUPLICATE',
      'ELEMENT_ASSET_NOT_FOUND',
      'ASSET_KEY_MISMATCH',
      'ASSET_PATH_INVALID',
      'ASSET_SIZE_INVALID',
      'ASSET_CHECKSUM_INVALID',
      'TITLE_TOO_LONG',
      'TIMESTAMP_INVALID',
      'VALIDATOR_INTERNAL_ERROR',
    ]);
    expect([...covered].sort()).toEqual([...VALIDATION_ERROR_CODES].sort());
  });
});

describe('validateProject: result shape and guarantees', () => {
  it('returns every error in one result, sorted by path then code', () => {
    const { stack, cardId, assetId } = fixture();
    stack.entryCardId = generateId('crd');
    stack.assetRegistry[assetId]!.byteSize = -1;
    stack.cardOrder = [];
    (stack as Loose)['extra'] = true;
    const result = validateProject(stack);
    expect(codes(result)).toEqual([
      'ASSET_SIZE_INVALID',
      'CARD_ORDER_OMITS_CARD',
      'ENTRY_CARD_NOT_FOUND',
      'UNKNOWN_FIELD',
    ]);
    expect(result.errors.every((e) => e.message.length > 0 && Array.isArray(e.path))).toBe(true);
    expect(cardId).toBeTruthy();
  });

  it('does not mutate a deep-frozen input', () => {
    const { stack } = fixture();
    (stack as Loose)['extra'] = 1;
    stack.cardOrder = [];
    const frozen = deepFreeze(stack);
    const before = JSON.stringify(frozen);
    expect(() => validateProject(frozen)).not.toThrow();
    expect(JSON.stringify(frozen)).toBe(before);
  });

  it('returns equal results for repeated calls and for key-order permutations', () => {
    const { stack, assetId } = fixture();
    stack.assetRegistry[assetId]!.byteSize = -1;
    stack.entryCardId = generateId('crd');
    (stack as Loose)['zzz'] = 1;
    (stack as Loose)['aaa'] = 1;
    const reversed = Object.fromEntries(Object.entries(stack).reverse());
    const first = validateProject(stack);
    expect(validateProject(stack)).toEqual(first);
    expect(validateProject(reversed)).toEqual(first);
  });

  it('does not throw for 1,000 nested levels at the root, title, cards and element properties', () => {
    const { stack, cardId } = fixture();
    const deep = deepNest(1000);
    const cases: unknown[] = [
      deep,
      { ...stack, title: deep },
      { ...stack, cards: { [cardId]: { cardId, title: 'x', elements: [deep] } } },
      { ...stack, cards: { [cardId]: deep } },
      {
        ...stack,
        cards: {
          [cardId]: {
            cardId,
            title: 'x',
            elements: [{ ...stack.cards[cardId]!.elements[0], properties: deep }],
          },
        },
      },
      { ...stack, cardOrder: [deep] },
    ];
    for (const input of cases) {
      const result = validateProject(input);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(codes(result)).not.toContain('VALIDATOR_INTERNAL_ERROR');
    }
  });

  it('survives 1,000 nested arrays', () => {
    let deep: unknown = [];
    for (let i = 0; i < 1000; i += 1) deep = [deep];
    expect(codes(validateProject(deep))).toEqual(['INVALID_TYPE']);
  });
});
