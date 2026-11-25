import { WorkspaceLayout } from '../../app/AppShell';

export interface WorkspacePageProps {
  stackId: string;
  cardId?: string;
}

/** Owner: worktree `workspace` (VS-02). Replace this page; keep the export name and props. */
export function WorkspacePage({ stackId }: WorkspacePageProps) {
  return (
    <WorkspaceLayout
      navigator={<p className="gs-panel-title">Cards ({stackId})</p>}
      canvas={<p className="gs-empty">Workspace is not implemented yet (VS-02).</p>}
      inspector={<p className="gs-panel-title">Inspector</p>}
    />
  );
}
