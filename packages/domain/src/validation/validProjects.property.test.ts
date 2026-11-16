import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { arbBundle } from '../testing';
import { isValid } from './types';
import { validateProject } from './validateProject';

describe('validateProject on generated valid projects', () => {
  // Feature: m1-foundation, Property 5: Valid projects have no validation errors
  // **Validates: Requirements 4.1, 4.2, 4.17**
  it('returns zero errors for every arbBundle project', () => {
    fc.assert(
      fc.property(arbBundle, ({ stack }) => {
        const result = validateProject(stack);
        expect(result.errors).toEqual([]);
        expect(isValid(result)).toBe(true);
      }),
      { numRuns: 200 },
    );
  });
});
