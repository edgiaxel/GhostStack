import type {
  Behavior,
  BehaviorRuntime,
  CreateRuntime,
  RuntimeSnapshot,
  StateValue,
} from '@ghoststack/shared-contracts';

/**
 * SKELETON written by the orchestrator so preview and export can compile against the real
 * contract. It initialises state and element visibility, tracks the current card, and runs no
 * behaviors yet. The `behavior` worktree replaces this file with the interpreter.
 */
export const createRuntime: CreateRuntime = (stack, options) => {
  const startCardId = options?.startCardId ?? stack.entryCardId;
  const state: Record<string, StateValue> = {};
  for (const [key, variable] of Object.entries(stack.stateSchema)) state[key] = variable.initial;

  let current: RuntimeSnapshot = { cardId: startCardId, state, elements: {}, errors: [] };
  const enter = (cardId: string): RuntimeSnapshot => {
    const card = stack.cards[cardId];
    const elements = Object.fromEntries(
      (card?.elements ?? []).map((e) => [e.elementId, { visible: e.properties['visible'] !== false }]),
    );
    return { ...current, cardId, elements };
  };

  const runtime: BehaviorRuntime = {
    start() {
      current = enter(startCardId);
      return current;
    },
    snapshot: () => current,
    dispatch: () => current,
  };
  return runtime;
};

export interface GhostScriptIssue {
  /** 1-based */
  line: number;
  /** 1-based */
  column: number;
  message: string;
}

export type GhostScriptParseResult =
  { ok: true; behaviors: Behavior[] } | { ok: false; issues: GhostScriptIssue[] };

/** SKELETON. The `behavior` worktree implements the parser. It must produce the canonical AST only. */
export function parseGhostScript(source: string): GhostScriptParseResult {
  void source;
  return {
    ok: false,
    issues: [{ line: 1, column: 1, message: 'GhostScript parser is not implemented yet' }],
  };
}

/** SKELETON. The `behavior` worktree implements the printer. `parse(print(x))` must equal `x`. */
export function printGhostScript(behaviors: readonly Behavior[]): string {
  void behaviors;
  return '';
}
