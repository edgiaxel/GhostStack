import type { ProjectSummary } from '@ghoststack/storage';

function compareCodeUnits(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

/** Newest first. Ties break on title, then stackId, so the order is total. */
export function sortSummaries(summaries: readonly ProjectSummary[]): ProjectSummary[] {
  return [...summaries].sort(
    (a, b) =>
      compareCodeUnits(b.updatedAt, a.updatedAt) ||
      compareCodeUnits(a.title, b.title) ||
      compareCodeUnits(a.stackId, b.stackId),
  );
}
