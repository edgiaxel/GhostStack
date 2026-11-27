import { useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { Button } from '../../components';
import { dismissProposal, listProposals, subscribeProposals } from './proposals';
import type { Proposal } from './proposals';
const SOURCE: Record<Proposal['source'], string> = { mcp: 'External agent', file: 'Plan file' };
export function useProposals(): readonly Proposal[] {
  return useSyncExternalStore(subscribeProposals, listProposals);
}
/** Plans that did not come from the creator's own prompt. Applying one needs the same review and Approve. */
export function ProposalsList({
  disabled,
  onReview,
}: {
  disabled: boolean;
  onReview(proposal: Proposal): void;
}): ReactNode {
  const proposals = useProposals();
  if (proposals.length === 0) return null;
  return (
    <section className="gs-ai-card" aria-label="Proposals waiting for review" data-testid="ai-proposals">
      <h4>Waiting for your review ({proposals.length})</h4>
      <ul className="gs-ai-steps">
        {proposals.map((p) => (
          <li key={p.id} className="gs-ai-step" data-testid="ai-proposal">
            <span>{p.plan.summary}</span>
            <span className="gs-ai-muted">
              {SOURCE[p.source]}, {p.plan.steps.length} {p.plan.steps.length === 1 ? 'step' : 'steps'},{' '}
              {new Date(p.receivedAt).toLocaleTimeString()}
            </span>
            <div className="gs-ai-actions">
              <Button
                variant="primary"
                disabled={disabled}
                aria-label={`Review: ${p.plan.summary}`}
                onClick={() => onReview(p)}
              >
                Review
              </Button>
              <Button aria-label={`Dismiss: ${p.plan.summary}`} onClick={() => dismissProposal(p.id)}>
                Dismiss
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
