import { err, ok } from '@ghoststack/shared-contracts';
import type {
  AIOperationProgress,
  AIPlan,
  AbortSignalLike,
  ApplyCommand,
  Checkpoint,
  GhostError,
  Result,
  Stack,
  StackSession,
} from '@ghoststack/shared-contracts';
import { dryRunPlan } from './dry-run';
import type { DryRunError } from './dry-run';
import { serializePlan } from './plan';
import { summarizePlan } from './summary';
import type { PlanSummary } from './summary';
import { clone, deepEqual } from './util';

/** Progress event: the contract's `AIOperationProgress` plus the phase that produced it. */
export interface TransactionProgress extends AIOperationProgress {
  phase: 'checkpoint' | 'step' | 'validate' | 'commit' | 'finish';
}

/** Port for the pre-operation checkpoint. `CheckpointRepository` satisfies it; ai-core never imports storage. */
export interface CheckpointWriter {
  put(checkpoint: Checkpoint): Promise<void>;
}

export interface TransactionOptions {
  /**
   * `serializePlan(plan)` taken when the creator pressed Approve. The transaction refuses to run when
   * it differs from the plan passed in, so a plan edited after review cannot be applied.
   */
  approvedPlan: string;
  checkpoints: CheckpointWriter;
  /** ISO 8601 time used for the checkpoint and for `applyCommand`. */
  now: string;
  /** Returns a fresh id (called twice: operation id and checkpoint id). */
  newId: () => string;
  signal?: AbortSignalLike;
  onProgress?: (progress: TransactionProgress) => void;
  /** Failure-injection points for tests. Default to the `@ghoststack/domain` implementations. */
  inject?: {
    applyCommand?: ApplyCommand;
    validateStack?: (stack: unknown) => Result<Stack, GhostError>;
  };
}

/** What a committed transaction returns. Pass it to `revertOperation`. */
export interface OperationReport {
  operationId: string;
  checkpointId: string;
  stepCount: number;
  summary: PlanSummary;
  /** Deep copy of the Stack before the operation. */
  snapshot: Stack;
  /** The Stack the session holds after the commit. */
  resultStack: Stack;
}

export type TransactionOutcome =
  | { state: 'done'; report: OperationReport }
  /** The signal fired before the commit. The Stack is unchanged. */
  | { state: 'cancelled' };

const fail = (code: GhostError['code'], message: string): Result<never, GhostError> => err({ code, message });

const CANCELLED: Result<TransactionOutcome, GhostError> = ok({ state: 'cancelled' });

const MAX_LABEL = 160;

/**
 * Applies an approved plan as one undoable step: checkpoint, dry run on a copy, stale-base check,
 * then a single `session.restore`. The Stack changes only inside that call. Every failure and every
 * cancellation before it leaves the Stack as it was. Never retries. Never throws.
 */
export async function runTransaction(
  session: StackSession,
  plan: AIPlan,
  options: TransactionOptions,
): Promise<Result<TransactionOutcome, GhostError | DryRunError>> {
  try {
    return await execute(session, plan, options);
  } catch {
    return fail('TRANSACTION_FAILED', 'The change could not be applied. Your project was not changed.');
  }
}

