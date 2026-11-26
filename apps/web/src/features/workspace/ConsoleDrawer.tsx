import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { createRuntime } from '@ghoststack/behavior';
import { validateStack } from '@ghoststack/domain';
import { Tabs } from '../../components';
import { useSessionStack, useSessionStatus } from '../../app/useStackSession';
import type { EditorSlotProps } from '../../app/editorContext';
import { BehaviorEditorPanel } from '../behavior-editor';

function ProblemsPanel({ session }: EditorSlotProps): ReactNode {
  const stack = useSessionStack(session);
  const status = useSessionStatus(session);
  const problems = useMemo(() => {
    const found: string[] = [];
    const v = validateStack(stack);
    if (!v.ok) found.push(v.error.message);
    if (status.saveState === 'error') found.push(`Saving failed: ${status.error ?? 'unknown error'}`);
    return found;
  }, [stack, status.saveState, status.error]);
  if (problems.length === 0) {
    return <p className="gs-ws-note">No problems. The stack is valid and saved or saving.</p>;
  }
  return (
    <ul className="gs-error gs-ws-list" aria-label="Problems">
      {problems.map((m) => (
        <li key={m}>{m}</li>
      ))}
    </ul>
  );
}

function RuntimePanel({ session, cardId }: EditorSlotProps): ReactNode {
  const stack = useSessionStack(session);
  const card = stack.cards[cardId];
  const run = useMemo(() => {
    try {
      return { snapshot: createRuntime(stack, { startCardId: cardId }).start() };
    } catch (e) {
      return { failure: e instanceof Error ? e.message : String(e) };
    }
  }, [stack, cardId]);
  if (run.failure !== undefined) {
    return (
      <p className="gs-error" role="alert">
        The dry run could not start: {run.failure}
      </p>
    );
  }
  const { snapshot } = run;
  const vars = Object.entries(snapshot.state);
  return (
    <div className="gs-ws-runtime">
      <p className="gs-ws-note">
        Dry run of entering {card ? `"${card.title || 'Untitled card'}"` : 'this card'}. Your project is not
        changed. Open Preview to click through it.
      </p>
      {vars.length === 0 ? (
        <p className="gs-empty">No variables. Add one in the Variables tab of the Behavior console.</p>
      ) : (
        <table className="gs-ws-vars" aria-label="Variables after card enter">
          <thead>
            <tr>
              <th scope="col">Variable</th>
              <th scope="col">Value</th>
            </tr>
          </thead>
          <tbody>
            {vars.map(([k, v]) => (
              <tr key={k}>
                <th scope="row">{k}</th>
                <td>
                  <code>{JSON.stringify(v)}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {snapshot.errors.length > 0 ? (
        <ul className="gs-error gs-ws-list" aria-label="Dry run errors">
          {snapshot.errors.map((e, i) => (
            <li key={i}>{e.message}</li>
          ))}
        </ul>
      ) : (
        <p className="gs-ws-note">No runtime errors on card enter.</p>
      )}
    </div>
  );
}

/** Console and validation drawer: behavior editor, validation problems and a read-only runtime dry run. */
export function ConsoleDrawer(
  props: EditorSlotProps & { tab: string; onTab: (id: string) => void },
): ReactNode {
  const { tab, onTab, ...slot } = props;
  return (
    <Tabs
      label="Console"
      value={tab}
      onChange={onTab}
      tabs={[
        { id: 'behavior', label: 'Behavior', panel: <BehaviorEditorPanel {...slot} /> },
        { id: 'problems', label: 'Problems', panel: <ProblemsPanel {...slot} /> },
        { id: 'runtime', label: 'Runtime', panel: <RuntimePanel {...slot} /> },
      ]}
    />
  );
}
