import { useSyncExternalStore } from 'react';
import {
  buildContext,
  dryRunPlan,
  orderSteps,
  parsePlan,
  revertOperation,
  runTransaction,
  serializePlan,
  summarizePlan,
} from '@ghoststack/ai-core';
import type { OperationReport, PlanSummary, TransactionProgress } from '@ghoststack/ai-core';
import type {
  AIPlan,
  CheckpointRepository,
  ContextScope,
  GhostError,
  Stack,
  StackSession,
} from '@ghoststack/shared-contracts';
import { dismissProposal } from './proposals';
import type { Proposal } from './proposals';
import type { ProviderStore } from './store';
/** An error that may also carry the wait a provider asked for. */
export type OperationError = GhostError & { retryAfterMs?: number };
export type Origin =
  { kind: 'prompt' } | { kind: 'proposal'; proposalId: string; source: Proposal['source'] };
export type StepState = 'ok' | 'failed' | 'unchecked';
export interface Evaluation {
  /** True when every step applies to the current Stack and the result validates. */
  ok: boolean;
  summary: PlanSummary;
  /** Dry-run status per step id. */
  steps: Record<string, StepState>;
  /** Why the dry run failed. Absent when `ok`. */
  error: OperationError | undefined;
}
/**
 * Dry run of a plan against the Stack as it is now, with a status for every step: steps before the
 * failing one pass, the failing one fails, later ones are not checked. Pure; never touches a session.
 */
export function evaluatePlan(stack: Stack, plan: AIPlan, now: string): Evaluation {
  const summary = summarizePlan(stack, plan);
  const steps: Record<string, StepState> = {};
  const dry = dryRunPlan(stack, plan, now);
  if (dry.ok && dry.value.status === 'ok') {
    for (const s of plan.steps) steps[s.id] = 'ok';
    return { ok: true, summary, steps, error: undefined };
  }
  const error: OperationError = dry.ok
    ? { code: 'TRANSACTION_FAILED', message: 'The check was cancelled.' }
    : dry.error;
  const failedId = dry.ok ? undefined : dry.error.stepId;
  const ordered = orderSteps(plan);
  const order = ordered.ok ? ordered.value : plan.steps;
  if (failedId === undefined) {
    // Every step applied but the result does not validate, or the plan itself is unusable (cycle).
    const applied = error.code === 'PROJECT_VALIDATION_FAILED';
    for (const s of order) steps[s.id] = applied ? 'ok' : 'unchecked';
  } else {
    let reached = false;
    for (const s of order) {
      if (s.id === failedId) {
        steps[s.id] = 'failed';
        reached = true;
      } else steps[s.id] = reached ? 'unchecked' : 'ok';
    }
  }
  return { ok: false, summary, steps, error };
}
export type OperationState =
  | { phase: 'idle'; error?: OperationError; notice?: string }
  | { phase: 'planning' }
  | {
      phase: 'review';
      plan: AIPlan;
      origin: Origin;
      /** Set when the last Approve failed or was cancelled. The plan stays open for another try. */
      applyError?: OperationError;
      notice?: string;
    }
  | { phase: 'applying'; plan: AIPlan; origin: Origin; progress: TransactionProgress | undefined }
  | { phase: 'done'; origin: Origin; report: OperationReport; revertError?: OperationError }
  | { phase: 'reverted'; report: OperationReport };
