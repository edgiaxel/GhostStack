import { applyPlan, parseAIPlan, reviewPlan } from '@ghoststack/ai-core';
import type { AIIssue, AIPlan, PlanReview } from '@ghoststack/ai-core';
import { err, ok, validateProject } from '@ghoststack/domain';
import type { ProjectBundle, Result, ValidationError } from '@ghoststack/domain';

export const MAX_PENDING_PROPOSALS = 20;
/** Validator details carry identifiers verbatim, so each one is capped before it reaches an agent. */
export const MAX_DETAIL_CHARS = 100;

export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'applied' | 'failed';

export interface Proposal {
  readonly proposalId: string;
  readonly source: string;
  readonly submittedAt: string;
  readonly plan: AIPlan;
  readonly review: PlanReview;
  readonly status: ProposalStatus;
  /** Set when the editor decided or applied the proposal. */
  readonly decidedAt?: string;
  readonly detail?: string;
}

/** A snapshot copy taken at an agent's request. It lives in memory only, so it is not durable. */
export interface BridgeCheckpoint {
  readonly checkpointId: string;
  readonly label: string;
  readonly createdAt: string;
  readonly stackId: string;
  readonly bundle: ProjectBundle;
}

export interface BridgeCoreOptions {
  /** Called after a proposal was queued, with every pending proposal. Used by the stdio fallback. */
  readonly onProposalQueued?: (pending: readonly Proposal[]) => void;
  readonly clock?: () => string;
  readonly newId?: (prefix: string) => string;
}

export interface SafeValidationError {
  readonly code: ValidationError['code'];
  readonly path: ValidationError['path'];
  readonly details: ValidationError['details'];
}

