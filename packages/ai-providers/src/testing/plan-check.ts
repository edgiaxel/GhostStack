import {
  AI_ALLOWED_COMMAND_TYPES,
  AIPlanSchema,
  MAX_PLAN_BYTES,
  MAX_PLAN_STEPS,
  validateElementProperties,
  type AIPlan,
  type ActionNode,
  type Behavior,
  type Expr,
  type ProjectContext,
} from '@ghoststack/shared-contracts';

/**
 * A structural check of a plan against the context it was built for. It replays the steps over the
 * set of Cards, elements and state keys and reports the first reference to something that does not
 * exist yet. It is a test aid; the real dry run lives in `ai-core`.
 */
export function checkPlanAgainstContext(plan: AIPlan, context: ProjectContext): string | undefined {
  if (!AIPlanSchema.safeParse(plan).success) return 'schema';
  if (plan.steps.length > MAX_PLAN_STEPS) return 'too many steps';
  if (JSON.stringify(plan).length > MAX_PLAN_BYTES) return 'too large';
  const cards = new Map<string, Set<string>>();
  for (const card of context.cards) cards.set(card.cardId, new Set());
  const state = new Set(Object.keys(context.stack.stateSchema));
  const stepIds = new Set<string>();
  const pendingNavigation: string[] = [];

  const expr = (e: Expr): string | undefined => {
    switch (e.kind) {
      case 'state':
      case 'listLength':
      case 'listJoin':
        return state.has(e.key) ? undefined : `unknown state ${e.key}`;
      case 'listItem':
        return state.has(e.key) ? expr(e.index) : `unknown state ${e.key}`;
      case 'not':
        return expr(e.arg);
      case 'binary':
        return expr(e.left) ?? expr(e.right);
      default:
        return undefined;
    }
  };
  const action = (a: ActionNode, owner: Set<string>): string | undefined => {
    switch (a.type) {
      case 'navigate':
        pendingNavigation.push(a.cardId);
        return undefined;
      case 'setState':
        return state.has(a.key) ? expr(a.value) : `unknown state ${a.key}`;
      case 'setText':
        return owner.has(a.elementId) ? expr(a.value) : `unknown element ${a.elementId}`;
      case 'show':
      case 'hide':
        return owner.has(a.elementId) ? undefined : `unknown element ${a.elementId}`;
      case 'if':
        return (
          expr(a.condition) ??
          a.then.map((x) => action(x, owner)).find(Boolean) ??
          a.else.map((x) => action(x, owner)).find(Boolean)
        );
      case 'listAdd':
      case 'listSet':
        return state.has(a.key) ? expr(a.value) : `unknown state ${a.key}`;
      case 'listRemove':
        return state.has(a.key) ? expr(a.index) : `unknown state ${a.key}`;
      case 'listClear':
        return state.has(a.key) ? undefined : `unknown state ${a.key}`;
      default:
        return undefined;
    }
  };
  const behaviors = (list: Behavior[], owner: Set<string>): string | undefined => {
    for (const b of list) {
      for (const c of b.conditions) {
        const problem = expr(c);
        if (problem) return problem;
      }
      for (const a of b.actions) {
        const problem = action(a, owner);
        if (problem) return problem;
      }
    }
    return undefined;
  };

  for (const step of plan.steps) {
    if (stepIds.has(step.id)) return `duplicate step id ${step.id}`;
    stepIds.add(step.id);
    const c = step.command;
    if (!(AI_ALLOWED_COMMAND_TYPES as readonly string[]).includes(c.type)) return `type ${c.type}`;
    switch (c.type) {
      case 'UPDATE_STATE_SCHEMA':
        state.clear();
        Object.keys(c.stateSchema).forEach((k) => state.add(k));
        break;
      case 'ADD_CARD':
        if (cards.has(c.cardId)) return `card exists ${c.cardId}`;
        cards.set(c.cardId, new Set());
        break;
      case 'ADD_ELEMENT': {
        const owner = cards.get(c.cardId);
        if (!owner) return `unknown card ${c.cardId}`;
        if ([...cards.values()].some((s) => s.has(c.element.elementId)))
          return `element exists ${c.element.elementId}`;
        const props = validateElementProperties(c.element.type, c.element.properties);
        if (!props.ok) return props.message;
        const key = c.element.properties['stateKey'];
        if (typeof key === 'string' && !state.has(key)) return `input bound to unknown state ${key}`;
        owner.add(c.element.elementId);
        break;
      }
      case 'UPDATE_BEHAVIOR': {
        const owner = cards.get(c.cardId);
        if (!owner) return `unknown card ${c.cardId}`;
        if (c.elementId !== undefined && !owner.has(c.elementId)) return `unknown element ${c.elementId}`;
        const problem = behaviors(c.behaviors, owner);
        if (problem) return problem;
        break;
      }
      default:
        return `unexpected ${c.type}`;
    }
  }
  const missing = pendingNavigation.find((id) => !cards.has(id));
  return missing ? `navigate to unknown card ${missing}` : undefined;
}
