import type { AIPlan } from '@ghoststack/shared-contracts';

/**
 * Approval queue for plans that did not come from the creator's own prompt (MCP agent, imported
 * plan file). Locked by the orchestrator: M3.3 renders it in the panel, M3.5 only calls
 * `enqueueProposal`. A proposal is never applied from here; applying needs the review UI Approve.
 */
export interface Proposal {
  id: string;
  plan: AIPlan;
  source: 'mcp' | 'file';
  receivedAt: string;
}

let queue: Proposal[] = [];
const listeners = new Set<() => void>();
const emit = (): void => listeners.forEach((l) => l());

/** The plan must already have passed `parsePlan`; the review UI runs `dryRunPlan` again. */
export function enqueueProposal(input: { plan: AIPlan; source: Proposal['source'] }): Proposal {
  const proposal: Proposal = {
    id: crypto.randomUUID(),
    plan: input.plan,
    source: input.source,
    receivedAt: new Date().toISOString(),
  };
  queue = [...queue, proposal];
  emit();
  return proposal;
}

export function listProposals(): readonly Proposal[] {
  return queue;
}

export function dismissProposal(id: string): void {
  queue = queue.filter((p) => p.id !== id);
  emit();
}

export function subscribeProposals(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
