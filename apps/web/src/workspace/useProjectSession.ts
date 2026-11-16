import type { AssetBytes, Stack } from '@ghoststack/domain';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useServices } from '../app/services';

export type Persistence = 'saved' | 'save-failed';

export type Session =
  | { readonly phase: 'loading' }
  | { readonly phase: 'error'; readonly message: string }
  | {
      readonly phase: 'ready';
      readonly stack: Stack;
      readonly persistence: Persistence;
      readonly saveError: string | null;
      readonly save: (next: Stack) => Promise<void>;
      readonly retrySave: () => Promise<void>;
    };

type Loaded =
  | { readonly phase: 'loading' }
  | { readonly phase: 'error'; readonly message: string }
  | {
      readonly phase: 'ready';
      readonly stack: Stack;
      readonly persistence: Persistence;
      readonly saveError: string | null;
    };

const OPEN_FAILED = 'This project could not be opened.';

export function useProjectSession(stackId: string): Session {
  const { storage } = useServices();
  // Callers remount per stackId (App keys the workspace), so state starts as loading.
  const [loaded, setLoaded] = useState<Loaded>({ phase: 'loading' });
  const assets = useRef<AssetBytes>({});
  // The newest stack that was handed to save and has not been stored yet.
  const pending = useRef<Stack | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    void storage.loadProject(stackId).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setLoaded({ phase: 'error', message: OPEN_FAILED });
        return;
      }
      assets.current = result.value.assets;
      pending.current = null;
      // Loaded data is the stored data, so the first status is Saved.
      setLoaded({
        phase: 'ready',
        stack: result.value.stack,
        persistence: 'saved',
        saveError: null,
      });
    });
    return () => {
      cancelled = true;
      mounted.current = false;
    };
  }, [storage, stackId]);

  const write = useCallback(
    async (next: Stack): Promise<void> => {
      pending.current = next;
      const result = await storage.saveProject({ stack: next, assets: assets.current });
      if (!mounted.current || pending.current !== next) return;
      if (result.ok) {
        pending.current = null;
        setLoaded({ phase: 'ready', stack: next, persistence: 'saved', saveError: null });
      } else {
        const message = result.error.message;
        setLoaded((previous) =>
          previous.phase === 'ready'
            ? { ...previous, persistence: 'save-failed', saveError: message }
            : previous,
        );
      }
    },
    [storage],
  );

  const retrySave = useCallback(async (): Promise<void> => {
    const next = pending.current;
    if (next !== null) await write(next);
  }, [write]);

  if (loaded.phase !== 'ready') return loaded;
  return { ...loaded, save: write, retrySave };
}
