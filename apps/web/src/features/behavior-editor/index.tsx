import type { ReactNode } from 'react';
import type { EditorSlotProps } from '../../app/editorContext';

/**
 * PLACEHOLDER written by the orchestrator. The `behavior` worktree replaces this component
 * (keep the name and the `EditorSlotProps` signature). It renders in the workspace drawer slot and
 * owns everything in this folder.
 */
export function BehaviorEditorPanel(props: EditorSlotProps): ReactNode {
  void props;
  return <p className="gs-empty">The behavior editor is not available yet.</p>;
}
