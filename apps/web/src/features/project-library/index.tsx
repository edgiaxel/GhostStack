import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { applyCommand, createStack } from '@ghoststack/domain';
import { exportGsp } from '@ghoststack/project-format';
import type { Stack, StackSummary } from '@ghoststack/shared-contracts';
import { navigate } from '../../app/router';
import { useServices } from '../../app/services';
import { Button, EmptyState, Field, Select } from '../../components';
import { downloadBytes, safeFileName } from '../export/files';
import { ImportGspButton } from '../export';
import { TEMPLATES } from '../templates';
import type { TemplateDefinition } from '../templates';
import { CardThumbnail } from './CardThumbnail';
import {
  errorMessage,
  filterAndSort,
  formatCardCount,
  formatUpdated,
  validateTitle,
} from './library-helpers';
import type { SortKey } from './library-helpers';
import './project-library.css';

export { CardThumbnail } from './CardThumbnail';

type Load =
  { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; items: StackSummary[] };

const SORT_OPTIONS = [
  { value: 'updated', label: 'Last updated' },
  { value: 'title', label: 'Title' },
  { value: 'cards', label: 'Card count' },
];

export function ProjectLibraryPage() {
  const { stacks, assets } = useServices();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [newTitle, setNewTitle] = useState('');
  const [createError, setCreateError] = useState<string>();
  const [actionError, setActionError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState<{ id: string; title: string }>();
  const [confirmingId, setConfirmingId] = useState<string>();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('updated');
  const [thumbs, setThumbs] = useState<Record<string, Stack | null>>({});
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
      if (mounted.current) setLoad({ status: 'ready', items });
    } catch (e) {
      if (mounted.current) setLoad({ status: 'error', message: errorMessage(e) });
    }
  }, [stacks]);

  useEffect(() => {
    stacks
      .list()
      .then((items) => mounted.current && setLoad({ status: 'ready', items }))
      .catch((e: unknown) => mounted.current && setLoad({ status: 'error', message: errorMessage(e) }));
  }, [stacks]);

  // Thumbnails: load each Stack once per version. A failed read leaves a blank thumbnail.
  const items = load.status === 'ready' ? load.items : undefined;
  useEffect(() => {
    if (!items) return;
    let cancelled = false;
    for (const s of items) {
      const key = `${s.stackId}@${s.updatedAt}`;
      if (key in thumbs) continue;
      stacks
        .get(s.stackId)
        .then((stack) => !cancelled && setThumbs((t) => ({ ...t, [key]: stack ?? null })))
        .catch(() => !cancelled && setThumbs((t) => ({ ...t, [key]: null })));
    }
    return () => {
      cancelled = true;
    };
    // `thumbs` is read only to skip loaded keys; re-running on it would refetch nothing new.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, stacks]);

  const visible = useMemo(() => (items ? filterAndSort(items, query, sort) : []), [items, query, sort]);

  async function create(template: TemplateDefinition | undefined, ev?: FormEvent) {
    ev?.preventDefault();
    const typed = newTitle.trim();
    if (!template && !typed) {
      setCreateError('Enter a title.');
      return;
    }
    const title = typed || template?.name || 'Untitled';
    setCreateError(undefined);
    setNotice(undefined);
    setBusy(true);
    try {
      const now = new Date().toISOString();
      const stackId = crypto.randomUUID();
      let stack: Stack;
      if (!template) {
        stack = createStack({ stackId, cardId: crypto.randomUUID(), title, now });
      } else {
        const built = template.build({ stackId, title, now, newId: () => crypto.randomUUID() });
        if (!built.ok) {
          setCreateError(`Could not build the ${template.name} template: ${built.error.message}`);
          return;
        }
        stack = built.value;
      }
      await stacks.save(stack);
      navigate(`/stack/${stack.stackId}`);
    } catch (e) {
      setCreateError(`Could not create the Stack: ${errorMessage(e)}. Try again.`);
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

  async function onDuplicate(s: StackSummary) {
    setActionError(undefined);
    setNotice(undefined);
    setBusy(true);
    const copyId = crypto.randomUUID();
    try {
      const stack = await stacks.get(s.stackId);
      if (!stack) throw new Error('This Stack no longer exists. Reload the library.');
      const bytes = await assets.getAll(s.stackId);
      const now = new Date().toISOString();
      await stacks.save({
        ...stack,
        stackId: copyId,
        title: `${stack.title} copy`,
        createdAt: now,
        updatedAt: now,
      });
      for (const asset of Object.values(stack.assetRegistry)) {
        const data = bytes[asset.assetId];
        if (data) await assets.put(copyId, asset, data);
      }
      setNotice(`Duplicated ${stack.title}.`);
      await refresh();
    } catch (e) {
      await stacks.delete(copyId).catch(() => undefined);
      setActionError(`Could not duplicate: ${errorMessage(e)}`);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  async function onExport(s: StackSummary) {
    setActionError(undefined);
    setNotice(undefined);
    setBusy(true);
    try {
      const stack = await stacks.get(s.stackId);
      if (!stack) throw new Error('This Stack no longer exists. Reload the library.');
      const bytes = await assets.getAll(s.stackId);
      const missing = Object.values(stack.assetRegistry).filter((a) => !bytes[a.assetId]);
      if (missing.length > 0) {
        setActionError(
          `Cannot export ${stack.title}: image files are missing (${missing.map((a) => a.relativePath).join(', ')}). Open the Stack and pick the images again.`,
        );
        return;
      }
      const r = exportGsp(stack, bytes);
      if (!r.ok) {
        setActionError(`Export failed: ${r.error.message}`);
        return;
      }
      const name = safeFileName(stack.title, '.gsp');
      downloadBytes(r.value, name, 'application/octet-stream');
      setNotice(`Exported ${name}.`);
    } catch (e) {
      setActionError(`Could not export: ${errorMessage(e)}`);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <section className="gs-library" aria-labelledby="gs-library-heading">
      <h1 id="gs-library-heading" className="gs-panel-title">
        Project Library
      </h1>
      <form className="gs-library-create" onSubmit={(ev) => void create(undefined, ev)} noValidate>
        <div className="gs-library-field">
          <Field
            label="New Stack title"
            value={newTitle}
            onChange={setNewTitle}
            hint="Used for a blank Stack or a template. A template keeps its own name when this is empty."
          />
        </div>
        <Button type="submit" variant="primary" disabled={busy}>
          Create Stack
        </Button>
        <ImportGspButton />
        {createError && (
          <p className="gs-error gs-library-formerror" role="alert">
            {createError}
          </p>
        )}
      </form>

      <section className="gs-library-templates" aria-labelledby="gs-library-templates-heading">
        <h2 id="gs-library-templates-heading" className="gs-panel-title">
          Start from a template
        </h2>
        <ul className="gs-library-templatelist">
          {TEMPLATES.filter((t) => t.id !== 'blank').map((t) => (
            <li key={t.id}>
              <button
                type="button"
                className="gs-library-template"
                disabled={busy}
                onClick={() => void create(t)}
              >
                <span className="gs-library-templatename">{t.name}</span>
                <span className="gs-library-templatedesc">{t.description}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {actionError && (
        <p className="gs-error" role="alert">
          {actionError}
        </p>
      )}
      {notice && (
        <p className="gs-library-notice" role="status">
          {notice}
        </p>
      )}

      {load.status === 'loading' && (
        <p className="gs-empty" role="status">
          Loading Stacks...
        </p>
      )}
      {load.status === 'error' && (
        <EmptyState
          tone="error"
          title="Could not load your Stacks"
          action={<Button onClick={() => void refresh()}>Retry</Button>}
        >
          {load.message}. Check that the browser allows site storage, then retry.
        </EmptyState>
      )}
      {load.status === 'ready' && load.items.length === 0 && (
        <EmptyState title="No Stacks yet">
          Type a title and choose Create Stack, pick a template above, or import a .gsp file.
        </EmptyState>
      )}
      {load.status === 'ready' && load.items.length > 0 && (
        <>
          <div className="gs-library-tools">
            <div className="gs-library-field">
              <Field label="Search Stacks" type="search" value={query} onChange={setQuery} />
            </div>
            <Select
              label="Sort by"
              value={sort}
              options={SORT_OPTIONS}
              onChange={(v) => setSort(v as SortKey)}
            />
          </div>
          {visible.length === 0 && (
            <EmptyState
              title="No Stacks match"
              action={<Button onClick={() => setQuery('')}>Clear search</Button>}
            >
              Nothing has a title containing &ldquo;{query.trim()}&rdquo;. Clear the search to see all Stacks.
            </EmptyState>
          )}
          <ul className="gs-library-list" aria-label="Stacks">
            {visible.map((s) => (
              <li key={s.stackId} className="gs-library-item">
                <div className="gs-library-thumb">
                  <CardThumbnail stack={thumbs[`${s.stackId}@${s.updatedAt}`] ?? undefined} />
                </div>
                {renaming?.id === s.stackId ? (
                  <form className="gs-library-rename" onSubmit={onRename} noValidate>
                    <Field
                      label={`Rename ${s.title}`}
                      value={renaming.title}
                      autoFocus
                      onChange={(title) => setRenaming({ id: s.stackId, title })}
                    />
                    <div className="gs-library-actions">
                      <Button type="submit" variant="primary" disabled={busy}>
                        Save
                      </Button>
                      <Button
                        onClick={() => {
                          setRenaming(undefined);
                          setActionError(undefined);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="gs-library-info">
                      <h3 className="gs-library-name">{s.title}</h3>
                      <div className="gs-library-meta">
                        {formatCardCount(s.cardCount)} &middot; Updated{' '}
                        <time dateTime={s.updatedAt}>{formatUpdated(s.updatedAt)}</time>
                      </div>
                    </div>
                    <div className="gs-library-actions">
                      {confirmingId === s.stackId ? (
                        <>
                          <span className="gs-library-confirm" role="alert">
                            Delete &ldquo;{s.title}&rdquo; and its images? This cannot be undone.
                          </span>
                          <Button variant="danger" disabled={busy} onClick={() => void onDelete(s.stackId)}>
                            Confirm delete
                          </Button>
                          <Button autoFocus onClick={() => setConfirmingId(undefined)}>
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="primary"
                            aria-label={`Open ${s.title}`}
                            onClick={() => navigate(`/stack/${s.stackId}`)}
                          >
                            Open
                          </Button>
                          <Button
                            aria-label={`Rename ${s.title}`}
                            onClick={() => {
                              setActionError(undefined);
                              setRenaming({ id: s.stackId, title: s.title });
                            }}
                          >
                            Rename
                          </Button>
                          <Button
                            aria-label={`Duplicate ${s.title}`}
                            disabled={busy}
                            onClick={() => void onDuplicate(s)}
                          >
                            Duplicate
                          </Button>
                          <Button
                            aria-label={`Export ${s.title}`}
                            disabled={busy}
                            onClick={() => void onExport(s)}
                          >
                            Export
                          </Button>
                          <Button
                            variant="danger"
                            aria-label={`Delete ${s.title}`}
                            onClick={() => {
                              setActionError(undefined);
                              setConfirmingId(s.stackId);
                            }}
                          >
                            Delete
                          </Button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
