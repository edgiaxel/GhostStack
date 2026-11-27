import { useId } from 'react';
import type { ReactNode } from 'react';
import type { AIPlan, AIPlanStep } from '@ghoststack/shared-contracts';
import { Button } from '../../components';
import { ErrorPanel } from './ErrorPanel';
import { boundText } from './errors';
import type { Evaluation, Origin, OperationError, StepState } from './operation';
const STEP_TEXT: Record<StepState, string> = {
  ok: 'Checks out',
  failed: 'Does not apply',
  unchecked: 'Not checked',
};
const STEP_TONE: Record<StepState, string> = { ok: 'ok', failed: 'error', unchecked: 'idle' };
const CARD_STATE: Record<string, string> = { new: 'New card', changed: 'Changed', removed: 'Removed card' };
const ORIGIN_TEXT: Record<'mcp' | 'file', string> = {
  mcp: 'Proposed by an external agent. Nothing has changed yet.',
  file: 'Loaded from a plan file. Nothing has changed yet.',
};
function StepItem({
  step,
  state,
  failure,
}: {
  step: AIPlanStep;
  state: StepState;
  failure: string | undefined;
}): ReactNode {
  return (
    <li className="gs-ai-step" data-state={state} data-testid="ai-step">
      <span>{step.rationale || 'A change to your project.'}</span>
      <span className="gs-ai-row">
        <span className="gs-ai-badge" data-tone={STEP_TONE[state]}>
          {STEP_TEXT[state]}
        </span>
      </span>
      <details className="gs-ai-details">
        <summary>Command details</summary>
        {state === 'failed' && failure ? <p className="gs-ai-code">{failure}</p> : null}
        <pre className="gs-ai-code">{JSON.stringify(step.command, null, 2)}</pre>
      </details>
    </li>
  );
}
export interface ReviewViewProps {
  plan: AIPlan;
  origin: Origin;
  evaluation: Evaluation;
  applyError?: OperationError | undefined;
  notice?: string | undefined;
  redact: (text: string) => string;
  onApprove(): void;
  onReject(): void;
  onRevise(): void;
}
/** Plan review grouped by Card. Approve stays disabled until every step passes the dry run. */
export function ReviewView({
  plan,
  origin,
  evaluation,
  applyError,
  notice,
  redact,
  onApprove,
  onReject,
  onRevise,
}: ReviewViewProps): ReactNode {
  const blockedId = useId();
  const byId = new Map(plan.steps.map((s) => [s.id, s]));
  const failureText = evaluation.error ? boundText(redact(evaluation.error.message)) : undefined;
  const renderSteps = (ids: string[]): ReactNode => (
    <ul className="gs-ai-steps">
      {ids.map((id) => {
        const step = byId.get(id);
        return step ? (
          <StepItem key={id} step={step} state={evaluation.steps[id] ?? 'unchecked'} failure={failureText} />
        ) : null;
      })}
    </ul>
  );
  const { summary } = evaluation;
  return (
    <div className="gs-ai-stack" data-testid="ai-review">
      <p>{plan.summary}</p>
      {origin.kind === 'proposal' ? <p className="gs-ai-muted">{ORIGIN_TEXT[origin.source]}</p> : null}
      {summary.cards.map((group) => (
        <section key={group.cardId} className="gs-ai-card" aria-label={`Card ${group.title}`}>
          <div className="gs-ai-row">
            <h4>{group.title || 'Untitled card'}</h4>
            <span className="gs-ai-badge" data-tone="idle">
              {CARD_STATE[group.state] ?? group.state}
            </span>
          </div>
          <ul className="gs-ai-list">
            {group.sentences.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
          {renderSteps(group.stepIds)}
        </section>
      ))}
      {summary.stack.stepIds.length > 0 ? (
        <section className="gs-ai-card" aria-label="Whole project">
          <h4>Whole project</h4>
          <ul className="gs-ai-list">
            {summary.stack.sentences.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
          {renderSteps(summary.stack.stepIds)}
        </section>
      ) : null}
      {!evaluation.ok ? (
        <p id={blockedId} className="gs-error" role="alert">
          Some steps do not apply to your project as it is now, so Approve is off. Reject the plan
          {origin.kind === 'prompt' ? ' or revise the request' : ''}.
        </p>
      ) : null}
      {applyError ? (
        <ErrorPanel error={applyError} redact={redact} onRetry={onApprove} onDismiss={onReject} />
      ) : null}
      {notice ? (
        <p className="gs-ai-muted" role="status">
          {notice}
        </p>
      ) : null}
      <div className="gs-ai-actions">
        <Button
          variant="primary"
          disabled={!evaluation.ok}
          aria-describedby={!evaluation.ok ? blockedId : undefined}
          onClick={onApprove}
        >
          Approve and apply
        </Button>
        <Button onClick={onReject}>Reject</Button>
        {origin.kind === 'prompt' ? <Button onClick={onRevise}>Revise request</Button> : null}
      </div>
    </div>
  );
}
