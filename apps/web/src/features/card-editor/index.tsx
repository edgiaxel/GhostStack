import type { ReactNode } from 'react';
import { useSessionStack } from '../../app/useStackSession';
import type { EditorSlotProps } from '../../app/editorContext';

/**
 * PLACEHOLDER written by the orchestrator. The `card-editor` worktree replaces both components
 * (keep the names and the `EditorSlotProps` signature) and owns everything in this folder.
 */
export function CardEditorCanvas({ session, cardId }: EditorSlotProps): ReactNode {
  const card = useSessionStack(session).cards[cardId];
  return (
    <div className="gs-workspace-pane">
      <h2 className="gs-workspace-card-title">{card?.title || 'Untitled card'}</h2>
    </div>
  );
}

export function CardInspector(props: EditorSlotProps): ReactNode {
  void props;
  return (
    <div className="gs-workspace-pane">
      <p className="gs-panel-title">Inspector</p>
      <p className="gs-empty">Element editing is not available yet.</p>
    </div>
  );
}
