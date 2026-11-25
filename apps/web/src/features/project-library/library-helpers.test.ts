import { describe, expect, it } from 'vitest';
import { formatCardCount, sortByUpdated, validateTitle } from './library-helpers';

const s = (stackId: string, title: string, updatedAt: string) => ({
  stackId,
  title,
  updatedAt,
  cardCount: 1,
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
});
