import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { applyCommand } from '@ghoststack/domain';
import type { ProjectCommand, Stack } from '@ghoststack/shared-contracts';
import { WorkspaceLayout } from '../../app/AppShell';
import { navigate } from '../../app/router';
import { useServices } from '../../app/services';
import { CardNavigator } from './CardNavigator';
import { moveCardInOrder, nextSelectionAfterDelete, resolveSelectedCardId } from './cardSelection';
import './workspace.css';

export interface WorkspacePageProps {
  stackId: string;
  cardId?: string;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'error'; message: string }
  | { status: 'ready'; stack: Stack };

const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const cardPath = (stackId: string, cardId: string): string =>
  `/stack/${encodeURIComponent(stackId)}/card/${encodeURIComponent(cardId)}`;

export function WorkspacePage({ stackId, cardId }: WorkspacePageProps): ReactNode {
  const { stacks } = useServices();
  const [loaded, setLoaded] = useState<{ key: string; state: LoadState } | undefined>();
  const [actionError, setActionError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const loadKey = `${stackId}:${reloadKey}`;
  const state: LoadState = loaded?.key === loadKey ? loaded.state : { status: 'loading' };
  const setState = useCallback((next: LoadState) => setLoaded({ key: loadKey, state: next }), [loadKey]);

  useEffect(() => {
    let cancelled = false;
    stacks.get(stackId).then(
      (stack) => {
        if (!cancelled) setState(stack ? { status: 'ready', stack } : { status: 'not-found' });
      },
      (e: unknown) => {
        if (!cancelled) setState({ status: 'error', message: errorMessage(e) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [stacks, stackId, setState]);

  const stack = state.status === 'ready' ? state.stack : undefined;

  /** Applies one command, persists the result, and returns the new Stack (undefined on failure). */
  const run = useCallback(
    async (command: ProjectCommand): Promise<Stack | undefined> => {
      if (!stack) return undefined;
      setBusy(true);
      setActionError(undefined);
      try {
        const result = applyCommand(stack, command, new Date().toISOString());
        if (!result.ok) {
          setActionError(`${result.error.code}: ${result.error.message}`);
          return undefined;
        }
        await stacks.save(result.value);
        setState({ status: 'ready', stack: result.value });
        return result.value;
      } catch (e) {
        setActionError(`Could not save: ${errorMessage(e)}`);
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [stack, stacks, setState],
  );

  if (state.status === 'loading') {
    return (
      <WorkspaceLayout
        navigator={<p className="gs-empty">Loading stack…</p>}
        canvas={null}
        inspector={null}
      />
    );
  }
  if (state.status === 'not-found') {
    return (
      <WorkspaceLayout
        navigator={null}
        canvas={
          <div className="gs-workspace-pane">
            <p className="gs-error" role="alert">
              Stack not found. It may have been deleted. Open the Library to pick another stack.
            </p>
          </div>
        }
        inspector={null}
      />
    );
  }
  if (state.status === 'error') {
    return (
      <WorkspaceLayout
        navigator={null}
        canvas={
          <div className="gs-workspace-pane">
            <p className="gs-error" role="alert">
              Could not load the stack: {state.message}
            </p>
            <button type="button" className="gs-btn" onClick={() => setReloadKey((k) => k + 1)}>
              Retry
            </button>
          </div>
        }
        inspector={null}
      />
    );
  }

  const current = state.stack;
  const selectedId = resolveSelectedCardId(current, cardId);
  const selected = selectedId ? current.cards[selectedId] : undefined;

  return (
    <WorkspaceLayout
      navigator={
        <CardNavigator
          stack={current}
          selectedCardId={selectedId}
          busy={busy}
          onSelect={(id) => navigate(cardPath(stackId, id))}
          onAdd={() => {
            const newId = crypto.randomUUID();
            void run({
              type: 'ADD_CARD',
              cardId: newId,
              title: `Card ${current.cardOrder.length + 1}`,
            }).then((next) => {
              if (next) navigate(cardPath(stackId, newId));
            });
          }}
          onRename={(id, title) => void run({ type: 'RENAME_CARD', cardId: id, title })}
          onDuplicate={(id) => {
            const newId = crypto.randomUUID();
            void run({ type: 'DUPLICATE_CARD', cardId: id, newCardId: newId }).then((next) => {
              if (next) navigate(cardPath(stackId, newId));
            });
          }}
          onMove={(id, delta) => {
            const order = moveCardInOrder(current.cardOrder, id, delta);
            if (order) void run({ type: 'REORDER_CARDS', cardOrder: order });
          }}
          onDelete={(id) => {
            const fallback = nextSelectionAfterDelete(current.cardOrder, id);
            void run({ type: 'DELETE_CARD', cardId: id }).then((next) => {
              if (next && id === selectedId && fallback) navigate(cardPath(stackId, fallback));
            });
          }}
        />
      }
      canvas={
        <div className="gs-workspace-pane">
          {actionError ? (
            <p className="gs-error" role="alert">
              {actionError}
            </p>
          ) : null}
          {selected ? (
            <h2 className="gs-workspace-card-title">{selected.title || 'Untitled card'}</h2>
          ) : (
            <p className="gs-empty">This stack has no cards. Add a card to begin.</p>
          )}
        </div>
      }
      inspector={
        <div className="gs-workspace-pane">
          <p className="gs-panel-title">Inspector</p>
          <p className="gs-empty">
            Select an element to edit its properties. Element editing arrives in a later step.
          </p>
        </div>
      }
    />
  );
}
