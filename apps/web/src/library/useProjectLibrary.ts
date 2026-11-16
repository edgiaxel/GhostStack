import type { ProjectListing, StorageError } from '@ghoststack/storage';
import { useCallback, useEffect, useState } from 'react';
import { useServices } from '../app/services';

export type LibraryState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly listing: ProjectListing }
  | { readonly status: 'unavailable'; readonly error: StorageError }
  | { readonly status: 'error'; readonly error: StorageError };

export interface ProjectLibrary {
  readonly state: LibraryState;
  /** Set when `lastProjectId` points at a project that still loads. */
  readonly lastOpenedId: string | null;
  readonly reload: () => void;
}

export function useProjectLibrary(): ProjectLibrary {
  const { storage, preferences } = useServices();
  const [state, setState] = useState<LibraryState>({ status: 'loading' });
  const [lastOpenedId, setLastOpenedId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void storage.listProjects().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setState({ status: 'ready', listing: result.value });
      } else if (
        result.error.code === 'storage-unavailable' ||
        result.error.code === 'unsupported-version'
      ) {
        setState({ status: 'unavailable', error: result.error });
      } else {
        setState({ status: 'error', error: result.error });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [storage, attempt]);

  // One background load tells whether the remembered project still exists.
  useEffect(() => {
    const id = preferences.get('lastProjectId');
    if (id === null) return;
    let cancelled = false;
    void storage.loadProject(id).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setLastOpenedId(id);
      } else if (result.error.code === 'not-found') {
        preferences.set('lastProjectId', null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [storage, preferences]);

  const reload = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  return { state, lastOpenedId, reload };
}
