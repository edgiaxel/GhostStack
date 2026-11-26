import type { StackSummary } from '@ghoststack/shared-contracts';

export type SortKey = 'updated' | 'title' | 'cards';

/** Newest first; ties broken by title so order is stable. */
export function sortByUpdated(items: readonly StackSummary[]): StackSummary[] {
  return [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.title.localeCompare(b.title));
}

/** Case-insensitive title filter, then sort. The result only contains items from `items`. */
export function filterAndSort(items: readonly StackSummary[], query: string, sort: SortKey): StackSummary[] {
  const q = query.trim().toLowerCase();
  const kept = q ? items.filter((s) => s.title.toLowerCase().includes(q)) : [...items];
  const byTitle = (a: StackSummary, b: StackSummary) => a.title.localeCompare(b.title);
  if (sort === 'title') return kept.sort((a, b) => byTitle(a, b) || b.updatedAt.localeCompare(a.updatedAt));
  if (sort === 'cards') return kept.sort((a, b) => b.cardCount - a.cardCount || byTitle(a, b));
  return sortByUpdated(kept);
}

/** Returns the trimmed title, or an error message when empty. */
export function validateTitle(raw: string): { ok: true; title: string } | { ok: false; message: string } {
  const title = raw.trim();
  return title ? { ok: true, title } : { ok: false, message: 'Enter a title.' };
}

export function formatCardCount(n: number): string {
  return `${n} ${n === 1 ? 'card' : 'cards'}`;
}

export function formatUpdated(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? 'unknown' : d.toLocaleString();
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'object' && e !== null && 'message' in e)
    return String((e as { message: unknown }).message);
  return 'Unexpected error.';
}
