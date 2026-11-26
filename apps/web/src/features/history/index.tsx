import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { CheckpointSummary } from '@ghoststack/shared-contracts';
import { Button } from '../../components';
import { useServices } from '../../app/services';
import { useSessionStack, useSessionStatus } from '../../app/useStackSession';
import type { EditorSlotProps } from '../../app/editorContext';
import './history.css';

const LABEL = { saved: 'Saved', saving: 'Saving…', dirty: 'Unsaved changes', error: 'Save failed' } as const;
const MAX_AUTO = 20;
const errorText = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** True when a keyboard event comes from a place where Ctrl+Z belongs to the field itself. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/** Maps a key event to an editing shortcut, or undefined. */
export function shortcutFor(
  e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey'>,
): 'undo' | 'redo' | undefined {
  if (!(e.ctrlKey || e.metaKey)) return undefined;
  const k = e.key.toLowerCase();
  if (k === 'z') return e.shiftKey ? 'redo' : 'undo';
  if (k === 'y') return 'redo';
  return undefined;
}

export function HistoryControls({ session }: EditorSlotProps): ReactNode {
  const { checkpoints, assets } = useServices();
  const stack = useSessionStack(session);
  const status = useSessionStatus(session);
  const [notice, setNotice] = useState<string | undefined>();
  const [recoveredDismissed, setRecoveredDismissed] = useState(false);
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<CheckpointSummary[] | undefined>();
  const [listError, setListError] = useState<string | undefined>();
  const [label, setLabel] = useState('');
  const [confirmId, setConfirmId] = useState<string | undefined>();
  const [missing, setMissing] = useState<string[]>([]);
  const stackId = session.stackId;

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const action = shortcutFor(e);
      if (!action || isEditableTarget(e.target)) return;
      e.preventDefault();
      if (action === 'undo') session.undo();
      else session.redo();
    };
    const onHide = (): void => {
      if (document.visibilityState === 'hidden') void session.flush();
    };
    const onUnload = (e: BeforeUnloadEvent): void => {
      const s = session.getStatus().saveState;
      if (s === 'dirty' || s === 'saving') {
        void session.flush();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [session]);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const all = await checkpoints.list(stackId);
      setList(all.filter((c) => c.kind !== 'recovery'));
      setListError(undefined);
    } catch (e) {
      setListError(errorText(e));
    }
  }, [checkpoints, stackId]);

  const registry = stack.assetRegistry;
  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      Object.values(registry).map(async (a) =>
        (await assets.get(stackId, a.assetId).catch(() => undefined)) ? undefined : a.relativePath,
      ),
    ).then((names) => {
      if (!cancelled) setMissing(names.filter((n): n is string => n !== undefined));
    });
    return () => {
      cancelled = true;
    };
  }, [assets, registry, stackId]);

  const create = async (kind: 'manual' | 'auto', text: string): Promise<boolean> => {
    try {
      await session.flush();
      await checkpoints.put({
        checkpointId: crypto.randomUUID(),
        stackId,
        label: text,
        kind,
        createdAt: new Date().toISOString(),
        stack: session.getStack(),
      });
      if (kind === 'auto') {
        const autos = (await checkpoints.list(stackId)).filter((c) => c.kind === 'auto');
        for (const old of autos.slice(MAX_AUTO)) await checkpoints.delete(old.checkpointId);
      }
      return true;
    } catch (e) {
      setNotice(`Could not save the checkpoint: ${errorText(e)}`);
      return false;
    }
  };

  const restore = async (id: string): Promise<void> => {
    setConfirmId(undefined);
    try {
      const cp = await checkpoints.get(id);
      if (!cp) return setNotice('That checkpoint no longer exists.');
      if (!(await create('auto', `Before restoring "${cp.label}"`))) return;
      const r = session.restore(cp.stack);
      setNotice(
        r.ok
          ? `Restored "${cp.label}". Undo brings the previous version back.`
          : `Could not restore: ${r.error.message}`,
      );
      await refresh();
    } catch (e) {
      setNotice(`Could not restore: ${errorText(e)}`);
    }
  };

  return (
    <>
      <span className="gs-history-group" role="group" aria-label="History">
        <Button icon="undo" disabled={!status.canUndo} onClick={() => session.undo()} title="Undo (Ctrl+Z)">
          Undo
        </Button>
        <Button
          icon="redo"
          disabled={!status.canRedo}
          onClick={() => session.redo()}
          title="Redo (Ctrl+Shift+Z)"
        >
          Redo
        </Button>
      </span>
      <span role="status" className={status.saveState === 'error' ? 'gs-error' : 'gs-history-status'}>
        {LABEL[status.saveState]}
        {status.error ? `: ${status.error}` : ''}
      </span>
      {status.saveState === 'error' ? (
        <button type="button" className="gs-btn" onClick={() => void session.flush()}>
          Retry save
        </button>
      ) : null}
      <button
        type="button"
        className="gs-btn"
        aria-expanded={open}
        onClick={() => {
          if (!open) void refresh();
          setOpen((v) => !v);
        }}
      >
        Checkpoints
      </button>
      {missing.length > 0 ? (
        <span className="gs-error" role="status">
          {missing.length} image file(s) missing: {missing.join(', ')}. Pick the image again in the inspector.
        </span>
      ) : null}
      {status.recovered && !recoveredDismissed ? (
        <span className="gs-history-banner" role="status">
          Restored unsaved changes from your last session.
          <button type="button" className="gs-btn" onClick={() => setRecoveredDismissed(true)}>
            Dismiss
          </button>
        </span>
      ) : null}
      {notice ? (
        <span className="gs-history-banner" role="status">
          {notice}
          <button type="button" className="gs-btn" onClick={() => setNotice(undefined)}>
            Dismiss
          </button>
        </span>
      ) : null}
      {open ? (
        <div className="gs-history-panel" role="region" aria-label="Checkpoints">
          <form
            className="gs-history-form"
            onSubmit={(e) => {
              e.preventDefault();
              const text = label.trim();
              if (!text) return;
              void create('manual', text).then((ok) => {
                if (ok) {
                  setLabel('');
                  void refresh();
                }
              });
            }}
          >
            <label>
              <span className="gs-panel-title">Checkpoint name</span>
              <input className="gs-input" value={label} onChange={(e) => setLabel(e.target.value)} />
            </label>
            <button type="submit" className="gs-btn gs-btn--primary" disabled={!label.trim()}>
              Save checkpoint
            </button>
          </form>
          {listError ? (
            <p className="gs-error" role="alert">
              Could not load checkpoints: {listError}
            </p>
          ) : list === undefined ? (
            <p className="gs-empty">Loading checkpoints…</p>
          ) : list.length === 0 ? (
            <p className="gs-empty">
              No checkpoints yet. Name one above to keep a version you can return to.
            </p>
          ) : (
            <ul className="gs-history-list">
              {list.map((c) => (
                <li key={c.checkpointId}>
                  <span>
                    {c.label}{' '}
                    <small>
                      ({c.kind}, {new Date(c.createdAt).toLocaleString()})
                    </small>
                  </span>
                  {confirmId === c.checkpointId ? (
                    <>
                      <button
                        type="button"
                        className="gs-btn gs-btn--danger"
                        onClick={() => void restore(c.checkpointId)}
                      >
                        Confirm restore
                      </button>
                      <button type="button" className="gs-btn" onClick={() => setConfirmId(undefined)}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="gs-btn"
                      aria-label={`Restore ${c.label}`}
                      onClick={() => setConfirmId(c.checkpointId)}
                    >
                      Restore
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </>
  );
}
