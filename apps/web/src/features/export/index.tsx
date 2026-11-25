import type { ReactNode } from 'react';
import type { EditorSlotProps } from '../../app/editorContext';

/**
 * PLACEHOLDERS written by the orchestrator. The `preview-export` worktree replaces both
 * components and owns this folder.
 * - `ExportMenu` is mounted in the workspace toolbar: Preview, Export .gsp, Export web app.
 * - `ImportGspButton` is mounted by the orchestrator in the Project Library at merge.
 */
export function ExportMenu(props: EditorSlotProps): ReactNode {
  void props;
  return null;
}

export function ImportGspButton(): ReactNode {
  return null;
}
