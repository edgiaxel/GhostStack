import type { ActionNode, Behavior, Card, Expr, Stack } from '@ghoststack/shared-contracts';

/** Visits every action, descending into `if` branches. */
export function walkActions(actions: readonly ActionNode[], visit: (action: ActionNode) => void): void {
  for (const action of actions) {
    visit(action);
    if (action.type === 'if') {
      walkActions(action.then, visit);
      walkActions(action.else, visit);
    }
  }
}

export function walkExpr(expr: Expr, visit: (expr: Expr) => void): void {
  visit(expr);
  if (expr.kind === 'not') walkExpr(expr.arg, visit);
  if (expr.kind === 'binary') {
    walkExpr(expr.left, visit);
    walkExpr(expr.right, visit);
  }
}

/** Every Expr reachable from a behavior: conditions, action values and `if` conditions. */
export function walkBehaviorExprs(behavior: Behavior, visit: (expr: Expr) => void): void {
  for (const c of behavior.conditions) walkExpr(c, visit);
  walkActions(behavior.actions, (a) => {
    if (a.type === 'setState' || a.type === 'setText') walkExpr(a.value, visit);
    if (a.type === 'if') walkExpr(a.condition, visit);
  });
}

/** Returns a copy of `actions` without the actions `drop` matches, including inside `if` branches. */
export function filterActions(
  actions: readonly ActionNode[],
  drop: (action: ActionNode) => boolean,
): ActionNode[] {
  const out: ActionNode[] = [];
  for (const action of actions) {
    if (drop(action)) continue;
    out.push(
      action.type === 'if'
        ? { ...action, then: filterActions(action.then, drop), else: filterActions(action.else, drop) }
        : action,
    );
  }
  return out;
}

export interface BehaviorOwner {
  card: Card;
  /** Undefined when the behavior belongs to the Card itself. */
  elementId?: string;
  behavior: Behavior;
}

export function listBehaviors(stack: Stack): BehaviorOwner[] {
  const out: BehaviorOwner[] = [];
  for (const card of Object.values(stack.cards)) {
    for (const behavior of card.behaviors) out.push({ card, behavior });
    for (const el of card.elements) {
      for (const behavior of el.behaviors) out.push({ card, elementId: el.elementId, behavior });
    }
  }
  return out;
}

export interface CardReference {
  /** Card that owns the behavior. */
  cardId: string;
  /** Element that owns the behavior, if any. */
  elementId?: string;
  behaviorId: string;
}

/** `navigate` actions that target `cardId`. Show these before deleting a Card. */
export function findCardReferences(stack: Stack, cardId: string): CardReference[] {
  const refs: CardReference[] = [];
  for (const { card, elementId, behavior } of listBehaviors(stack)) {
    let hit = false;
    walkActions(behavior.actions, (a) => {
      if (a.type === 'navigate' && a.cardId === cardId) hit = true;
    });
    if (hit) {
      refs.push({
        cardId: card.cardId,
        behaviorId: behavior.behaviorId,
        ...(elementId === undefined ? {} : { elementId }),
      });
    }
  }
  return refs;
}
