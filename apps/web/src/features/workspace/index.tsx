import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { findCardReferences } from '@ghoststack/domain';
import { VIEWPORT_PRESETS } from '@ghoststack/shared-contracts';
import type {
  ElementType,
  ProjectCommand,
  Stack,
  StackSession,
  ViewportPresetId,
  ZPlacement,
} from '@ghoststack/shared-contracts';
import { WorkspaceLayout } from '../../app/AppShell';
import { navigate } from '../../app/router';
import { useSessionStack, useSessionStatus, useStackSession } from '../../app/useStackSession';
import type { EditorSlotProps } from '../../app/editorContext';
import { AssetPanel, CardEditorCanvas, CardInspector } from '../card-editor';
import { addElementToCard, isDesignViewport } from '../card-editor/CardCanvas';
import {
  alignElements,
  deleteElements,
  dispatchAll,
  distributeElements,
  duplicateElements,
  gestureKey,
  pasteElements,
} from '../card-editor/canvas-actions';
import { copyToClipboard, useClipboardFilled } from '../card-editor/clipboard';
import type { Align, Axis } from '../card-editor/geometry';
import { FIT, stepZoom } from '../card-editor/zoom';
import type { ZoomState } from '../card-editor/zoom';
import { Toolbar } from '../../components';
import { ExportMenu, useExportActions } from '../export';
import { HistoryControls, isEditableTarget } from '../history';
import { CardNavigator } from './CardNavigator';
import { moveCardInOrder, nextSelectionAfterDelete, resolveSelectedCardId } from './cardSelection';
import { ConsoleDrawer } from './ConsoleDrawer';
import { EditorShell } from './EditorShell';
import { MenuBar } from './MenuBar';
import { ShortcutSheet } from './ShortcutSheet';
import { StatusBar } from './StatusBar';
import { ToolRail } from './ToolRail';
import type { Tool } from './ToolRail';
import { buildMenus } from './menus';
import { matchShortcut } from './shortcuts';
import type { ShortcutId } from './shortcuts';
import { usePanels } from './usePanels';
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

const SAVE_TEXT = {
  saved: 'Saved',
  saving: 'Saving…',
  dirty: 'Unsaved changes',
  error: 'Save failed',
} as const;

const TOOL_ELEMENT: Partial<Record<ShortcutId, ElementType>> = {
  'tool-text': 'text',
  'tool-button': 'button',
  'tool-input': 'input',
  'tool-image': 'image',
  'tool-shape': 'shape',
  'tool-line': 'line',
};

const VIEWPORTS = (Object.keys(VIEWPORT_PRESETS) as ViewportPresetId[]).map((id) => ({
  id,
  label: VIEWPORT_PRESETS[id].label,
}));

