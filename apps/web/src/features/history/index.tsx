import type { ReactNode } from 'react';
import { useSessionStatus } from '../../app/useStackSession';
import type { EditorSlotProps } from '../../app/editorContext';

const LABEL = { saved: 'Saved', saving: 'Saving…', dirty: 'Unsaved changes', error: 'Save failed' } as const;

/**
 * PLACEHOLDER written by the orchestrator. The `history` worktree replaces this component (undo,
 * redo, save state, checkpoints) and also implements `createStackSessionFactory` in this folder,
 * which the orchestrator wires into `app/services.tsx` at merge.
 */
export function HistoryControls({ session }: EditorSlotProps): ReactNode {
  const status = useSessionStatus(session);
  return (
    <span role="status" className={status.saveState === 'error' ? 'gs-error' : undefined}>
      {LABEL[status.saveState]}
      {status.error ? `: ${status.error}` : ''}
    </span>
  );
}
