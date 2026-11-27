import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '../../components';
import { presentError } from './errors';
import type { ErrorAction } from './errors';
import type { OperationError } from './operation';
export interface ErrorPanelProps {
  error: OperationError;
  redact: (text: string) => string;
  onRetry?: (() => void) | undefined;
  onEditRequest?: (() => void) | undefined;
  onOpenSettings?: (() => void) | undefined;
  onDismiss?: (() => void) | undefined;
}
const LABEL: Record<ErrorAction, string> = {
  retry: 'Try again',
  'edit-request': 'Edit the request',
  'open-settings': 'Open provider settings',
  dismiss: 'Dismiss',
};
/** Failure with its cause and next step. Shows fixed text only: never a raw provider body or a key. */
export function ErrorPanel({
  error,
  redact,
  onRetry,
  onEditRequest,
  onOpenSettings,
  onDismiss,
}: ErrorPanelProps): ReactNode {
  const view = presentError(error, redact);
  const [left, setLeft] = useState(view.retryAfterMs ?? 0);
  useEffect(() => {
    if (left <= 0) return;
    const t = setInterval(() => setLeft((l) => Math.max(0, l - 250)), 250);
    return () => clearInterval(t);
  }, [left > 0]); // eslint-disable-line react-hooks/exhaustive-deps
  const handlers: Record<ErrorAction, (() => void) | undefined> = {
    retry: onRetry,
    'edit-request': onEditRequest,
    'open-settings': onOpenSettings,
    dismiss: onDismiss,
  };
  const seconds = Math.ceil(left / 1000);
  return (
    <div className="gs-ai-error" role="alert" data-testid="ai-error" data-code={view.code}>
      <p>
        <strong>{view.title}</strong>
      </p>
      {view.message ? <p>{view.message}</p> : null}
      <p>{view.next}</p>
      {view.retryAfterMs !== undefined ? (
        <p>{left > 0 ? `You can try again in about ${seconds} seconds.` : 'You can try again now.'}</p>
      ) : null}
      {view.detail ? (
        <details className="gs-ai-details">
          <summary>Details</summary>
          <p className="gs-ai-code">{view.detail}</p>
        </details>
      ) : null}
      <div className="gs-ai-actions">
        {view.actions.map((a) => {
          const run = handlers[a];
          if (!run) return null;
          return (
            <Button
              key={a}
              variant={a === 'retry' ? 'primary' : 'default'}
              disabled={a === 'retry' && left > 0}
              onClick={run}
            >
              {LABEL[a]}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
