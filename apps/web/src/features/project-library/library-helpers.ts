import type { StackSummary } from '@ghoststack/shared-contracts';

/** Newest first; ties broken by title so order is stable. */
export function sortByUpdated(items: readonly StackSummary[]): StackSummary[] {
  return [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.title.localeCompare(b.title));
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
