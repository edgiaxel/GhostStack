import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { arbBundle, arbFault, arbJsonValue } from '../testing';
import { VALIDATION_ERROR_CODES } from './types';
import type { ValidationResult } from './types';
import { validateProject } from './validateProject';

const MAX_DEPTH = 1000;

function deepNest(depth: number, leaf: unknown): unknown {
  let value = leaf;
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

/** Copy with every object's keys inserted in reverse order. */
function reverseKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseKeys);
  if (typeof value === 'object' && value !== null) {
    const copy: Record<string, unknown> = {};
    for (const key of Object.keys(value).reverse()) {
      // Plain assignment of "__proto__" would set the prototype and drop the own key.
      Object.defineProperty(copy, key, {
        value: reverseKeys((value as Record<string, unknown>)[key]),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    return copy;
  }
  return value;
}

function expectWellFormed(result: ValidationResult): void {
  for (const error of result.errors) {
    expect(VALIDATION_ERROR_CODES).toContain(error.code);
    expect(error.message.length).toBeGreaterThan(0);
    expect(Array.isArray(error.path)).toBe(true);
  }
}

/** Checks totality, input purity, repeatability and key-order independence for one input. */
function expectTotalPureDeterministic(input: unknown): void {
  const reordered = reverseKeys(input);
  const frozenInput = deepFreeze(structuredClone(input));
  const first = validateProject(frozenInput);
  const second = validateProject(frozenInput);
  expectWellFormed(first);
  expect(second).toEqual(first);
  expect(validateProject(reordered)).toEqual(first);
  expect(validateProject(structuredClone(input))).toEqual(first);
}

// Where deeply nested data is planted inside an otherwise valid Stack.
const PLANTS = ['root', 'title', 'cards', 'elementProperties', 'stateSchema'] as const;

function plantDeep(stack: unknown, where: (typeof PLANTS)[number], deep: unknown): unknown {
  const doc = structuredClone(stack) as Record<string, unknown>;
  const cards = doc['cards'] as Record<string, { elements: unknown[] }>;
  const firstCard = Object.values(cards)[0];
  switch (where) {
    case 'root':
      return deep;
    case 'title':
      return { ...doc, title: deep };
    case 'cards':
      return { ...doc, cards: { ...cards, deep } };
    case 'elementProperties':
      if (firstCard) firstCard.elements = [{ properties: deep }];
      return doc;
    case 'stateSchema':
      return { ...doc, stateSchema: { deep } };
  }
}

describe('Property 4: the validator is total, pure and deterministic', () => {
  /** **Validates: Requirements 4.3, 4.14, 4.15, 4.16** */
  it('holds for arbitrary JSON values', () => {
    fc.assert(
      fc.property(arbJsonValue, (input) => {
        expectTotalPureDeterministic(input);
      }),
      { numRuns: 200 },
    );
  });

  /** **Validates: Requirements 4.3, 4.14, 4.15, 4.16** */
  it('keeps an own "__proto__" key through key reordering', () => {
    const input = JSON.parse('{"__proto__":0}') as unknown;
    expect(Object.keys(reverseKeys(input) as object)).toEqual(['__proto__']);
    expectTotalPureDeterministic(input);
  });

  /** **Validates: Requirements 4.3, 4.14, 4.15, 4.16** */
  it('holds for valid Stacks and Stacks with injected faults', () => {
    fc.assert(
      fc.property(arbBundle, fc.option(arbFault, { nil: undefined }), (bundle, fault) => {
        expectTotalPureDeterministic(fault ? fault.apply(bundle.stack) : bundle.stack);
      }),
      { numRuns: 200 },
    );
  });

  /** **Validates: Requirements 4.3, 4.14, 4.15, 4.16** */
  it('holds for values nested up to 1,000 levels at any position', () => {
    fc.assert(
      fc.property(
        arbBundle,
        fc.constantFrom(...PLANTS),
        fc.integer({ min: 1, max: MAX_DEPTH }),
        arbJsonValue,
        (bundle, where, depth, leaf) => {
          expectTotalPureDeterministic(plantDeep(bundle.stack, where, deepNest(depth, leaf)));
        },
      ),
      { numRuns: 50 },
    );
  });

  /** **Validates: Requirements 4.3, 4.14, 4.15, 4.16** */
  it('returns errors with a code, message and path for non-object inputs', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant(null), fc.boolean(), fc.double(), fc.string(), fc.array(fc.string())),
        (input) => {
          const result = validateProject(input);
          expect(result.errors.length).toBeGreaterThan(0);
          expectTotalPureDeterministic(input);
        },
      ),
      { numRuns: 100 },
    );
  });
});
