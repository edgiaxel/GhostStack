import { MAX_TITLE_CODE_POINTS, createStack } from '@ghoststack/domain';
import type { DomainError } from '@ghoststack/domain';
import type { StorageError } from '@ghoststack/storage';
import { useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useServices } from '../app/services';
import './projectLibrary.css';
import { sortSummaries } from './sortSummaries';
import { useProjectLibrary } from './useProjectLibrary';

const NOT_AVAILABLE = 'not available in this slice';
const UNAVAILABLE_ACTIONS = ['Import .gsp', 'Rename', 'Export', 'Delete'] as const;

function titleProblem(error: DomainError): string {
  return error.reason === 'empty'
    ? `Enter a title with 1 to ${MAX_TITLE_CODE_POINTS} characters.`
    : `Use ${MAX_TITLE_CODE_POINTS} characters or fewer. Shorten the title and try again.`;
}

function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    date,
  );
}

function bannerText(error: StorageError): string {
  return error.code === 'unsupported-version'
    ? 'Browser storage holds data from a newer version of GhostStack. Projects cannot be opened or saved here.'
    : 'Projects cannot be saved in this browser session.';
}

export function ProjectLibrary({ onOpen }: { onOpen: (stackId: string) => void }) {
  const { storage, preferences, clock, newId } = useServices();
  const { state, lastOpenedId, reload } = useProjectLibrary();
  const [title, setTitle] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failedIds, setFailedIds] = useState<ReadonlySet<string>>(new Set());
  const persistRequested = useRef(false);
  const inputId = useId();
  const errorId = useId();

  function open(stackId: string) {
    preferences.set('lastProjectId', stackId);
    onOpen(stackId);
  }

  function requestPersistentStorage() {
    if (persistRequested.current) return;
    persistRequested.current = true;
    try {
      void navigator.storage.persist().catch(() => undefined);
    } catch {
      // Not supported here. Saving still works without the request.
    }
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const created = createStack(title, { clock, newId });
    if (!created.ok) {
      setFormError(titleProblem(created.error));
      return;
    }
    setFormError(null);
    setBusy(true);
    const saved = await storage.saveProject({ stack: created.value, assets: {} });
    setBusy(false);
    if (!saved.ok) {
      setFormError(`The stack was not saved. ${saved.error.message}`);
      return;
    }
    requestPersistentStorage();
    open(created.value.stackId);
  }

  async function handleSelect(stackId: string) {
    if (busy) return;
    setBusy(true);
    const loaded = await storage.loadProject(stackId);
    setBusy(false);
    if (loaded.ok) {
      open(stackId);
    } else {
      setFailedIds((previous) => new Set(previous).add(stackId));
    }
  }

  const listing = state.status === 'ready' ? state.listing : null;
  const summaries = listing === null ? [] : sortSummaries(listing.summaries);
  const unreadable = listing?.unreadable ?? [];
  const hasProjects = summaries.length > 0 || unreadable.length > 0;

  return (
    <section className="gs-library" aria-labelledby="gs-library-heading">
      <h2 id="gs-library-heading">Project Library</h2>

      {(state.status === 'unavailable' || state.status === 'error') && (
        <div role="alert" className="gs-lib-banner">
          <p>
            {state.status === 'unavailable'
              ? bannerText(state.error)
              : `Projects could not be listed. ${state.error.message}`}
          </p>
          {state.status === 'error' && (
            <button type="button" className="gs-btn" onClick={reload}>
              Retry listing projects
            </button>
          )}
        </div>
      )}

      <div className="gs-lib-body">
        <form className="gs-lib-create" onSubmit={(event) => void handleCreate(event)} noValidate>
          <h3>New project</h3>
          <label htmlFor={inputId}>Stack title</label>
          <input
            id={inputId}
            type="text"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
            }}
            autoComplete="off"
            aria-invalid={formError !== null}
            aria-describedby={formError === null ? undefined : errorId}
          />
          {formError !== null && (
            <p id={errorId} role="alert" className="gs-lib-error">
              Error: {formError}
            </p>
          )}
          <button type="submit" className="gs-btn gs-btn-primary" disabled={busy}>
            Create Project
          </button>
        </form>

        <div className="gs-lib-projects">
          <div className="gs-lib-actions" role="group" aria-label="Project actions">
            {UNAVAILABLE_ACTIONS.map((action) => (
              <button key={action} type="button" className="gs-btn" disabled>
                {action} <span className="gs-lib-note">({NOT_AVAILABLE})</span>
              </button>
            ))}
          </div>

          {state.status === 'loading' && (
            <p role="status" className="gs-lib-muted">
              Loading projects
            </p>
          )}

          {listing !== null && !hasProjects && (
            <p className="gs-lib-muted">
              No projects yet. Enter a title and choose Create Project to start your first stack.
            </p>
          )}

          {hasProjects && (
            <ul className="gs-lib-list" aria-label="Projects">
              {summaries.map((summary) => {
                const failed = failedIds.has(summary.stackId);
                return (
                  <li key={summary.stackId}>
                    <button
                      type="button"
                      className="gs-lib-row"
                      disabled={failed || busy}
                      onClick={() => void handleSelect(summary.stackId)}
                    >
                      <span className="gs-lib-row-title">{summary.title || 'Untitled stack'}</span>
                      <span className="gs-lib-muted">
                        Modified{' '}
                        <time dateTime={summary.updatedAt}>
                          {formatUpdatedAt(summary.updatedAt)}
                        </time>
                      </span>
                      {summary.stackId === lastOpenedId && (
                        <span className="gs-lib-tag">Last opened</span>
                      )}
                      {failed && (
                        <span className="gs-lib-error">
                          Unavailable: this project could not be loaded
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
              {unreadable.map((record) => (
                <li key={record.stackId}>
                  <button type="button" className="gs-lib-row" disabled>
                    <span className="gs-lib-row-title">Unreadable project</span>
                    <span className="gs-lib-muted gs-mono">{record.stackId}</span>
                    <span className="gs-lib-error">
                      Unavailable: this project could not be loaded
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
