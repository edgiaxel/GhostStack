import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { Stack } from '@ghoststack/shared-contracts';

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
  const lastIndex = stack.cardOrder.length - 1;

  function submitRename(e: FormEvent, cardId: string): void {
    e.preventDefault();
    const title = draft.trim();
    if (title) onRename(cardId, title);
    setRenamingId(undefined);
  }

  return (
    <nav className="gs-workspace-nav" aria-label="Cards">
      <p className="gs-panel-title">Cards ({stack.cardOrder.length})</p>
      <button type="button" className="gs-btn gs-btn--primary" disabled={busy} onClick={onAdd}>
        Add card
      </button>
      {stack.cardOrder.length === 0 ? (
        <p className="gs-empty">No cards yet. Add one to start.</p>
      ) : (
        <ul className="gs-workspace-list">
          {stack.cardOrder.map((cardId, i) => {
            const card = stack.cards[cardId];
            if (!card) return null;
            const selected = cardId === selectedCardId;
            const label = card.title || 'Untitled card';
            return (
              <li key={cardId} className="gs-workspace-item" data-selected={selected}>
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
                      <button
                        type="submit"
                        className="gs-btn gs-btn--primary"
                        disabled={busy || !draft.trim()}
                      >
                        Save
                      </button>
                      <button type="button" className="gs-btn" onClick={() => setRenamingId(undefined)}>
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    className="gs-workspace-select"
                    aria-current={selected ? 'true' : undefined}
                    onClick={() => onSelect(cardId)}
                  >
                    {label}
                    {cardId === stack.entryCardId ? ' (entry)' : ''}
                  </button>
                )}
                {confirmId === cardId ? (
                  <div className="gs-workspace-confirm" role="alertdialog" aria-label={`Delete ${label}`}>
                    <span>
                      Delete “{label}”?
                      {referenceCount(cardId) > 0
                        ? ` ${referenceCount(cardId)} behavior(s) navigate to it. Those actions will be removed.`
                        : ''}
                    </span>
                    <div className="gs-workspace-actions">
                      <button
                        type="button"
                        className="gs-btn gs-btn--danger"
                        disabled={busy}
                        onClick={() => {
                          setConfirmId(undefined);
                          onDelete(cardId);
                        }}
                      >
                        Confirm delete
                      </button>
                      <button type="button" className="gs-btn" onClick={() => setConfirmId(undefined)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="gs-workspace-actions">
                    <button
                      type="button"
                      className="gs-btn"
                      aria-label={`Rename ${label}`}
                      disabled={busy}
                      onClick={() => {
                        setDraft(card.title);
                        setRenamingId(cardId);
                      }}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className="gs-btn"
                      aria-label={`Duplicate ${label}`}
                      disabled={busy}
                      onClick={() => onDuplicate(cardId)}
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      className="gs-btn"
                      aria-label={`Move ${label} up`}
                      disabled={busy || i === 0}
                      onClick={() => onMove(cardId, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="gs-btn"
                      aria-label={`Move ${label} down`}
                      disabled={busy || i === lastIndex}
                      onClick={() => onMove(cardId, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="gs-btn gs-btn--danger"
                      aria-label={`Delete ${label}`}
                      disabled={busy}
                      onClick={() => setConfirmId(cardId)}
                    >
                      Delete
                    </button>
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
