import type {
  ActionNode,
  Behavior,
  BehaviorRuntime,
  Card,
  CreateRuntime,
  ElementRuntimeState,
  Expr,
  RuntimeEvent,
  RuntimeIssue,
  RuntimeSnapshot,
  Stack,
  StateValue,
  Trigger,
} from '@ghoststack/shared-contracts';

export const LIMITS = { actionsPerDispatch: 1000, navigationsPerDispatch: 20, errors: 50 } as const;

class EvalError extends Error {}

const truthy = (v: StateValue): boolean => v !== false && v !== 0 && v !== '';

/** Pure expression evaluator. Throws `EvalError` on type errors and division by zero. */
export function evaluate(expr: Expr, state: Readonly<Record<string, StateValue>>): StateValue {
  switch (expr.kind) {
    case 'literal':
      return expr.value;
    case 'state': {
      if (!Object.prototype.hasOwnProperty.call(state, expr.key)) {
        throw new EvalError(`Unknown state variable "${expr.key}"`);
      }
      return state[expr.key] as StateValue;
    }
    case 'not':
      return !truthy(evaluate(expr.arg, state));
    case 'binary': {
      if (expr.op === 'and') return truthy(evaluate(expr.left, state)) && truthy(evaluate(expr.right, state));
      if (expr.op === 'or') return truthy(evaluate(expr.left, state)) || truthy(evaluate(expr.right, state));
      const l = evaluate(expr.left, state);
      const r = evaluate(expr.right, state);
      switch (expr.op) {
        case '==':
          return l === r;
        case '!=':
          return l !== r;
        case '<':
        case '<=':
        case '>':
        case '>=': {
          if (typeof l === 'boolean' || typeof l !== typeof r) {
            throw new EvalError(`Cannot compare ${typeof l} with ${typeof r}`);
          }
          const a = l as number | string;
          const b = r as number | string;
          return expr.op === '<' ? a < b : expr.op === '<=' ? a <= b : expr.op === '>' ? a > b : a >= b;
        }
        case '+':
          if (typeof l === 'number' && typeof r === 'number') return finite(l + r);
          if (typeof l === 'boolean' || typeof r === 'boolean') throw new EvalError('Cannot add a boolean');
          return `${l}${r}`;
        default: {
          if (typeof l !== 'number' || typeof r !== 'number') {
            throw new EvalError(`Operator ${expr.op} needs two numbers`);
          }
          if ((expr.op === '/' || expr.op === '%') && r === 0) throw new EvalError('Division by zero');
          return finite(expr.op === '-' ? l - r : expr.op === '*' ? l * r : expr.op === '/' ? l / r : l % r);
        }
      }
    }
  }
}

function finite(n: number): number {
  if (!Number.isFinite(n)) throw new EvalError('Number out of range');
  return n;
}

interface Ctx {
  steps: number;
  navs: number;
  /** Set when a navigate ran or a limit was hit: remaining actions of this dispatch stop. */
  stop: boolean;
}