function ReadyWorkspace({ session, stackId, requestedCardId }: ReadyProps): ReactNode {
  const stack: Stack = useSessionStack(session);
  const status = useSessionStatus(session);
  const [actionError, setActionError] = useState<string | undefined>();
  const [viewport, setViewport] = useState<ViewportPresetId>('desktop');
  const [selection, setSelection] = useState<{ cardId: string; ids: string[] } | undefined>();
  const [assetsOpen, setAssetsOpen] = useState(false);
  const hasClipboard = useClipboardFilled();
  const [zoom, setZoom] = useState<ZoomState>(FIT);
  const [scale, setScale] = useState(1);
  const [tool, setTool] = useState<Tool>('select');
  const [drawerTab, setDrawerTab] = useState('behavior');
  const [helpOpen, setHelpOpen] = useState(false);
  const panels = usePanels();
  const exportActions = useExportActions(session);
  const selectedCardId = resolveSelectedCardId(stack, requestedCardId);
  const card = selectedCardId ? stack.cards[selectedCardId] : undefined;
  // An id may outlive its element (undo, delete): keep only elements that exist on this card.
  const selectedIds =
    selection && selection.cardId === selectedCardId
      ? selection.ids.filter((id) => card?.elements.some((e) => e.elementId === id))
      : [];
  const selectedElementId = selectedIds.length === 1 ? selectedIds[0] : undefined;
  const selectedElement = card?.elements.find((e) => e.elementId === selectedElementId);
  const canEdit = isDesignViewport(stack, viewport);

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
          setSelection(elementId === undefined ? undefined : { cardId: selectedCardId, ids: [elementId] }),
        viewport,
        onViewportChange: setViewport,
      }
    : undefined;

  const addCard = (): void => {
    const newId = crypto.randomUUID();
    if (run({ type: 'ADD_CARD', cardId: newId, title: `Card ${stack.cardOrder.length + 1}` })) {
      navigate(cardPath(stackId, newId));
    }
  };
  const insert = (type: ElementType): void => {
    if (!slotProps) return;
    const r = addElementToCard(session, slotProps.cardId, type);
    setActionError(r.ok ? undefined : r.message);
    if (r.ok) {
      slotProps.onSelectElement(r.elementId);
      setTool('select');
    }
  };
  const select = (ids: string[]): void => {
    if (selectedCardId) setSelection(ids.length === 0 ? undefined : { cardId: selectedCardId, ids });
  };
  /** Runs a canvas action and shows its message when it fails. Returns the ids it created, if any. */
  const act = (r: { ok: true; elementIds: string[] } | { ok: false; message: string }): string[] => {
    setActionError(r.ok ? undefined : r.message);
    return r.ok ? r.elementIds : [];
  };
  const deleteSelected = (): void => {
    if (!slotProps || selectedIds.length === 0 || !canEdit) return;
    const r = deleteElements(session, slotProps.cardId, selectedIds);
    act(r);
    if (r.ok) select([]);
  };
  const copySelected = (): void => {
    if (!card || selectedIds.length === 0) return;
    copyToClipboard(
      stack.stackId,
      card.elements.filter((e) => selectedIds.includes(e.elementId)),
    );
    setActionError(undefined);
  };
  const pasteClipboard = (): void => {
    if (!slotProps || !canEdit) return;
    const created = act(pasteElements(session, slotProps.cardId));
    if (created.length > 0) select(created);
  };
  const duplicateSelected = (): void => {
    if (!slotProps || selectedIds.length === 0 || !canEdit) return;
    const created = act(duplicateElements(session, slotProps.cardId, selectedIds));
    if (created.length > 0) select(created);
  };
  const selectAll = (): void => {
    if (card && canEdit) select(card.elements.map((e) => e.elementId));
  };
  const align = (mode: Align): void => {
    if (slotProps && canEdit) act(alignElements(session, slotProps.cardId, selectedIds, mode));
  };
  const distribute = (axis: Axis): void => {
    if (slotProps && canEdit) act(distributeElements(session, slotProps.cardId, selectedIds, axis));
  };
  const reorder = (placement: ZPlacement): void => {
    if (!slotProps || !card || selectedIds.length === 0) return;
    // Several elements keep their relative order: send the front-most first to the back, the back-most first to the front.
    const chosen = card.elements
      .filter((e) => selectedIds.includes(e.elementId))
      .sort((a, b) =>
        placement === 'back' ? b.layout.zIndex - a.layout.zIndex : a.layout.zIndex - b.layout.zIndex,
      );
    const r = dispatchAll(
      session,
      chosen.map((e) => ({
        type: 'REORDER_ELEMENT' as const,
        cardId: slotProps.cardId,
        elementId: e.elementId,
        placement,
      })),
      gestureKey('reorder'),
    );
    act(r);
  };
  const zoomIn = (): void => setZoom({ mode: 'manual', scale: stepZoom(scale, 1) });
  const zoomOut = (): void => setZoom({ mode: 'manual', scale: stepZoom(scale, -1) });
  const zoomFit = (): void => setZoom(FIT);
  const zoomActual = (): void => setZoom({ mode: 'manual', scale: 1 });
  const onScaleChange = useCallback((s: number) => setScale(s), []);

  const handleShortcut = (id: ShortcutId): void => {
    const element = TOOL_ELEMENT[id];
    if (element) return insert(element);
    if (id === 'save') void session.flush();
    else if (id === 'delete') deleteSelected();
    else if (id === 'copy') copySelected();
    else if (id === 'paste') pasteClipboard();
    else if (id === 'duplicate') duplicateSelected();
    else if (id === 'select-all') selectAll();
    else if (id === 'deselect') slotProps?.onSelectElement(undefined);
    else if (id === 'tool-select') setTool('select');
    else if (id === 'tool-hand') setTool('hand');
    else if (id === 'zoom-in') zoomIn();
    else if (id === 'zoom-out') zoomOut();
    else if (id === 'zoom-fit') zoomFit();
    else if (id === 'zoom-actual') zoomActual();
    else if (id === 'help') setHelpOpen(true);
  };
  const latest = useRef(handleShortcut);
  useEffect(() => {
    latest.current = handleShortcut;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.defaultPrevented) return;
      const id = matchShortcut(e);
      if (!id) return;
      const t = e.target instanceof HTMLElement ? e.target : null;
      if (id !== 'save') {
        if (isEditableTarget(e.target)) return;
        if (t?.closest('dialog, [role="menu"], [role="tablist"], [role="separator"], .cm-editor')) return;
        if (id === 'delete' && t?.closest('.gs-ce-el')) return;
      }
      e.preventDefault();
      latest.current(id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const menus = buildMenus({
    canUndo: status.canUndo,
    canRedo: status.canRedo,
    selectionCount: selectedIds.length,
    hasClipboard,
    canEdit: canEdit && slotProps !== undefined,
    busy: exportActions.busy,
    viewport,
    viewports: VIEWPORTS,
    panelCollapsed: (id) => panels.prefs[id].collapsed,
    undo: () => session.undo(),
    redo: () => session.redo(),
    save: () => void session.flush(),
    deleteSelected,
    copy: copySelected,
    paste: pasteClipboard,
    duplicate: duplicateSelected,
    selectAll,
    align,
    distribute,
    openAssets: () => setAssetsOpen(true),
    deselect: () => slotProps?.onSelectElement(undefined),
    insert,
    addCard,
    reorder,
    zoomIn,
    zoomOut,
    zoomFit,
    zoomActual,
    setViewport,
    togglePanel: panels.toggle,
    resetLayout: panels.reset,
    openLibrary: () => navigate('/library'),
    preview: exportActions.preview,
    exportGsp: exportActions.exportGsp,
    exportWeb: exportActions.exportWeb,
    showShortcuts: () => setHelpOpen(true),
  });

  const preset = VIEWPORT_PRESETS[viewport];
  const cardIndex = selectedCardId ? stack.cardOrder.indexOf(selectedCardId) : -1;
  return (
    <>
      <EditorShell
        prefs={panels.prefs}
        onSize={panels.setSize}
        onToggle={panels.toggle}
        menubar={<MenuBar menus={menus} />}
        toolbar={
          slotProps ? (
            <Toolbar label="Stack actions">
              <HistoryControls {...slotProps} />
              <span className="gs-spacer" />
              <ExportMenu {...slotProps} actions={exportActions} />
            </Toolbar>
          ) : null
        }
        toolrail={
          slotProps ? <ToolRail tool={tool} onTool={setTool} onInsert={insert} canInsert={canEdit} /> : null
        }
        navigator={
          <CardNavigator
            stack={stack}
            selectedCardId={selectedCardId}
            busy={status.saveState === 'saving'}
            referenceCount={(id) => findCardReferences(stack, id).length}
            onSelect={(id) => navigate(cardPath(stackId, id))}
            onAdd={addCard}
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
        canvas={
          <>
            {actionError ? (
              <p className="gs-error" role="alert">
                {actionError}
              </p>
            ) : null}
            {slotProps ? (
              <CardEditorCanvas
                {...slotProps}
                zoom={zoom}
                onZoomChange={setZoom}
                onScaleChange={onScaleChange}
                panMode={tool === 'hand'}
                selectedIds={selectedIds}
                onSelectionChange={select}
              />
            ) : (
              <p className="gs-empty">This stack has no cards. Add a card to begin.</p>
            )}
          </>
        }
        inspector={
          slotProps ? (
            <CardInspector
              {...slotProps}
              selectedIds={selectedIds}
              onOpenBehavior={() => {
                setDrawerTab('behavior');
                if (panels.prefs.drawer.collapsed) panels.toggle('drawer');
              }}
            />
          ) : null
        }
        drawer={
          slotProps ? (
            <ConsoleDrawer {...slotProps} tab={drawerTab} onTab={setDrawerTab} />
          ) : (
            <p className="gs-empty">Add a card to edit behaviors.</p>
          )
        }
        statusbar={
          <StatusBar
            cardPosition={cardIndex >= 0 ? `Card ${cardIndex + 1} of ${stack.cardOrder.length}` : 'No card'}
            saveText={SAVE_TEXT[status.saveState]}
            saveError={status.saveState === 'error'}
            selected={
              selectedIds.length > 1
                ? `Selected: ${selectedIds.length} elements`
                : selectedElement
                  ? `Selected: ${selectedElement.name || selectedElement.type} (${selectedElement.type})`
                  : 'Nothing selected'
            }
            scale={scale}
            fitMode={zoom.mode === 'fit'}
            viewport={`${preset.label} ${preset.width} × ${preset.height}`}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onFit={zoomFit}
            onActual={zoomActual}
          />
        }
      />
      <ShortcutSheet open={helpOpen} onClose={() => setHelpOpen(false)} />
      <AssetPanel session={session} open={assetsOpen} onClose={() => setAssetsOpen(false)} />
    </>
  );
}
