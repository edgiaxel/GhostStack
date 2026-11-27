import { applyCommand as domainApplyCommand, validateStack as domainValidateStack } from '@ghoststack/domain';
import { err, isAllowedCommandType, ok } from '@ghoststack/shared-contracts';
import type {
  AIPlan,
  AIPlanStep,
  AbortSignalLike,
  ApplyCommand,
  GhostError,
  Result,
  Stack,
} from '@ghoststack/shared-contracts';
import { orderSteps } from './plan';
import { clone } from './util';

export interface DryRunStepResult {
  stepId: string;
  /** Position in the executed order, starting at 0. */
  index: number;
  commandType: string;
}

export type DryRunResult =
  | { status: 'ok'; stack: Stack; steps: DryRunStepResult[] }
  /** The signal fired between two steps. No Stack is returned. */
  | { status: 'cancelled'; steps: DryRunStepResult[] };

/** A `GhostError` that also names the failing step when one is known. */
export interface DryRunError extends GhostError {
  stepId?: string;
  stepIndex?: number;
}

export interface DryRunOptions {
  signal?: AbortSignalLike;
  /** Called once after each step. */
  onProgress?: (progress: { stepId: string; stepIndex: number; stepCount: number }) => void;
  /** Injection points for tests. Default to the `@ghoststack/domain` implementations. */
  applyCommand?: ApplyCommand;
  validateStack?: (stack: unknown) => Result<Stack, GhostError>;
}

const failure = (error: DryRunError): Result<never, DryRunError> => err(error);

/**
 * Applies a plan to an isolated deep copy of `stack`. The input is never mutated.
 * The result is deterministic for a given Stack, plan and `now`.
 */
export function dryRunPlan(
  stack: Stack,
  plan: AIPlan,
  now: string,
  options: DryRunOptions = {},
): Result<DryRunResult, DryRunError> {
  try {
    return run(stack, plan, now, options);
  } catch {
    return failure({
      code: 'INVALID_PATCH_COMMAND',
      message: 'The plan could not be applied to a copy of the Stack',
    });
  }
}

function run(
  stack: Stack,
  plan: AIPlan,
  now: string,
  options: DryRunOptions,
): Result<DryRunResult, DryRunError> {
  const apply = options.applyCommand ?? domainApplyCommand;
  const validate = options.validateStack ?? domainValidateStack;
  const ordered = orderSteps(plan);
  if (!ordered.ok) return failure(ordered.error);
  const steps: readonly AIPlanStep[] = ordered.value;
  for (const step of steps) {
    const type: unknown = step.command?.type;
    if (!isAllowedCommandType(type)) {
      return failure({
        code: 'INVALID_PATCH_COMMAND',
        message: `Step ${step.id}: command ${String(type).slice(0, 60)} is not allowed in an AI plan`,
        stepId: step.id,
      });
    }
  }

  let working = clone(stack);
  const done: DryRunStepResult[] = [];
  for (let i = 0; i < steps.length; i++) {
    if (options.signal?.aborted) return ok({ status: 'cancelled', steps: done });
    const step = steps[i] as AIPlanStep;
    const next = apply(working, clone(step.command), now);
    if (!next.ok) {
      return failure({
        code: 'INVALID_PATCH_COMMAND',
        message: `Step ${step.id}: ${next.error.message}`,
        stepId: step.id,
        stepIndex: i,
      });
    }
    working = next.value;
    done.push({ stepId: step.id, index: i, commandType: step.command.type });
    options.onProgress?.({ stepId: step.id, stepIndex: i, stepCount: steps.length });
  }
  if (options.signal?.aborted) return ok({ status: 'cancelled', steps: done });
  const valid = validate(working);
  if (!valid.ok) {
    return failure({ code: 'PROJECT_VALIDATION_FAILED', message: valid.error.message });
  }
  return ok({ status: 'ok', stack: valid.value, steps: done });
}