export interface OperationDraft {
  prompt: string;
  scopeKind: 'stack' | 'card';
}
export interface OperationSnapshot {
  state: OperationState;
  draft: OperationDraft;
  /** True while the remote consent dialog must be answered before a request is sent. */
  consentPending: boolean;
}
export interface OperationDeps {
  session: StackSession;
  checkpoints: Pick<CheckpointRepository, 'put'>;
  providers: ProviderStore;
  now?: () => string;
  newId?: () => string;
}
export interface OperationController {
  /** Points the controller at the session that is open now. The panel calls it on every mount. */
  bind(session: StackSession): void;
  getSnapshot(): OperationSnapshot;
  subscribe(listener: () => void): () => void;
  setDraft(patch: Partial<OperationDraft>): void;
  /** Sends the request. A remote provider first needs the creator's consent for this session. */
  submit(scope: ContextScope): Promise<void>;
  confirmConsent(scope: ContextScope): Promise<void>;
  declineConsent(): void;
  /** Aborts planning or applying. Nothing changes in the Stack before the commit step. */
  cancel(): void;
  openProposal(proposal: Proposal): void;
  /** Applies the open plan. Does nothing unless the plan passes the dry run against the current Stack. */
  approve(): Promise<void>;
  /** Closes the review without changing anything. A proposal is removed from the queue. */
  reject(): void;
  /** Back to the prompt with the previous text. Prompt plans only. */
  revise(): void;
  revert(): void;
  reset(): void;
}
const cancelledNotice = 'Cancelled. Your project was not changed.';
export function createOperationController(deps: OperationDeps): OperationController {
  let session = deps.session;
  const now = deps.now ?? ((): string => new Date().toISOString());
  const newId = deps.newId ?? ((): string => crypto.randomUUID());
  const listeners = new Set<() => void>();
  let snapshot: OperationSnapshot = {
    state: { phase: 'idle' },
    draft: { prompt: '', scopeKind: 'card' },
    consentPending: false,
  };
  let abort: AbortController | undefined;
  /** Bumped by every cancel or new request so a late provider answer is ignored. */
  let epoch = 0;
  const set = (patch: Partial<OperationSnapshot>): void => {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach((l) => l());
  };
  const fail = (error: OperationError): void => set({ state: { phase: 'idle', error } });
  const toReview = (plan: AIPlan, origin: Origin): void => set({ state: { phase: 'review', plan, origin } });
  async function send(scope: ContextScope): Promise<void> {
    const prompt = snapshot.draft.prompt.trim();
    if (prompt === '') return;
    const adapter = deps.providers.getAdapter();
    if (!adapter) {
      fail({ code: 'PROVIDER_UNSUPPORTED_CAPABILITY', message: 'Choose a provider in the settings first.' });
      return;
    }
    const context = buildContext(session.getStack(), scope);
    if (!context.ok) {
      fail(context.error);
      return;
    }
    const mine = ++epoch;
    const controller = new AbortController();
    abort = controller;
    set({ state: { phase: 'planning' }, consentPending: false });
    let result: Awaited<ReturnType<typeof adapter.generatePlan>>;
    try {
      result = await adapter.generatePlan({ context: context.value, prompt, signal: controller.signal });
    } catch {
      result = {
        ok: false,
        error: { code: 'PROVIDER_UNAVAILABLE', message: 'The provider could not be reached.' },
      };
    }
    if (mine !== epoch) return;
    abort = undefined;
    if (controller.signal.aborted) {
      set({ state: { phase: 'idle', notice: 'Request cancelled. Your project was not changed.' } });
      return;
    }
    if (!result.ok) {
      fail(result.error);
      return;
    }
    const parsed = parsePlan(result.value);
    if (!parsed.ok) {
      fail(parsed.error);
      return;
    }
    toReview(parsed.value, { kind: 'prompt' });
  }
  const controllerApi: OperationController = {
    bind(next) {
      session = next;
    },
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setDraft(patch) {
      set({ draft: { ...snapshot.draft, ...patch } });
    },
    async submit(scope) {
      if (snapshot.state.phase === 'planning' || snapshot.state.phase === 'applying') return;
      const adapter = deps.providers.getAdapter();
      if (adapter && !adapter.capabilities.local && !deps.providers.hasConsent()) {
        set({ consentPending: true });
        return;
      }
      await send(scope);
    },
    async confirmConsent(scope) {
      if (!snapshot.consentPending) return;
      deps.providers.grantConsent();
      await send(scope);
    },
    declineConsent() {
      set({ consentPending: false });
    },
    cancel() {
      const s = snapshot.state;
      if (s.phase === 'planning') {
        epoch += 1;
        abort?.abort();
        abort = undefined;
        set({ state: { phase: 'idle', notice: 'Request cancelled. Your project was not changed.' } });
      } else if (s.phase === 'applying') {
        abort?.abort();
      }
    },
    openProposal(proposal) {
      const phase = snapshot.state.phase;
      if (phase === 'planning' || phase === 'applying' || phase === 'review') return;
      const parsed = parsePlan(proposal.plan);
      if (!parsed.ok) {
        dismissProposal(proposal.id);
        fail(parsed.error);
        return;
      }
      toReview(parsed.value, { kind: 'proposal', proposalId: proposal.id, source: proposal.source });
    },
    async approve() {
      const s = snapshot.state;
      if (s.phase !== 'review') return;
      const check = evaluatePlan(session.getStack(), s.plan, now());
      if (!check.ok) {
        set({
          state: {
            ...s,
            applyError: check.error ?? { code: 'INVALID_PATCH_COMMAND', message: 'A step does not apply.' },
          },
        });
        return;
      }
      const { plan, origin } = s;
      const controller = new AbortController();
      abort = controller;
      set({ state: { phase: 'applying', plan, origin, progress: undefined } });
      const outcome = await runTransaction(session, plan, {
        approvedPlan: serializePlan(plan),
        checkpoints: deps.checkpoints,
        now: now(),
        newId,
        signal: controller.signal,
        onProgress: (progress) => {
          if (snapshot.state.phase === 'applying') set({ state: { ...snapshot.state, progress } });
        },
      });
      abort = undefined;
      if (!outcome.ok) {
        set({ state: { phase: 'review', plan, origin, applyError: outcome.error } });
        return;
      }
      if (outcome.value.state === 'cancelled') {
        set({ state: { phase: 'review', plan, origin, notice: cancelledNotice } });
        return;
      }
      if (origin.kind === 'proposal') dismissProposal(origin.proposalId);
      set({ state: { phase: 'done', origin, report: outcome.value.report } });
    },
    reject() {
      const s = snapshot.state;
      if (s.phase !== 'review') return;
      if (s.origin.kind === 'proposal') dismissProposal(s.origin.proposalId);
      set({ state: { phase: 'idle', notice: 'Plan rejected. Your project was not changed.' } });
    },
    revise() {
      const s = snapshot.state;
      if (s.phase !== 'review' || s.origin.kind !== 'prompt') return;
      set({ state: { phase: 'idle' } });
    },
    revert() {
      const s = snapshot.state;
      if (s.phase !== 'done') return;
      const result = revertOperation(session, s.report);
      if (!result.ok) {
        set({ state: { ...s, revertError: result.error } });
        return;
      }
      set({ state: { phase: 'reverted', report: s.report } });
    },
    reset() {
      const phase = snapshot.state.phase;
      if (phase === 'planning' || phase === 'applying') return;
      set({ state: { phase: 'idle' } });
    },
  };
  return controllerApi;
}
const controllers = new Map<string, OperationController>();
/**
 * One controller per Stack, so a plan under review or a report to revert survives closing the panel
 * and opening the preview (which reopens the session). `revertOperation` still refuses when the Stack
 * differs from the report's result.
 */
export function getOperationController(deps: OperationDeps): OperationController {
  let c = controllers.get(deps.session.stackId);
  if (!c) {
    c = createOperationController(deps);
    controllers.set(deps.session.stackId, c);
  }
  c.bind(deps.session);
  return c;
}
export function useOperation(controller: OperationController): OperationSnapshot {
  return useSyncExternalStore(controller.subscribe, controller.getSnapshot);
}
