import type { ReactNode } from 'react';
import type { OperationReport, TransactionProgress } from '@ghoststack/ai-core';
import { Button, Dialog } from '../../components';
import { ErrorPanel } from './ErrorPanel';
import type { OperationError } from './operation';
import type { ProviderState } from './store';
export function PlanningView({
  provider,
  onCancel,
}: {
  provider: ProviderState;
  onCancel(): void;
}): ReactNode {
  return (
    <div className="gs-ai-stack" data-testid="ai-planning">
      <p>Asking {provider.description?.label ?? 'the provider'} for a plan. Your project is not changed.</p>
      <progress className="gs-ai-progress" aria-label="Waiting for the provider" />
      <div className="gs-ai-actions">
        <Button onClick={onCancel}>Cancel request</Button>
      </div>
    </div>
  );
}
export function ApplyingView({
  progress,
  onCancel,
}: {
  progress: TransactionProgress | undefined;
  onCancel(): void;
}): ReactNode {
  const total = progress?.stepCount ?? 0;
  return (
    <div className="gs-ai-stack" data-testid="ai-applying">
      <p>{progress?.message ?? 'Starting.'}</p>
      <progress
        className="gs-ai-progress"
        aria-label="Applying the plan"
        max={Math.max(total, 1)}
        value={progress?.stepIndex ?? 0}
      />
      <div className="gs-ai-actions">
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
export function ReportView({
  report,
  revertError,
  redact,
  onRevert,
  onReset,
}: {
  report: OperationReport;
  revertError: OperationError | undefined;
  redact: (text: string) => string;
  onRevert(): void;
  onReset(): void;
}): ReactNode {
  const { summary } = report;
  return (
    <div className="gs-ai-stack" data-testid="ai-report">
      <p>
        Applied {report.stepCount} {report.stepCount === 1 ? 'step' : 'steps'}: {summary.summary}
      </p>
      <ul className="gs-ai-list">
        {summary.cards.map((c) => (
          <li key={c.cardId}>
            <strong>{c.title || 'Untitled card'}</strong>
            <ul className="gs-ai-list">
              {c.sentences.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </li>
        ))}
        {summary.stack.sentences.map((s, i) => (
          <li key={`s${i}`}>{s}</li>
        ))}
      </ul>
      <p className="gs-ai-muted">
        This is one step in undo history. Revert restores the project as it was before, unless you have edited
        it since.
      </p>
      {revertError ? <ErrorPanel error={revertError} redact={redact} onDismiss={onReset} /> : null}
      <div className="gs-ai-actions">
        <Button variant="danger" onClick={onRevert}>
          Revert AI change
        </Button>
        <Button onClick={onReset}>New request</Button>
      </div>
    </div>
  );
}
export function RevertedView({ onReset }: { onReset(): void }): ReactNode {
  return (
    <div className="gs-ai-stack" data-testid="ai-reverted">
      <p>The AI change was reverted. Your project is back to how it was before.</p>
      <div className="gs-ai-actions">
        <Button variant="primary" onClick={onReset}>
          New request
        </Button>
      </div>
    </div>
  );
}
export function ConsentDialog({
  open,
  provider,
  onConfirm,
  onDecline,
}: {
  open: boolean;
  provider: ProviderState;
  onConfirm(): void;
  onDecline(): void;
}): ReactNode {
  const d = provider.description;
  const name = d?.label ?? 'the provider';
  return (
    // Escape closes only this dialog, not the dock that contains it.
    <div
      onKeyDown={(e) => {
        if (e.key === 'Escape') e.stopPropagation();
      }}
    >
      <Dialog
        open={open}
        title={`Send data to ${name}?`}
        onClose={onDecline}
        actions={
          <>
            <Button onClick={onDecline}>Do not send</Button>
            <Button variant="primary" onClick={onConfirm}>
              Send to {name}
            </Button>
          </>
        }
      >
        <div className="gs-ai-stack" data-testid="ai-consent">
          <p>
            {name}
            {d?.baseUrl ? ` at ${d.baseUrl}` : ''} is a remote server. When you ask for a plan, these items
            leave this computer:
          </p>
          <ul className="gs-ai-list">
            <li>Your request text.</li>
            <li>The project title and the state variables.</li>
            <li>Card titles and element counts.</li>
            <li>
              Element names, text and settings of the selected card, or of the whole project if you chose
              that.
            </li>
          </ul>
          <p>
            Images and other asset files are not sent. Your API key is used to sign in and is never saved.
          </p>
          <p className="gs-ai-muted">You are asked once per session for this provider.</p>
        </div>
      </Dialog>
    </div>
  );
}
