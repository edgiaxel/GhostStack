import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { applyCommand, createStack } from '@ghoststack/domain';
import type { StackSummary } from '@ghoststack/shared-contracts';
import { navigate } from '../../app/router';
import { useServices } from '../../app/services';
import {
  errorMessage,
  formatCardCount,
  formatUpdated,
  sortByUpdated,
  validateTitle,
} from './library-helpers';
import './project-library.css';

type Load =
  { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; items: StackSummary[] };

export function ProjectLibraryPage() {
  const { stacks } = useServices();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [newTitle, setNewTitle] = useState('');
  const [createError, setCreateError] = useState<string>();
  const [actionError, setActionError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState<{ id: string; title: string }>();
  const [confirmingId, setConfirmingId] = useState<string>();
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const items = await stacks.list();
      if (mounted.current) setLoad({ status: 'ready', items: sortByUpdated(items) });
    } catch (e) {
      if (mounted.current) setLoad({ status: 'error', message: errorMessage(e) });
    }
  }, [stacks]);

  useEffect(() => {
    stacks
      .list()
      .then((items) => mounted.current && setLoad({ status: 'ready', items: sortByUpdated(items) }))
      .catch((e: unknown) => mounted.current && setLoad({ status: 'error', message: errorMessage(e) }));
  }, [stacks]);

  async function onCreate(ev: FormEvent) {
    ev.preventDefault();
    const v = validateTitle(newTitle);
    if (!v.ok) {
      setCreateError(v.message);
      return;
    }
    setCreateError(undefined);
    setBusy(true);
    try {
      const stack = createStack({
        stackId: crypto.randomUUID(),
        cardId: crypto.randomUUID(),
        title: v.title,
        now: new Date().toISOString(),
      });
      await stacks.save(stack);
      navigate(`/stack/${stack.stackId}`);
    } catch (e) {
      setCreateError(`Could not create the Stack: ${errorMessage(e)}`);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  async function onRename(ev: FormEvent) {
    ev.preventDefault();
    if (!renaming) return;
    const v = validateTitle(renaming.title);
    if (!v.ok) {
      setActionError(v.message);
      return;
    }
    setActionError(undefined);
    setBusy(true);
    try {
      const stack = await stacks.get(renaming.id);
      if (!stack) throw new Error('This Stack no longer exists. Reload the library.');
      const r = applyCommand(stack, { type: 'RENAME_STACK', title: v.title }, new Date().toISOString());
      if (!r.ok) {
        setActionError(`Could not rename: ${r.error.message}`);
        return;
      }
      await stacks.save(r.value);
      setRenaming(undefined);
      await refresh();
    } catch (e) {
      setActionError(`Could not rename: ${errorMessage(e)}`);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  async function onDelete(id: string) {
    setActionError(undefined);
    setBusy(true);
    try {
      await stacks.delete(id);
      setConfirmingId(undefined);
      await refresh();
    } catch (e) {
      setActionError(`Could not delete: ${errorMessage(e)}`);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <section className="gs-library" aria-labelledby="gs-library-heading">
      <h1 id="gs-library-heading" className="gs-panel-title">
        Project Library
      </h1>

      <form className="gs-library-create" onSubmit={onCreate} noValidate>
        <div className="gs-library-field">
          <label className="gs-library-label" htmlFor="gs-library-new-title">
            New Stack title
          </label>
          <input
            id="gs-library-new-title"
            className="gs-input"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            aria-invalid={createError ? true : undefined}
            aria-describedby={createError ? 'gs-library-create-error' : undefined}
          />
        </div>
        <button type="submit" className="gs-btn gs-btn--primary" disabled={busy}>
          Create Stack
        </button>
        {createError && (
          <p
            id="gs-library-create-error"
            className="gs-error"
            role="alert"
            style={{ flexBasis: '100%', margin: 0 }}
          >
            {createError}
          </p>
        )}
      </form>

      {actionError && (
        <p className="gs-error" role="alert">
          {actionError}
        </p>
      )}

      {load.status === 'loading' && (
        <p className="gs-empty" role="status">
          Loading Stacks…
        </p>
      )}
      {load.status === 'error' && (
        <div role="alert">
          <p className="gs-error">Could not load your Stacks: {load.message}</p>
          <button type="button" className="gs-btn" onClick={() => void refresh()}>
            Retry
          </button>
        </div>
      )}
      {load.status === 'ready' && load.items.length === 0 && (
        <p className="gs-empty">No Stacks yet. Enter a title above to create your first one.</p>
      )}
      {load.status === 'ready' && load.items.length > 0 && (
        <ul className="gs-library-list" aria-label="Stacks">
          {load.items.map((s) => (
            <li key={s.stackId} className="gs-library-item">
              {renaming?.id === s.stackId ? (
                <form className="gs-library-create" style={{ flex: 1 }} onSubmit={onRename} noValidate>
                  <div className="gs-library-field">
                    <label className="gs-library-label" htmlFor={`gs-library-rename-${s.stackId}`}>
                      Rename {s.title}
                    </label>
                    <input
                      id={`gs-library-rename-${s.stackId}`}
                      className="gs-input"
                      value={renaming.title}
                      autoFocus
                      onChange={(e) => setRenaming({ id: s.stackId, title: e.target.value })}
                    />
                  </div>
                  <button type="submit" className="gs-btn gs-btn--primary" disabled={busy}>
                    Save
                  </button>
                  <button
                    type="button"
                    className="gs-btn"
                    onClick={() => {
                      setRenaming(undefined);
                      setActionError(undefined);
                    }}
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <div className="gs-library-info">
                    <div className="gs-library-name">{s.title}</div>
                    <div className="gs-library-meta">
                      {formatCardCount(s.cardCount)} · Updated{' '}
                      <time dateTime={s.updatedAt}>{formatUpdated(s.updatedAt)}</time>
                    </div>
                  </div>
                  <div className="gs-library-actions">
                    {confirmingId === s.stackId ? (
                      <>
                        <span className="gs-library-confirm" role="alert">
                          Delete “{s.title}”? This cannot be undone.
                        </span>
                        <button
                          type="button"
                          className="gs-btn gs-btn--danger"
                          disabled={busy}
                          onClick={() => void onDelete(s.stackId)}
                        >
                          Confirm delete
                        </button>
                        <button
                          type="button"
                          className="gs-btn"
                          autoFocus
                          onClick={() => setConfirmingId(undefined)}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="gs-btn gs-btn--primary"
                          aria-label={`Open ${s.title}`}
                          onClick={() => navigate(`/stack/${s.stackId}`)}
                        >
                          Open
                        </button>
                        <button
                          type="button"
                          className="gs-btn"
                          aria-label={`Rename ${s.title}`}
                          onClick={() => {
                            setActionError(undefined);
                            setRenaming({ id: s.stackId, title: s.title });
                          }}
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          className="gs-btn gs-btn--danger"
                          aria-label={`Delete ${s.title}`}
                          onClick={() => {
                            setActionError(undefined);
                            setConfirmingId(s.stackId);
                          }}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