const randomId = (prefix: string): string => {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  return `${prefix}_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
};

export type BridgeCheckpointSummary = Omit<BridgeCheckpoint, 'bundle'>;

const summarize = (record: BridgeCheckpoint): BridgeCheckpointSummary => ({
  checkpointId: record.checkpointId,
  label: record.label,
  createdAt: record.createdAt,
  stackId: record.stackId,
});

const capDetails = (details: ValidationError['details']): ValidationError['details'] =>
  Object.fromEntries(
    Object.entries(details).map(([key, value]) => [
      key,
      typeof value === 'string' && value.length > MAX_DETAIL_CHARS
        ? `${value.slice(0, MAX_DETAIL_CHARS)}...`
        : value,
    ]),
  );

const issue = (code: AIIssue['code'], message: string): AIIssue => ({ code, message, path: [] });

/**
 * The bridge's view of the world. The editor owns the project: it publishes snapshots here, and
 * decides proposals. Nothing in this module can change the editor's stored project, so an external
 * agent can only read the snapshot and queue proposals.
 */
export function createBridgeCore(options: BridgeCoreOptions = {}) {
  const clock = options.clock ?? (() => new Date().toISOString());
  const newId = options.newId ?? randomId;
  let snapshot: ProjectBundle | undefined;
  let revision = 0;
  const proposals = new Map<string, Proposal>();
  const checkpoints = new Map<string, BridgeCheckpoint>();

  const pendingCount = () => [...proposals.values()].filter((p) => p.status === 'pending').length;

  return {
    /** Editor side. Replaces the snapshot with a deep copy and bumps the revision. */
    publishProject(bundle: ProjectBundle): { revision: number } {
      snapshot = structuredClone(bundle);
      revision += 1;
      return { revision };
    },

    /** Agent side. Returns a copy, so a caller can never reach the stored snapshot. */
    readProject(): Result<{ bundle: ProjectBundle; revision: number }, AIIssue> {
      return snapshot === undefined
        ? err(issue('PROVIDER_UNAVAILABLE', 'No project has been published to the bridge yet.'))
        : ok({ bundle: structuredClone(snapshot), revision });
    },

    /** Validation of the snapshot. Reports codes and locations only, never project values. */
    validateSnapshot(): Result<
      { valid: boolean; errors: readonly SafeValidationError[] },
      AIIssue
    > {
      if (snapshot === undefined) {
        return err(
          issue('PROVIDER_UNAVAILABLE', 'No project has been published to the bridge yet.'),
        );
      }
      const { errors } = validateProject(snapshot.stack);
      return ok({
        valid: errors.length === 0,
        errors: errors.map(({ code, path, details }) => ({
          code,
          path,
          details: capDetails(details),
        })),
      });
    },

    /**
     * Parses the plan, dry-runs it on a copy of the snapshot and validates the result, then queues
     * it as pending. Invalid plans are rejected here with feedback and never enter the queue.
     */
    submitProposal(
      input: unknown,
      source: string,
    ): Result<Proposal, { issues: readonly AIIssue[] }> {
      if (snapshot === undefined) {
        return err({
          issues: [issue('PROVIDER_UNAVAILABLE', 'No project has been published yet.')],
        });
      }
      if (pendingCount() >= MAX_PENDING_PROPOSALS) {
        return err({
          issues: [issue('TRANSACTION_FAILED', 'Too many proposals are waiting for approval.')],
        });
      }
      const parsed = parseAIPlan(input);
      if (!parsed.ok) return err({ issues: parsed.issues });
      const applied = applyPlan(snapshot.stack, parsed.plan);
      if (!applied.ok) {
        return err({
          issues: [
            {
              code: applied.error.code,
              message: `Command ${applied.error.commandIndex} cannot be applied: ${applied.error.message}`,
              path: applied.error.path,
            },
          ],
        });
      }
      const { errors } = validateProject(applied.value.project);
      if (errors.length > 0) {
        return err({
          issues: [
            issue(
              'PROJECT_VALIDATION_FAILED',
              `The plan would produce an invalid project (${errors.length} problem(s)).`,
            ),
          ],
        });
      }
      const proposal: Proposal = {
        proposalId: newId('prp'),
        source,
        submittedAt: clock(),
        plan: parsed.plan,
        review: reviewPlan(parsed.plan),
        status: 'pending',
      };
      proposals.set(proposal.proposalId, proposal);
      options.onProposalQueued?.(
        structuredClone([...proposals.values()].filter((p) => p.status === 'pending')),
      );
      return ok(structuredClone(proposal));
    },

    listProposals(status?: ProposalStatus): readonly Proposal[] {
      return structuredClone(
        [...proposals.values()].filter((p) => status === undefined || p.status === status),
      );
    },

    getProposal(proposalId: string): Proposal | undefined {
      const found = proposals.get(proposalId);
      return found === undefined ? undefined : structuredClone(found);
    },

    /** Editor side. Only a pending proposal can be decided, and only once. */
    decideProposal(
      proposalId: string,
      status: Exclude<ProposalStatus, 'pending'>,
      detail?: string,
    ): Result<Proposal, AIIssue> {
      const found = proposals.get(proposalId);
      if (found === undefined) return err(issue('TRANSACTION_FAILED', 'No such proposal.'));
      const allowed: Record<ProposalStatus, readonly ProposalStatus[]> = {
        pending: ['approved', 'rejected'],
        approved: ['applied', 'failed'],
        rejected: [],
        applied: [],
        failed: [],
      };
      if (!allowed[found.status].includes(status)) {
        return err(
          issue('TRANSACTION_FAILED', `A ${found.status} proposal cannot become ${status}.`),
        );
      }
      const next: Proposal = {
        ...found,
        status,
        decidedAt: clock(),
        ...(detail === undefined ? {} : { detail }),
      };
      proposals.set(proposalId, next);
      return ok(structuredClone(next));
    },

    /** Copies the current snapshot under a name. Does not touch the project. */
    createCheckpoint(label: string): Result<BridgeCheckpointSummary, AIIssue> {
      if (snapshot === undefined) {
        return err(issue('CHECKPOINT_FAILED', 'No project has been published to the bridge yet.'));
      }
      const record: BridgeCheckpoint = {
        checkpointId: newId('chk'),
        label,
        createdAt: clock(),
        stackId: snapshot.stack.stackId,
        bundle: structuredClone(snapshot),
      };
      checkpoints.set(record.checkpointId, record);
      return ok(summarize(record));
    },

    listCheckpoints(): readonly BridgeCheckpointSummary[] {
      return [...checkpoints.values()].map(summarize);
    },
  };
}

export type BridgeCore = ReturnType<typeof createBridgeCore>;
