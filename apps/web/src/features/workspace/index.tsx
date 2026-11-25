import { useState } from 'react';
import type { ReactNode } from 'react';
import { findCardReferences } from '@ghoststack/domain';
import type { ProjectCommand, Stack, StackSession, ViewportPresetId } from '@ghoststack/shared-contracts';
import { WorkspaceLayout } from '../../app/AppShell';
import { navigate } from '../../app/router';
import { useSessionStack, useSessionStatus, useStackSession } from '../../app/useStackSession';
import type { EditorSlotProps } from '../../app/editorContext';
import { BehaviorEditorPanel } from '../behavior-editor';
import { CardEditorCanvas, CardInspector } from '../card-editor';
import { ExportMenu } from '../export';
import { HistoryControls } from '../history';
import { CardNavigator } from './CardNavigator';
import { moveCardInOrder, nextSelectionAfterDelete, resolveSelectedCardId } from './cardSelection';
import './workspace.css';

export interface WorkspacePageProps {
  stackId: string;
  cardId?: string;
}

const cardPath = (stackId: string, cardId: string): string =>
  `/stack/${encodeURIComponent(stackId)}/card/${encodeURIComponent(cardId)}`;

function Message({ children, retry }: { children: ReactNode; retry?: () => void }): ReactNode {
  return (
    <WorkspaceLayout
      navigator={null}
      canvas={
        <div className="gs-workspace-pane">
          <p className="gs-error" role="alert">
            {children}
          </p>
          {retry ? (
            <button type="button" className="gs-btn" onClick={retry}>
              Retry
            </button>
          ) : null}
        </div>
      }
      inspector={null}
    />
  );
}

export function WorkspacePage({ stackId, cardId }: WorkspacePageProps): ReactNode {
  const { load, retry } = useStackSession(stackId);
  if (load.status === 'loading') {
    return (
      <WorkspaceLayout
        navigator={<p className="gs-empty">Loading stack…</p>}
        canvas={null}
        inspector={null}
      />
    );
  }
  if (load.status === 'not-found') {
    return (
      <Message>Stack not found. It may have been deleted. Open the Library to pick another stack.</Message>
    );
  }
  if (load.status === 'error') {
    return <Message retry={retry}>Could not load the stack: {load.message}</Message>;
  }
  return <ReadyWorkspace session={load.session} stackId={stackId} requestedCardId={cardId} />;
}

interface ReadyProps {
  session: StackSession;
  stackId: string;
  requestedCardId: string | undefined;
}

function ReadyWorkspace({ session, stackId, requestedCardId }: ReadyProps): ReactNode {
  const stack: Stack = useSessionStack(session);
  const status = useSessionStatus(session);
  const [actionError, setActionError] = useState<string | undefined>();
  const [viewport, setViewport] = useState<ViewportPresetId>('desktop');
  const [selection, setSelection] = useState<{ cardId: string; elementId: string } | undefined>();

  const selectedCardId = resolveSelectedCardId(stack, requestedCardId);
  const selectedElementId =
    selection && selection.cardId === selectedCardId ? selection.elementId : undefined;

  /** Dispatches one command. Returns true when it was applied. */
  const run = (command: ProjectCommand): boolean => {
    const result = session.dispatch(command);
    setActionError(result.ok ? undefined : `${result.error.code}: ${result.error.message}`);
    return result.ok;
  };

  const slotProps: EditorSlotProps | undefined = selectedCardId
    ? {
        session,
        cardId: selectedCardId,
        selectedElementId,
        onSelectElement: (elementId) =>
          setSelection(elementId === undefined ? undefined : { cardId: selectedCardId, elementId }),
        viewport,
        onViewportChange: setViewport,
      }
    : undefined;

  return (
    <WorkspaceLayout
      navigator={
        <CardNavigator
          stack={stack}
          selectedCardId={selectedCardId}
          busy={status.saveState === 'saving'}
          referenceCount={(id) => findCardReferences(stack, id).length}
          onSelect={(id) => navigate(cardPath(stackId, id))}
          onAdd={() => {
            const newId = crypto.randomUUID();
            if (run({ type: 'ADD_CARD', cardId: newId, title: `Card ${stack.cardOrder.length + 1}` })) {
              navigate(cardPath(stackId, newId));
            }
          }}
          onRename={(id, title) => void run({ type: 'RENAME_CARD', cardId: id, title })}
          onDuplicate={(id) => {
            const newId = crypto.randomUUID();
            if (run({ type: 'DUPLICATE_CARD', cardId: id, newCardId: newId })) {
              navigate(cardPath(stackId, newId));
            }
          }}
          onMove={(id, delta) => {
            const order = moveCardInOrder(stack.cardOrder, id, delta);
            if (order) run({ type: 'REORDER_CARDS', cardOrder: order });
          }}
          onDelete={(id) => {
            const fallback = nextSelectionAfterDelete(stack.cardOrder, id);
            if (run({ type: 'DELETE_CARD', cardId: id }) && id === selectedCardId && fallback) {
              navigate(cardPath(stackId, fallback));
            }
          }}
        />
      }
      toolbar={
        slotProps ? (
          <>
            <HistoryControls {...slotProps} />
            <ExportMenu {...slotProps} />
          </>
        ) : null
      }
      canvas={
        <>
          {actionError ? (
            <p className="gs-error" role="alert">
              {actionError}
            </p>
          ) : null}
          {slotProps ? (
            <CardEditorCanvas {...slotProps} />
          ) : (
            <p className="gs-empty">This stack has no cards. Add a card to begin.</p>
          )}
        </>
      }
      inspector={slotProps ? <CardInspector {...slotProps} /> : null}
      drawer={slotProps ? <BehaviorEditorPanel {...slotProps} /> : undefined}
    />
  );
}
