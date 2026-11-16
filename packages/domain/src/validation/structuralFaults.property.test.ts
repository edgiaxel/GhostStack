import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Stack } from '../schemas';
import { arbBundle } from '../testing';
import type { PathSegment, ValidationErrorCode } from './types';
import { validateProject } from './validateProject';

type Rec = Record<string, unknown>;
type Kind = 'delete' | 'wrongType' | 'unknownField';

interface Location {
  readonly path: readonly PathSegment[];
  readonly value: unknown;
}

// Schema objects only. The cards, assetRegistry and stateSchema maps are records, so their
// keys are data and not fields.
function structObjects(stack: Stack): Location[] {
  const out: Location[] = [
    { path: [], value: stack },
    { path: ['viewportDefaults'], value: stack.viewportDefaults },
  ];
  for (const [cardId, card] of Object.entries(stack.cards)) {
    out.push({ path: ['cards', cardId], value: card });
    card.elements.forEach((element, index) => {
      const base = ['cards', cardId, 'elements', index];
      out.push({ path: base, value: element });
      out.push({ path: [...base, 'layout'], value: element.layout });
      out.push({ path: [...base, 'properties'], value: element.properties });
    });
  }
  for (const [assetId, asset] of Object.entries(stack.assetRegistry)) {
    out.push({ path: ['assetRegistry', assetId], value: asset });
  }
  for (const [name, entry] of Object.entries(stack.stateSchema)) {
    out.push({ path: ['stateSchema', name], value: entry });
  }
  return out;
}

function fieldLocations(stack: Stack): Location[] {
  return structObjects(stack).flatMap(({ path, value }) =>
    Object.entries(value as Rec).map(([key, field]) => ({ path: [...path, key], value: field })),
  );
}

function valueAt(doc: unknown, path: readonly PathSegment[]): Rec {
  return path.reduce<unknown>((node, segment) => (node as Rec)[segment as string], doc) as Rec;
}

function parentOf(doc: unknown, path: readonly PathSegment[]): Rec {
  return valueAt(doc, path.slice(0, -1));
}

const kindOf = (value: unknown): string =>
  Array.isArray(value) ? 'array' : value === null ? 'string' : typeof value;

const WRONG_VALUES: readonly (readonly [string, unknown])[] = [
  ['number', 5],
  ['string', 'x'],
  ['boolean', true],
  ['array', []],
  ['object', {}],
];

// A null image assetId is valid, so null counts as the string kind to keep the value invalid.
const wrongValuesFor = (original: unknown): unknown[] =>
  WRONG_VALUES.filter(([kind]) => kind !== kindOf(original)).map(([, value]) => value);

interface Case {
  readonly stack: Stack;
  readonly kind: Kind;
  readonly path: readonly PathSegment[];
  readonly mutated: unknown;
}

const EXPECTED_CODE: Record<Kind, ValidationErrorCode> = {
  delete: 'MISSING_FIELD',
  wrongType: 'INVALID_TYPE',
  unknownField: 'UNKNOWN_FIELD',
};

// Zod reports these as invalid_value when the input is not one of the allowed values,
// whatever its type. A deleted one is still a missing field.
const isLiteralOrEnum = (path: readonly PathSegment[]): boolean => {
  const last = path.at(-1);
  return (
    last === 'formatVersion' ||
    last === 'shape' ||
    (path[0] === 'stateSchema' && last === 'type') ||
    (path[0] === 'cards' && last === 'type')
  );
};

// Literal and enum fields except the element type discriminator, which Zod reports as a union
// issue. They get a dedicated delete property so every run exercises them.
const isDeleteBugField = (path: readonly PathSegment[]): boolean =>
  isLiteralOrEnum(path) && !(path[0] === 'cards' && path.at(-1) === 'type');

// A union of string, number and boolean reports invalid_union for a wrong type.
const isPrimitiveUnion = (path: readonly PathSegment[]): boolean => path.at(-1) === 'initial';

const mutate = (stack: Stack, change: (doc: unknown) => void): unknown => {
  const doc = structuredClone(stack) as unknown;
  change(doc);
  return doc;
};

const arbDelete = (stack: Stack, include: (path: readonly PathSegment[]) => boolean) =>
  fc
    .constantFrom(...fieldLocations(stack).filter(({ path }) => include(path)))
    .map(({ path }): Case => ({
      stack,
      kind: 'delete',
      path,
      mutated: mutate(stack, (doc) => delete parentOf(doc, path)[path.at(-1) as string]),
    }));

const arbWrongType = (stack: Stack): fc.Arbitrary<Case> =>
  fc
    .constantFrom(
      ...fieldLocations(stack).filter(
        ({ path }) => !isLiteralOrEnum(path) && !isPrimitiveUnion(path),
      ),
    )
    .chain((location) =>
      fc.constantFrom(...wrongValuesFor(location.value)).map((replacement): Case => ({
        stack,
        kind: 'wrongType',
        path: location.path,
        mutated: mutate(stack, (doc) => {
          parentOf(doc, location.path)[location.path.at(-1) as string] = replacement;
        }),
      })),
    );

const arbUnknownField = (stack: Stack): fc.Arbitrary<Case> =>
  fc
    .tuple(
      fc.constantFrom(...structObjects(stack)),
      fc.stringMatching(/^[a-z]{1,12}$/).map((key) => `extra_${key}`),
    )
    .map(([location, key]): Case => ({
      stack,
      kind: 'unknownField',
      path: [...location.path, key],
      mutated: mutate(stack, (doc) => {
        valueAt(doc, location.path)[key] = true;
      }),
    }));

const arbCase: fc.Arbitrary<Case> = arbBundle.chain(({ stack }) =>
  fc.oneof(
    arbDelete(stack, (path) => !isDeleteBugField(path)),
    arbWrongType(stack),
    arbUnknownField(stack),
  ),
);

const arbLiteralDelete: fc.Arbitrary<Case> = arbBundle.chain(({ stack }) =>
  arbDelete(stack, isDeleteBugField),
);

const expectFault = ({ stack, kind, path, mutated }: Case): void => {
  expect(validateProject(stack).errors).toEqual([]);
  const { errors } = validateProject(mutated);
  expect(errors).toHaveLength(1);
  expect(errors[0]?.code).toBe(EXPECTED_CODE[kind]);
  expect(errors[0]?.path).toEqual(path);
};

describe('validateProject structural faults', () => {
  // Feature: m1-foundation, Property 6: Structural faults are reported with their location
  // **Validates: Requirements 4.3, 6.13, 8.5**
  it('reports exactly one error with the faulted path and the matching code', () => {
    fc.assert(fc.property(arbCase, expectFault), { numRuns: 200 });
  });

  // Feature: m1-foundation, Property 6: Structural faults are reported with their location
  // **Validates: Requirements 4.3**
  it('reports MISSING_FIELD when a literal or enum field is deleted', () => {
    fc.assert(fc.property(arbLiteralDelete, expectFault), { numRuns: 100 });
  });
});
