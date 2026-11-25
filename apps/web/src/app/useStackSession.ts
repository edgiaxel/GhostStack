import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { GhostError, SessionStatus, Stack, StackSession } from '@ghoststack/shared-contracts';
import { useServices } from './services';

export type SessionLoad =
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'error'; message: string }
  | { status: 'ready'; session: StackSession };

const toLoad = (error: GhostError): SessionLoad =>
  error.code === 'STACK_NOT_FOUND' ? { status: 'not-found' } : { status: 'error', message: error.message };

/** Opens the editing session for one Stack and closes it (after a final flush) on unmount. */
export function useStackSession(stackId: string): { load: SessionLoad; retry: () => void } {
  const { sessions } = useServices();
  const [attempt, setAttempt] = useState(0);
  const key = `${stackId}:${attempt}`;
  const [loaded, setLoaded] = useState<{ key: string; load: SessionLoad } | undefined>();

  useEffect(() => {
    let cancelled = false;
    let opened: StackSession | undefined;
    sessions.open(stackId).then(
      (result) => {
        if (cancelled) {
          if (result.ok) result.value.dispose();
          return;
        }
        if (result.ok) opened = result.value;
        setLoaded({
          key,
          load: result.ok ? { status: 'ready', session: result.value } : toLoad(result.error),
        });
      },
      (e: unknown) => {
        if (!cancelled)
          setLoaded({ key, load: { status: 'error', message: e instanceof Error ? e.message : String(e) } });
      },
    );
    return () => {
      cancelled = true;
      const session = opened;
      if (session) void session.flush().finally(() => session.dispose());
    };
  }, [sessions, stackId, key]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const load: SessionLoad = loaded?.key === key ? loaded.load : { status: 'loading' };
  return { load, retry };
}

/** Current Stack of a session. Re-renders when it changes. */
export function useSessionStack(session: StackSession): Stack {
  return useSyncExternalStore(session.subscribe, session.getStack);
}

/** Save and undo status of a session. Re-renders when it changes. */
export function useSessionStatus(session: StackSession): SessionStatus {
  return useSyncExternalStore(session.subscribe, session.getStatus);
}
