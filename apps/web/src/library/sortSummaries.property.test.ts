import type { ProjectSummary } from '@ghoststack/storage';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { sortSummaries } from './sortSummaries';

// Small pools force many equal timestamps and titles, which exercise the tie-breaks.
const arbSummary: fc.Arbitrary<ProjectSummary> = fc.record({
  stackId: fc.string({ maxLength: 6 }),
  title: fc.oneof(fc.constantFrom('a', 'B', 'ab', 'é', ''), fc.string({ maxLength: 6 })),
  updatedAt: fc.oneof(
    fc.constantFrom('2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z'),
    fc
      .date({ min: new Date('2020-01-01'), max: new Date('2030-01-01'), noInvalidDate: true })
      .map((d) => d.toISOString()),
  ),
});

const key = (s: ProjectSummary): string => JSON.stringify([s.stackId, s.title, s.updatedAt]);

describe('Property 12: Project Library ordering', () => {
  /**
   * **Validates: Requirements 12.4**
   */
  it('returns a permutation ordered by updatedAt descending, then title ascending', () => {
    fc.assert(
      fc.property(fc.array(arbSummary, { maxLength: 30 }), (summaries) => {
        const sorted = sortSummaries(summaries);

        expect(sorted.map(key).sort()).toEqual(summaries.map(key).sort());

        for (let i = 0; i + 1 < sorted.length; i += 1) {
          const a = sorted[i]!;
          const b = sorted[i + 1]!;
          expect(a.updatedAt >= b.updatedAt).toBe(true);
          if (a.updatedAt === b.updatedAt) {
            expect(a.title <= b.title).toBe(true);
          }
        }
      }),
      { numRuns: 200 },
    );
  });
});
