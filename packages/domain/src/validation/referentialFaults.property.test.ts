import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Stack } from '../schemas';
import { arbBundle } from '../testing';
import type { PathSegment, ValidationErrorCode } from './types';
import { validateProject } from './validateProject';

type Rec = Record<string, unknown>;
type Details = Record<string, string | number>;

interface Expected {
  readonly code: ValidationErrorCode;
  readonly details: Details;
  /** Set for identifier faults, where the field path is the evidence. */
  readonly path?: readonly PathSegment[];
}

interface Injection {
  readonly name: string;
  readonly expected: Expected;
  readonly apply: (doc: Rec) => void;
}

const FAULT_KINDS = [
  'dangling-entry',
  'dangling-order',
  'duplicate-order',
  'omitted-card',
  'duplicate-card-id',
  'duplicate-element-id',
  'missing-asset',
  'bad-identifier',
] as const;
type FaultKind = (typeof FAULT_KINDS)[number];

const LAYOUT = { x: 0, y: 0, width: 1, height: 1 };
const textElement = (elementId: string): Rec => ({
  elementId,
  type: 'text',
  name: 'Fault text',
  layout: LAYOUT,
  properties: { text: 'x' },
});
const blankCard = (cardId: string, elements: unknown[] = []): Rec => ({
  cardId,
  title: 'Fault card',
  elements,
});

// Every variant is invalid whatever the random UUID: wrong prefix, no prefix, trailing text.
const arbBadId = (prefix: string): fc.Arbitrary<(uuid: string) => string> =>
  fc.constantFrom(
    (uuid: string) => `${prefix}_${uuid}x`,
    (uuid: string) => uuid,
    (uuid: string) => `zzz_${uuid}`,
    (uuid: string) => `${prefix.toUpperCase()}_${uuid}`,
  );

// Twelve distinct UUIDs give each injection its own fresh identifiers, so faults never overlap.
const arbPool = fc.uniqueArray(fc.uuid({ version: 4 }), { minLength: 12, maxLength: 12 });

const arbScenario = fc.record({
  stack: arbBundle.map(({ stack }) => stack),
  pool: arbPool,
  kinds: fc.subarray([...FAULT_KINDS], { minLength: 1 }),
  badStackId: arbBadId('stk'),
  badElementId: arbBadId('elm'),
  badOnElement: fc.boolean(),
});

function buildInjection(
  kind: FaultKind,
  stack: Stack,
  pool: readonly string[],
  badId: (uuid: string) => string,
  badElementId: (uuid: string) => string,
  badOnElement: boolean,
): Injection {
  const id = (prefix: string, slot: number): string => `${prefix}_${pool[slot] ?? ''}`;
  const order = (doc: Rec): unknown[] => doc['cardOrder'] as unknown[];
  const cards = (doc: Rec): Rec => doc['cards'] as Rec;

  switch (kind) {
    case 'dangling-entry': {
      const cardId = id('crd', 0);
      return {
        name: kind,
        expected: { code: 'ENTRY_CARD_NOT_FOUND', details: { cardId } },
        apply: (doc) => (doc['entryCardId'] = cardId),
      };
    }
    case 'dangling-order': {
      const cardId = id('crd', 1);
      return {
        name: kind,
        expected: { code: 'CARD_ORDER_REFERENCE_NOT_FOUND', details: { cardId } },
        apply: (doc) => order(doc).push(cardId),
      };
    }
    case 'duplicate-order': {
      const cardId = stack.cardOrder[0] as string;
      return {
        name: kind,
        expected: { code: 'CARD_ORDER_DUPLICATE', details: { cardId } },
        apply: (doc) => order(doc).push(cardId),
      };
    }
    case 'omitted-card': {
      const cardId = id('crd', 2);
      return {
        name: kind,
        expected: { code: 'CARD_ORDER_OMITS_CARD', details: { cardId } },
        apply: (doc) => (cards(doc)[cardId] = blankCard(cardId)),
      };
    }
    case 'duplicate-card-id': {
      const cardId = stack.cardOrder[0] as string;
      const key = id('crd', 3);
      return {
        name: kind,
        expected: { code: 'CARD_ID_DUPLICATE', details: { cardId } },
        apply: (doc) => {
          cards(doc)[key] = blankCard(cardId);
          order(doc).push(key);
        },
      };
    }
    case 'duplicate-element-id': {
      const cardId = id('crd', 4);
      const elementId = id('elm', 5);
      return {
        name: kind,
        expected: { code: 'ELEMENT_ID_DUPLICATE', details: { cardId, elementId } },
        apply: (doc) => {
          cards(doc)[cardId] = blankCard(cardId, [textElement(elementId), textElement(elementId)]);
          order(doc).push(cardId);
        },
      };
    }
    case 'missing-asset': {
      const cardId = id('crd', 6);
      const elementId = id('elm', 7);
      const assetId = id('ast', 8);
      return {
        name: kind,
        expected: { code: 'ELEMENT_ASSET_NOT_FOUND', details: { cardId, elementId, assetId } },
        apply: (doc) => {
          const image = {
            elementId,
            type: 'image',
            name: 'Missing asset',
            layout: LAYOUT,
            properties: { assetId, alt: '' },
          };
          cards(doc)[cardId] = blankCard(cardId, [image]);
          order(doc).push(cardId);
        },
      };
    }
    case 'bad-identifier': {
      if (!badOnElement) {
        const stackId = badId(pool[9] ?? '');
        return {
          name: kind,
          expected: { code: 'INVALID_ID', details: { field: 'stackId' }, path: ['stackId'] },
          apply: (doc) => (doc['stackId'] = stackId),
        };
      }
      const cardId = id('crd', 10);
      const elementId = badElementId(pool[11] ?? '');
      return {
        name: kind,
        expected: {
          code: 'INVALID_ID',
          details: { field: 'elementId' },
          path: ['cards', cardId, 'elements', 0, 'elementId'],
        },
        apply: (doc) => {
          cards(doc)[cardId] = blankCard(cardId, [textElement(elementId)]);
          order(doc).push(cardId);
        },
      };
    }
  }
}

describe('validateProject on referential and identifier faults', () => {
  // Feature: m1-foundation, Property 7: Referential and identifier faults are all reported with their identifiers
  // **Validates: Requirements 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.12, 4.13**
  it('reports every injected fault with the matching code and identifiers in one call', () => {
    fc.assert(
      fc.property(arbScenario, (scenario) => {
        const { stack, pool, kinds, badStackId, badElementId, badOnElement } = scenario;
        const injections = kinds.map((kind) =>
          buildInjection(kind, stack, pool, badStackId, badElementId, badOnElement),
        );
        const doc = structuredClone(stack) as unknown as Rec;
        for (const injection of injections) injection.apply(doc);

        const { errors } = validateProject(doc);

        for (const { name, expected } of injections) {
          const found = errors.some(
            (error) =>
              error.code === expected.code &&
              Object.entries(expected.details).every(
                ([key, value]) => error.details[key] === value,
              ) &&
              (expected.path === undefined ||
                JSON.stringify(error.path) === JSON.stringify(expected.path)),
          );
          expect(found, `${name} was not reported with ${JSON.stringify(expected)}`).toBe(true);
        }
      }),
      { numRuns: 200 },
    );
  });
});
