import { buildContext, dryRunPlan, parsePlan, summarizePlan } from '@ghoststack/ai-core';
import { validateStack } from '@ghoststack/domain';
import { err, ok } from '@ghoststack/shared-contracts';
import type {
  AIPlan,
  CheckpointRepository,
  GhostError,
  Result,
  StackSession,
} from '@ghoststack/shared-contracts';
import type { Proposal } from '../proposals';
import type { BridgeMethod } from './protocol';
export const MAX_PENDING_PROPOSALS = 10;
export interface BridgeHandlerDeps {
  /** The session of the Stack open in the editor right now. */
  getSession(): StackSession;
  checkpoints: Pick<CheckpointRepository, 'put'>;
  /** `enqueueProposal` from `features/ai/proposals.ts`. The only way a plan leaves the bridge. */
  enqueue(input: { plan: AIPlan; source: Proposal['source'] }): Proposal;
  pendingCount(): number;
  now(): string;
  newId(): string;
}
export interface BridgeHandlers {
  handle(method: BridgeMethod, params: unknown): Promise<Result<unknown, GhostError>>;
}
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const fail = (code: GhostError['code'], message: string): Result<never, GhostError> => err({ code, message });
/**
 * Answers the MCP server's requests from the live session. The only session members used are
 * `getStack()` (read) and nothing else: this module never calls `dispatch`, `restore`, `undo` or `redo`.
 * A plan only reaches `enqueue`, and the review UI applies it after Approve.
 */
export function createBridgeHandlers(deps: BridgeHandlerDeps): BridgeHandlers {
  const summary = (): Result<unknown, GhostError> => {
    const ctx = buildContext(deps.getSession().getStack(), { kind: 'stack' });
    if (!ctx.ok) return ctx;
    const { stack, cards, truncated } = ctx.value;
    return ok({ stackId: deps.getSession().stackId, ...stack, cards, truncated });
  };
  const card = (params: unknown): Result<unknown, GhostError> => {
    const cardId = isRecord(params) ? params['cardId'] : undefined;
    if (typeof cardId !== 'string' || cardId.length === 0 || cardId.length > 128) {
      return fail('INVALID_AI_PLAN', 'cardId must be a Card id from get_stack_summary.');
    }
    const ctx = buildContext(deps.getSession().getStack(), { kind: 'card', cardId });
    if (!ctx.ok) return ctx;
    const detail = ctx.value.detail[0];
    if (detail === undefined) {
      return fail('INVALID_AI_PLAN', 'That Card is too large to return in one answer.');
    }
    return ok({ card: detail });
  };
  const validate = (): Result<unknown, GhostError> => {
    const r = validateStack(deps.getSession().getStack());
    return ok(r.ok ? { valid: true } : { valid: false, problem: r.error.message.slice(0, 500) });
  };
  const propose = (params: unknown): Result<unknown, GhostError> => {
    const parsed = parsePlan(isRecord(params) ? params['plan'] : undefined);
    if (!parsed.ok) return parsed;
    if (deps.pendingCount() >= MAX_PENDING_PROPOSALS) {
      return fail(
        'INVALID_AI_PLAN',
        `${MAX_PENDING_PROPOSALS} proposals are already waiting for the creator. Wait until some are reviewed.`,
      );
    }
    const stack = deps.getSession().getStack();
    const dry = dryRunPlan(stack, parsed.value, deps.now());
    if (!dry.ok) {
      const where = dry.error.stepId ? ` (step ${dry.error.stepId})` : '';
      return fail(
        dry.error.code,
        `The plan does not apply to the current Stack${where}: ${dry.error.message}`,
      );
    }
    if (dry.value.status !== 'ok') return fail('INVALID_AI_PLAN', 'The plan check was cancelled.');
    const proposal = deps.enqueue({ plan: parsed.value, source: 'mcp' });
    const view = summarizePlan(stack, parsed.value);
    return ok({
      proposalId: proposal.id,
      stepCount: view.stepCount,
      waitingForApproval: deps.pendingCount(),
    });
  };
  const checkpoint = async (params: unknown): Promise<Result<unknown, GhostError>> => {
    const label = isRecord(params) ? params['label'] : undefined;
    if (typeof label !== 'string' || label.trim().length === 0 || label.length > 80) {
      return fail('CHECKPOINT_FAILED', 'A checkpoint needs a label of 1 to 80 characters.');
    }
    const session = deps.getSession();
    const checkpointId = deps.newId();
    try {
      await deps.checkpoints.put({
        checkpointId,
        stackId: session.stackId,
        label: `Agent: ${label.trim()}`,
        kind: 'manual',
        createdAt: deps.now(),
        stack: session.getStack(),
      });
    } catch {
      return fail('CHECKPOINT_FAILED', 'The checkpoint could not be saved.');
    }
    return ok({ checkpointId, label: `Agent: ${label.trim()}` });
  };
  return {
    async handle(method, params) {
      try {
        switch (method) {
          case 'stack.summary':
            return summary();
          case 'card.details':
            return card(params);
          case 'project.validate':
            return validate();
          case 'proposal.submit':
            return propose(params);
          case 'checkpoint.create':
            return await checkpoint(params);
        }
      } catch {
        return fail('MCP_CONNECTION_FAILED', 'The editor could not answer that request.');
      }
    },
  };
}
