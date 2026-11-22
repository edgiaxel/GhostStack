import type { AIPlan, PatchCommand } from './plan';

export interface PlanReview {
  readonly planId: string;
  readonly requestSummary: string;
  readonly commandCount: number;
  readonly countsByCommand: Readonly<Partial<Record<PatchCommand['command'], number>>>;
  /** Existing card identifiers the plan touches. Cards the plan creates are counted separately. */
  readonly affectedCardIds: readonly string[];
  readonly newCardCount: number;
  /** Commands that cannot execute yet, so the creator sees them before approving. */
  readonly unsupportedCommands: readonly number[];
}

/** Derived from the plan itself. Provider-supplied summaries are never trusted for the review. */
export function reviewPlan(plan: AIPlan): PlanReview {
  const counts: Partial<Record<PatchCommand['command'], number>> = {};
  const declaredRefs = new Set<string>();
  const affected = new Set<string>();
  const unsupported: number[] = [];
  let newCards = 0;
  plan.commands.forEach((command, index) => {
    counts[command.command] = (counts[command.command] ?? 0) + 1;
    if (command.command === 'ADD_CARD') {
      newCards += 1;
      if (command.ref !== undefined) declaredRefs.add(command.ref);
    }
    if (command.command === 'UPDATE_BEHAVIOR') unsupported.push(index);
    if ('cardId' in command && !declaredRefs.has(command.cardId)) affected.add(command.cardId);
  });
  return {
    planId: plan.planId,
    requestSummary: plan.requestSummary,
    commandCount: plan.commands.length,
    countsByCommand: counts,
    affectedCardIds: [...affected].sort(),
    newCardCount: newCards,
    unsupportedCommands: unsupported,
  };
}
