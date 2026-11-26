import type { ReactNode } from 'react';

export interface EmptyStateProps {
  title: string;
  /** Names the cause and the next step. */
  children?: ReactNode;
  action?: ReactNode;
  tone?: 'empty' | 'error';
}
export function EmptyState({ title, children, action, tone = 'empty' }: EmptyStateProps): ReactNode {
  return (
    <div
      className={`gs-kit-state ${tone === 'error' ? 'gs-error' : 'gs-empty'}`}
      role={tone === 'error' ? 'alert' : undefined}
    >
      <p className="gs-kit-statetitle">{title}</p>
      {children ? <p className="gs-kit-statebody">{children}</p> : null}
      {action ? <div className="gs-kit-stateaction">{action}</div> : null}
    </div>
  );
}
