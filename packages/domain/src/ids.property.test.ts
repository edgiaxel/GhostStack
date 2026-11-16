import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ID_PATTERNS, generateId, type IdPrefix } from './ids';

const PREFIXES = ['stk', 'crd', 'elm', 'ast'] as const satisfies readonly IdPrefix[];

describe('Property 3: Generated identifiers match their pattern', () => {
  /**
   * **Validates: Requirements 3.7, 4.12**
   */
  it('every identifier in a generated run matches ID_PATTERNS for its prefix', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...PREFIXES),
        fc.integer({ min: 1, max: 50 }),
        (prefix, runLength) => {
          for (let i = 0; i < runLength; i += 1) {
            expect(generateId(prefix)).toMatch(ID_PATTERNS[prefix]);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 3.7, 4.12**
   */
  it('a run of 1,000 identifiers from the default generator has no duplicate', () => {
    fc.assert(
      fc.property(fc.constantFrom(...PREFIXES), (prefix) => {
        const run = Array.from({ length: 1000 }, () => generateId(prefix));
        expect(new Set(run).size).toBe(run.length);
      }),
      { numRuns: 20 },
    );
  });
});