export const createRuntime: CreateRuntime = (stack: Stack, options): BehaviorRuntime => {
  const startCardId = options?.startCardId ?? stack.entryCardId;
  let state: Record<string, StateValue> = {};
  let cardId = startCardId;
  let elements: Record<string, ElementRuntimeState> = {};
  let errors: RuntimeIssue[] = [];

  const issue = (message: string, behaviorId?: string): void => {
    if (errors.length >= LIMITS.errors) return;
    errors.push(behaviorId === undefined ? { message } : { behaviorId, message });
  };
  const card = (): Card | undefined => stack.cards[cardId];
  const elementType = (id: string): string | undefined =>
    card()?.elements.find((e) => e.elementId === id)?.type;

  function runActions(actions: readonly ActionNode[], ctx: Ctx, behaviorId: string): void {
    for (const a of actions) {
      if (ctx.stop) return;
      if (++ctx.steps > LIMITS.actionsPerDispatch) {
        issue('Too many actions in one event. Stopped to avoid an endless loop.', behaviorId);
        ctx.stop = true;
        return;
      }
      try {
        switch (a.type) {
          case 'navigate':
            if (!(a.cardId in stack.cards)) throw new EvalError(`Unknown card "${a.cardId}"`);
            if (++ctx.navs > LIMITS.navigationsPerDispatch) {
              issue('Too many card changes in one event. Stopped to avoid an endless loop.', behaviorId);
              ctx.stop = true;
              return;
            }
            enter(a.cardId, ctx);
            ctx.stop = true;
            return;
          case 'setState': {
            const variable = stack.stateSchema[a.key];
            if (!variable) throw new EvalError(`Unknown state variable "${a.key}"`);
            const v = evaluate(a.value, state);
            if (typeof v !== variable.type) {
              throw new EvalError(`"${a.key}" is a ${variable.type}, got a ${typeof v}`);
            }
            state[a.key] = v;
            break;
          }
          case 'setText': {
            const t = elementType(a.elementId);
            if (t !== 'text' && t !== 'button')
              throw new EvalError(`Element "${a.elementId}" cannot show text`);
            const el = elements[a.elementId];
            if (el) el.text = String(evaluate(a.value, state));
            break;
          }
          case 'show':
          case 'hide': {
            const el = elements[a.elementId];
            if (!el) throw new EvalError(`Unknown element "${a.elementId}"`);
            el.visible = a.type === 'show';
            break;
          }
          case 'if':
            runActions(truthy(evaluate(a.condition, state)) ? a.then : a.else, ctx, behaviorId);
            break;
        }
      } catch (e) {
        if (!(e instanceof EvalError)) throw e;
        issue(e.message, behaviorId);
      }
    }
  }

  function runBehaviors(list: readonly Behavior[], trigger: Trigger, ctx: Ctx): void {
    for (const b of list) {
      if (ctx.stop) return;
      if (!b.enabled || b.trigger !== trigger) continue;
      try {
        if (!b.conditions.every((c) => truthy(evaluate(c, state)))) continue;
      } catch (e) {
        if (!(e instanceof EvalError)) throw e;
        issue(e.message, b.behaviorId);
        continue;
      }
      runActions(b.actions, ctx, b.behaviorId);
    }
  }

  function enter(id: string, ctx: Ctx): void {
    cardId = id;
    const c = stack.cards[id];
    elements = Object.fromEntries(
      (c?.elements ?? []).map((e) => [e.elementId, { visible: e.properties['visible'] !== false }]),
    );
    const inner: Ctx = { steps: ctx.steps, navs: ctx.navs, stop: false };
    if (c) runBehaviors(c.behaviors, 'card.enter', inner);
    ctx.steps = inner.steps;
    ctx.navs = inner.navs;
  }

  const snapshot = (): RuntimeSnapshot => ({
    cardId,
    state: { ...state },
    elements: Object.fromEntries(Object.entries(elements).map(([k, v]) => [k, { ...v }])),
    errors: errors.map((e) => ({ ...e })),
  });

  return {
    start() {
      state = {};
      for (const [key, v] of Object.entries(stack.stateSchema)) state[key] = v.initial;
      errors = [];
      if (!(startCardId in stack.cards)) {
        issue(`Unknown start card "${startCardId}"`);
        return snapshot();
      }
      enter(startCardId, { steps: 0, navs: 0, stop: false });
      return snapshot();
    },
    snapshot,
    dispatch(event: RuntimeEvent) {
      const c = card();
      if (!c) return snapshot();
      if (event.type === 'card.enter') {
        enter(cardId, { steps: 0, navs: 0, stop: false });
        return snapshot();
      }
      const el = c.elements.find((e) => e.elementId === event.elementId);
      if (!el) {
        issue(`Unknown element "${event.elementId}"`);
        return snapshot();
      }
      const ctx: Ctx = { steps: 0, navs: 0, stop: false };
      if (event.type === 'element.change') {
        const key = el.type === 'input' ? (el.properties['stateKey'] as string | undefined) : undefined;
        const variable = key === undefined ? undefined : stack.stateSchema[key];
        if (key !== undefined && variable) {
          const v: StateValue | undefined =
            variable.type === 'string'
              ? event.value
              : variable.type === 'number'
                ? event.value.trim() !== '' && Number.isFinite(Number(event.value))
                  ? Number(event.value)
                  : undefined
                : event.value === 'true' || event.value === 'false'
                  ? event.value === 'true'
                  : undefined;
          if (v === undefined) issue(`"${event.value}" is not a valid ${variable.type} for "${key}"`);
          else state[key] = v;
        }
      }
      runBehaviors(el.behaviors, event.type, ctx);
      return snapshot();
    },
  };
};
