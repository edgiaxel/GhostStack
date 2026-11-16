import type { ProjectSummary } from '@ghoststack/storage';
import { describe, expect, it } from 'vitest';
import { sortSummaries } from './sortSummaries';

const summary = (stackId: string, title: string, updatedAt: string): ProjectSummary => ({
  stackId,
  title,
  updatedAt,
});

describe('sortSummaries', () => {
  it('puts the newest project first', () => {
    const sorted = sortSummaries([
      summary('a', 'Old', '2026-01-01T00:00:00.000Z'),
      summary('b', 'New', '2026-03-01T00:00:00.000Z'),
    ]);
    expect(sorted.map((s) => s.title)).toEqual(['New', 'Old']);
  });

  it('orders equal timestamps by title in code-unit order, then stackId', () => {
    const at = '2026-01-01T00:00:00.000Z';
    const sorted = sortSummaries([
      summary('3', 'alpha', at),
      summary('2', 'Beta', at),
      summary('1', 'Beta', at),
    ]);
    expect(sorted.map((s) => s.stackId)).toEqual(['1', '2', '3']);
  });

  it('does not change its input', () => {
    const input = [summary('a', 'A', '2026-01-01'), summary('b', 'B', '2026-02-01')];
    const copy = [...input];
    sortSummaries(input);
    expect(input).toEqual(copy);
  });
});
