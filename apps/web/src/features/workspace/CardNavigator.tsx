import { useEffect, useRef, useState } from 'react';
import type { DragEvent, FormEvent, ReactNode } from 'react';
import type { Stack } from '@ghoststack/shared-contracts';
import { Button } from '../../components';
import { CardThumbnail } from '../project-library/CardThumbnail';
import './CardNavigator.css';

export interface CardNavigatorProps {
  stack: Stack;
  selectedCardId: string | undefined;
  busy: boolean;
  /** Number of behaviors that navigate to the card. Shown before a delete. */
  referenceCount: (cardId: string) => number;
  onSelect: (cardId: string) => void;
  onAdd: () => void;
  onRename: (cardId: string, title: string) => void;
  onDuplicate: (cardId: string) => void;
  onMove: (cardId: string, delta: -1 | 1) => void;
  onDelete: (cardId: string) => void;
}

/** A drag in progress that is carried out one adjacent move at a time through `onMove`. */
interface PendingMove {
  cardId: string;
  targetIndex: number;
}

export function CardNavigator(props: CardNavigatorProps): ReactNode {
  const {
    stack,
    selectedCardId,
    busy,
    referenceCount,
    onSelect,
    onAdd,
    onRename,
    onDuplicate,
    onMove,
    onDelete,
  } = props;
  const [renamingId, setRenamingId] = useState<string | undefined>();
  const [draft, setDraft] = useState('');
  const [confirmId, setConfirmId] = useState<string | undefined>();
  const [dragId, setDragId] = useState<string | undefined>();
  const [overId, setOverId] = useState<string | undefined>();
  const pending = useRef<PendingMove | undefined>(undefined);
  const dragRef = useRef<string | undefined>(undefined);
  const moveRef = useRef(onMove);
  useEffect(() => {
    moveRef.current = onMove;
  });
  const lastIndex = stack.cardOrder.length - 1;

  // `onMove` moves one step per call, so a long drag continues each time the order changes.
  useEffect(() => {
    const p = pending.current;
    if (!p || busy) return;
    const at = stack.cardOrder.indexOf(p.cardId);
    if (at < 0 || at === p.targetIndex) {
      pending.current = undefined;
      return;
    }
    moveRef.current(p.cardId, at < p.targetIndex ? 1 : -1);
  }, [stack.cardOrder, busy]);

  function submitRename(e: FormEvent, cardId: string): void {
    e.preventDefault();
    const title = draft.trim();
    if (title) onRename(cardId, title);
    setRenamingId(undefined);
  }

  function drop(e: DragEvent, targetId: string): void {
    e.preventDefault();
    const cardId = dragRef.current ?? dragId;
    dragRef.current = undefined;
    setDragId(undefined);
    setOverId(undefined);
    if (!cardId || cardId === targetId || busy) return;
    const from = stack.cardOrder.indexOf(cardId);
    const to = stack.cardOrder.indexOf(targetId);
    if (from < 0 || to < 0) return;
    pending.current = { cardId, targetIndex: to };
    onMove(cardId, from < to ? 1 : -1);
  }

  return (
    <nav className="gs-workspace-nav" aria-label="Cards">
      <p className="gs-panel-title">Cards ({stack.cardOrder.length})</p>
      <Button variant="primary" disabled={busy} onClick={onAdd}>
        Add card
      </Button>
      {stack.cardOrder.length === 0 ? (
        <p className="gs-empty">No cards yet. Choose Add card to start.</p>
      ) : (
        <ul className="gs-workspace-list">
          {stack.cardOrder.map((cardId, i) => {
            const card = stack.cards[cardId];
            if (!card) return null;
            const selected = cardId === selectedCardId;
            const label = card.title || 'Untitled card';
            const refs = referenceCount(cardId);
            return (
              <li
                key={cardId}
                className="gs-workspace-item gs-navigator-item"
                data-selected={selected}
                data-dragging={dragId === cardId || undefined}
                data-over={overId === cardId && dragId !== cardId ? true : undefined}
                draggable={!busy && renamingId !== cardId && confirmId !== cardId}
                onDragStart={(e) => {
                  dragRef.current = cardId;
                  setDragId(cardId);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', cardId);
                }}
                onDragOver={(e) => {
                  if (!dragRef.current) return;
                  e.preventDefault();
                  setOverId(cardId);
                }}
                onDragLeave={() => setOverId((o) => (o === cardId ? undefined : o))}
                onDrop={(e) => drop(e, cardId)}
                onDragEnd={() => {
                  setDragId(undefined);
                  setOverId(undefined);
                }}
              >
                {renamingId === cardId ? (
                  <form className="gs-workspace-confirm" onSubmit={(e) => submitRename(e, cardId)}>
                    <label>
                      <span className="gs-panel-title">Card title</span>
                      <input
                        className="gs-input"
                        value={draft}
                        autoFocus
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setRenamingId(undefined);
                        }}
                      />
                    </label>
                    <div className="gs-workspace-actions">
                      <Button type="submit" variant="primary" disabled={busy || !draft.trim()}>
                        Save
                      </Button>
                      <Button onClick={() => setRenamingId(undefined)}>Cancel</Button>
                    </div>
                  </form>
                ) : (
                  <div className="gs-navigator-select">
                    <div
                      className="gs-navigator-thumb"
                      aria-hidden="true"
                      draggable={!busy}
                      onClick={() => onSelect(cardId)}
                    >
                      <CardThumbnail stack={stack} cardId={cardId} />
                    </div>
                    <button
                      type="button"
                      className="gs-workspace-select gs-navigator-label"
                      aria-current={selected ? 'true' : undefined}
                      onClick={() => onSelect(cardId)}
                    >
                      <span className="gs-navigator-index" aria-hidden="true">
                        {i + 1}
                      </span>
                      {label}
                      {cardId === stack.entryCardId ? (
                        <span className="gs-navigator-badge">Entry</span>
                      ) : null}
                    </button>
                  </div>
                )}
                {confirmId === cardId ? (
                  <div className="gs-workspace-confirm" role="alertdialog" aria-label={`Delete ${label}`}>
                    <span>
                      Delete &ldquo;{label}&rdquo;?
                      {refs > 0
                        ? ` ${refs} behavior${refs === 1 ? '' : 's'} navigate${refs === 1 ? 's' : ''} to it. Those actions will be removed.`
                        : ''}
                    </span>
                    <div className="gs-workspace-actions">
                      <Button
                        variant="danger"
                        disabled={busy}
                        onClick={() => {
                          setConfirmId(undefined);
                          onDelete(cardId);
                        }}
                      >
                        Confirm delete
                      </Button>
                      <Button autoFocus onClick={() => setConfirmId(undefined)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="gs-workspace-actions gs-navigator-actions">
                    <Button
                      aria-label={`Rename ${label}`}
                      disabled={busy}
                      onClick={() => {
                        setDraft(card.title);
                        setRenamingId(cardId);
                      }}
                    >
                      Rename
                    </Button>
                    <Button
                      aria-label={`Duplicate ${label}`}
                      disabled={busy}
                      onClick={() => onDuplicate(cardId)}
                    >
                      Duplicate
                    </Button>
                    <Button
                      aria-label={`Move ${label} up`}
                      disabled={busy || i === 0}
                      onClick={() => onMove(cardId, -1)}
                    >
                      Up
                    </Button>
                    <Button
                      aria-label={`Move ${label} down`}
                      disabled={busy || i === lastIndex}
                      onClick={() => onMove(cardId, 1)}
                    >
                      Down
                    </Button>
                    <Button
                      variant="danger"
                      aria-label={`Delete ${label}`}
                      disabled={busy}
                      onClick={() => setConfirmId(cardId)}
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}