async function execute(
  session: StackSession,
  plan: AIPlan,
  options: TransactionOptions,
): Promise<Result<TransactionOutcome, GhostError | DryRunError>> {
  const report = (
    phase: TransactionProgress['phase'],
    state: TransactionProgress['state'],
    stepIndex: number,
    stepCount: number,
    message: string,
  ): void => options.onProgress?.({ phase, state, stepIndex, stepCount, message });

  if (typeof options.approvedPlan !== 'string' || options.approvedPlan !== serializePlan(plan)) {
    return fail('TRANSACTION_FAILED', 'The plan was not approved, or it changed after it was approved.');
  }
  const stepCount = plan.steps.length;
  const base = session.getStack();
  const snapshot = clone(base);
  if (snapshot.stackId !== session.stackId) {
    return fail('TRANSACTION_FAILED', 'The session holds a different project than expected.');
  }
  if (options.signal?.aborted) {
    report('finish', 'cancelled', 0, stepCount, 'Cancelled before anything changed.');
    return CANCELLED;
  }

  const operationId = options.newId();
  const checkpointId = options.newId();
  report('checkpoint', 'applying', 0, stepCount, 'Saving a checkpoint of your project.');
  try {
    await options.checkpoints.put({
      checkpointId,
      stackId: snapshot.stackId,
      label: `Before AI: ${plan.summary}`.slice(0, MAX_LABEL),
      kind: 'recovery',
      createdAt: options.now,
      stack: clone(snapshot),
    });
  } catch {
    report('finish', 'failed', 0, stepCount, 'Could not save a checkpoint. Your project was not changed.');
    return fail('CHECKPOINT_FAILED', 'A checkpoint could not be saved, so the change was not applied.');
  }

  const dry = dryRunPlan(clone(snapshot), plan, options.now, {
    ...(options.signal ? { signal: options.signal } : {}),
    ...(options.inject?.applyCommand ? { applyCommand: options.inject.applyCommand } : {}),
    ...(options.inject?.validateStack ? { validateStack: options.inject.validateStack } : {}),
    onProgress: (p) =>
      report(
        'step',
        'applying',
        p.stepIndex + 1,
        p.stepCount,
        `Applied step ${p.stepIndex + 1} of ${p.stepCount}.`,
      ),
  });
  if (!dry.ok) {
    report(
      'finish',
      'failed',
      0,
      stepCount,
      'The plan does not apply cleanly. Your project was not changed.',
    );
    return dry;
  }
  if (dry.value.status === 'cancelled') {
    report(
      'finish',
      'cancelled',
      dry.value.steps.length,
      stepCount,
      'Cancelled. Your project was not changed.',
    );
    return CANCELLED;
  }
  const result = dry.value.stack;
  report('validate', 'applying', stepCount, stepCount, 'The changed project is valid.');

  if (options.signal?.aborted) {
    report('finish', 'cancelled', stepCount, stepCount, 'Cancelled. Your project was not changed.');
    return CANCELLED;
  }
  if (!deepEqual(session.getStack(), base)) {
    report('finish', 'failed', stepCount, stepCount, 'The project changed while the plan was prepared.');
    return fail(
      'TRANSACTION_FAILED',
      'The project changed during the operation, so the plan was not applied.',
    );
  }

  report('commit', 'applying', stepCount, stepCount, 'Applying the change.');
  let restored: Result<Stack, GhostError>;
  try {
    restored = session.restore(result);
  } catch {
    report('finish', 'failed', stepCount, stepCount, 'The change could not be applied.');
    return fail('TRANSACTION_FAILED', 'The change could not be applied. Your project was not changed.');
  }
  if (!restored.ok) {
    report('finish', 'failed', stepCount, stepCount, 'The change could not be applied.');
    return fail('TRANSACTION_FAILED', restored.error.message);
  }
  const summary = summarizePlan(snapshot, plan);
  report('finish', 'done', stepCount, stepCount, 'Done.');
  return ok({
    state: 'done',
    report: { operationId, checkpointId, stepCount, summary, snapshot, resultStack: clone(restored.value) },
  });
}

/**
 * Restores the pre-operation Stack as one undo step. Refuses when the Stack was edited after the
 * operation, so later work is never discarded silently. Never throws.
 */
export function revertOperation(
  session: StackSession,
  operation: OperationReport,
): Result<Stack, GhostError> {
  try {
    if (operation.snapshot.stackId !== session.stackId) {
      return fail('TRANSACTION_FAILED', 'This operation belongs to a different project.');
    }
    if (!deepEqual(session.getStack(), operation.resultStack)) {
      return fail(
        'TRANSACTION_FAILED',
        'The project was edited after the AI change, so it cannot be reverted as a whole.',
      );
    }
    const restored = session.restore(clone(operation.snapshot));
    if (!restored.ok) return fail('TRANSACTION_FAILED', restored.error.message);
    return restored;
  } catch {
    return fail('TRANSACTION_FAILED', 'The change could not be reverted. Your project was not changed.');
  }
}
