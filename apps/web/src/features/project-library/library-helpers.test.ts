import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { formatCardCount, filterAndSort, sortByUpdated, validateTitle } from './library-helpers';

const s = (stackId: string, title: string, updatedAt: string, cardCount = 1) => ({
  stackId,
  title,
  updatedAt,
  cardCount,
});

describe('library helpers', () => {
  it('sorts newest first, then by title', () => {
    const out = sortByUpdated([
      s('1', 'B', '2026-01-01'),
      s('2', 'A', '2026-01-01'),
      s('3', 'C', '2026-02-01'),
    ]);
    expect(out.map((x) => x.stackId)).toEqual(['3', '2', '1']);
  });

  it('rejects blank titles and trims valid ones', () => {
    expect(validateTitle('   ').ok).toBe(false);
    expect(validateTitle('  Quiz ')).toEqual({ ok: true, title: 'Quiz' });
  });

  it('pluralises card count', () => {
    expect(formatCardCount(1)).toBe('1 card');
    expect(formatCardCount(0)).toBe('0 cards');
  });

  it('filters by title ignoring case and sorts by title and card count', () => {
    const items = [
      s('1', 'Beta quiz', '2026-01-01', 2),
      s('2', 'alpha', '2026-01-02', 5),
      s('3', 'Gamma', '2026-01-03', 1),
    ];
    expect(filterAndSort(items, ' QUIZ ', 'updated').map((x) => x.stackId)).toEqual(['1']);
    expect(filterAndSort(items, '', 'title').map((x) => x.stackId)).toEqual(['2', '1', '3']);
    expect(filterAndSort(items, '', 'cards').map((x) => x.stackId)).toEqual(['2', '1', '3']);
    expect(filterAndSort(items, 'zzz', 'updated')).toEqual([]);
  });

  it('filterAndSort returns a subset of the input without duplicates or inventions', () => {
    const item = fc.record({
      stackId: fc.uuid(),
      title: fc.string({ maxLength: 12 }),
      updatedAt: fc.constant('2026-01-01T00:00:00.000Z'),
      cardCount: fc.nat(20),
    });
    fc.assert(
      fc.property(
        fc.uniqueArray(item, { selector: (x) => x.stackId, maxLength: 12 }),
        fc.string({ maxLength: 4 }),
        fc.constantFrom('updated', 'title', 'cards'),
        (items, query, sort) => {
          const out = filterAndSort(items, query, sort);
          const ids = out.map((x) => x.stackId);
          expect(new Set(ids).size).toBe(ids.length);
          expect(ids.every((id) => items.some((x) => x.stackId === id))).toBe(true);
          if (!query.trim()) expect(out).toHaveLength(items.length);
        },
      ),
      { numRuns: 100 },
    );
  });
});
