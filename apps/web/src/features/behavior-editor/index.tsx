import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { printGhostScript } from '@ghoststack/behavior';
import type { Behavior, StateVariable } from '@ghoststack/shared-contracts';
import { useSessionStack } from '../../app/useStackSession';
import type { EditorSlotProps } from '../../app/editorContext';
import { BehaviorBlocks } from './BehaviorBlocks';
import { ScriptEditor } from './ScriptEditor';
import { StateEditor } from './StateEditor';
import { buildContext, checkScript, completionWords } from './model';
import './behavior.css';

type Tab = 'blocks' | 'script' | 'state';
const TABS: { id: Tab; label: string }[] = [
  { id: 'blocks', label: 'Blocks' },
  { id: 'script', label: 'GhostScript' },
  { id: 'state', label: 'Variables' },
];

/** Workspace drawer: edits the behaviors of the selected element, or of the card when none is selected. */
export function BehaviorEditorPanel({ session, cardId, selectedElementId }: EditorSlotProps): ReactNode {
  const stack = useSessionStack(session);
  const [tab, setTab] = useState<Tab>('blocks');
  const [error, setError] = useState<string | undefined>();
  const [draft, setDraft] = useState<{ owner: string; text: string } | undefined>();
  const typingRef = useRef(false);

  const card = stack.cards[cardId];
  const element = card?.elements.find((e) => e.elementId === selectedElementId);
  const ownerKey = `${cardId}/${element?.elementId ?? ''}`;
  const owner = element ? { cardId, elementId: element.elementId } : { cardId };
  const behaviors: Behavior[] = (element ? element.behaviors : card?.behaviors) ?? [];
  const ownerType = element ? element.type : 'card';
  const markTyping = (): void => {
    typingRef.current = true;
  };
  // markTyping only runs in event handlers, never during render.
  // eslint-disable-next-line react-hooks/refs
  const ctx = buildContext(stack, cardId, markTyping);
  const printed = printGhostScript(behaviors);

  const commit = (next: Behavior[]): boolean => {
    const key = typingRef.current ? `behavior:${ownerKey}` : undefined;
    typingRef.current = false;
    const r = session.dispatch(
      { type: 'UPDATE_BEHAVIOR', ...owner, behaviors: next },
      key === undefined ? undefined : { coalesceKey: key },
    );
    setError(r.ok ? undefined : r.error.message);
    return r.ok;
  };

  const commitSchema = (next: Record<string, StateVariable>): void => {
    const r = session.dispatch({ type: 'UPDATE_STATE_SCHEMA', stateSchema: next });
    setError(r.ok ? undefined : r.error.message);
  };

  const scriptText = draft && draft.owner === ownerKey ? draft.text : printed;
  const check =
    tab === 'script' ? checkScript(scriptText, stack, owner, new Date().toISOString()) : { issues: [] };

  if (!card) return null;
  const ownerLabel = element ? `${element.name || element.type} (${element.type})` : `card "${card.title}"`;

  return (
    <div className="gs-beh-panel">
      <div className="gs-beh-top">
        <p className="gs-panel-title">Behaviors for {ownerLabel}</p>
        <div role="tablist" aria-label="Behavior editor" className="gs-beh-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`gs-btn${tab === t.id ? ' gs-btn--primary' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {error ? (
        <p className="gs-error" role="alert">
          {error}
        </p>
      ) : null}
      {tab === 'blocks' ? (
        <BehaviorBlocks
          behaviors={behaviors}
          ownerType={ownerType}
          ctx={ctx}
          onChange={commit}
          newId={() => `b-${crypto.randomUUID().slice(0, 8)}`}
        />
      ) : null}
      {tab === 'script' ? (
        <div className="gs-beh-scriptwrap">
          <ScriptEditor
            label="GhostScript"
            value={scriptText}
            words={completionWords(ctx)}
            diagnostics={check.issues}
            onChange={(text) => {
              setDraft({ owner: ownerKey, text });
              const c = checkScript(text, stack, owner, new Date().toISOString());
              if (c.behaviors) {
                typingRef.current = true;
                commit(c.behaviors);
              }
            }}
          />
          {check.issues.length > 0 ? (
            <ul className="gs-error" role="alert" aria-label="Script problems">
              {check.issues.map((d, i) => (
                <li key={i}>
                  Line {d.line}, column {d.column}: {d.message}
                </li>
              ))}
            </ul>
          ) : (
            <p className="gs-beh-hint">Script is valid and saved.</p>
          )}
        </div>
      ) : null}
      {tab === 'state' ? <StateEditor schema={stack.stateSchema} onChange={commitSchema} /> : null}
    </div>
  );
}
