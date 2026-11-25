import type { ReactNode } from 'react';

/**
 * PLACEHOLDER written by the orchestrator. The `preview-export` worktree replaces this page
 * (route `/stack/:stackId/preview`). It must run the Stack through `@ghoststack/player`.
 */
export function PreviewPage({ stackId }: { stackId: string }): ReactNode {
  void stackId;
  return <p className="gs-empty">Preview is not available yet.</p>;
}
