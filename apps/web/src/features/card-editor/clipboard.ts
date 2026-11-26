import { useSyncExternalStore } from 'react';
import type { Element } from '@ghoststack/shared-contracts';

/**
 * In-memory clipboard for canvas elements. It lives for the page session only and is never written to
 * storage or `localStorage`. It remembers the Stack it came from because image elements point at that
 * Stack's assets.
 */
export interface Clip {
  stackId: string;
  /** Back to front. Deep copies, so later edits to the originals do not change the clip. */
  elements: Element[];
  /** How many times this clip was pasted. Each paste shifts a little further so copies stay visible. */
  pastes: number;
}

let clip: Clip | undefined;
const listeners = new Set<() => void>();
const notify = (): void => listeners.forEach((l) => l());

export function copyToClipboard(stackId: string, elements: Element[]): void {
  if (elements.length === 0) return;
  const ordered = [...elements].sort((a, b) => a.layout.zIndex - b.layout.zIndex);
  clip = { stackId, elements: ordered.map((e) => structuredClone(e)), pastes: 0 };
  notify();
}
export const readClipboard = (): Clip | undefined => clip;
export function markPasted(): void {
  if (clip) clip = { ...clip, pastes: clip.pastes + 1 };
}
export function clearClipboard(): void {
  clip = undefined;
  notify();
}
/** True while the clipboard holds elements. Re-renders the caller when that changes. */
export function useClipboardFilled(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => clip !== undefined,
    () => false,
  );
}
