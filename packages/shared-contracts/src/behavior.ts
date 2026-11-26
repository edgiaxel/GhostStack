import { z } from 'zod';
import type { Stack } from './project';

/**
 * Canonical behavior AST (ARCHITECTURE 7.2). The visual action-stack editor and GhostScript
 * both read and write exactly these shapes. Nothing here is executable code: the runtime in
 * `@ghoststack/behavior` interprets the tree against a fixed action registry.
 */

export const StateValueSchema = z.union([z.string(), z.number(), z.boolean()]);
export type StateValue = z.infer<typeof StateValueSchema>;

/** A list holds scalar items only. Lists never nest. */
export type ListValue = StateValue[];
export const ListValueSchema = z.array(StateValueSchema).max(1000);
/** What a state variable holds at runtime. */
export type RuntimeValue = StateValue | ListValue;

export const STATE_VARIABLE_TYPES = ['string', 'number', 'boolean', 'list'] as const;

/** One declared application-state variable. `initial` must match `type` (an array for `list`). */
export const StateVariableSchema = z
  .object({
    type: z.enum(STATE_VARIABLE_TYPES),
    initial: z.union([StateValueSchema, ListValueSchema]),
  })
  .refine((v) => (v.type === 'list' ? Array.isArray(v.initial) : typeof v.initial === v.type), {
    message: 'initial must match the declared type',
  });
export type StateVariable = z.infer<typeof StateVariableSchema>;

export const BINARY_OPS = ['+', '-', '*', '/', '%', '==', '!=', '<', '<=', '>', '>=', 'and', 'or'] as const;
export type BinaryOp = (typeof BINARY_OPS)[number];

/** Pure, side-effect-free expression. No calls, no property access, no identifiers beyond state keys. */
export type Expr =
  | { kind: 'literal'; value: StateValue }
  | { kind: 'state'; key: string }
  | { kind: 'not'; arg: Expr }
  | { kind: 'binary'; op: BinaryOp; left: Expr; right: Expr }
  /** Number of items in the list variable `key`. */
  | { kind: 'listLength'; key: string }
  /** Item at a zero-based index. A runtime issue when out of range. */
  | { kind: 'listItem'; key: string; index: Expr }
  /** All items as one string separated by `separator` (use a newline for one item per line). */
  | { kind: 'listJoin'; key: string; separator: string };

export const ExprSchema: z.ZodType<Expr> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('listLength'), key: z.string().min(1) }),
    z.object({ kind: z.literal('listItem'), key: z.string().min(1), index: ExprSchema }),
    z.object({ kind: z.literal('listJoin'), key: z.string().min(1), separator: z.string().max(20) }),
    z.object({ kind: z.literal('literal'), value: StateValueSchema }),
    z.object({ kind: z.literal('state'), key: z.string().min(1) }),
    z.object({ kind: z.literal('not'), arg: ExprSchema }),
    z.object({ kind: z.literal('binary'), op: z.enum(BINARY_OPS), left: ExprSchema, right: ExprSchema }),
  ]),
);

/** The registered action set. Adding an action means editing this union, the runtime and the printer. */
export type ActionNode =
  | { type: 'navigate'; cardId: string }
  | { type: 'setState'; key: string; value: Expr }
  | { type: 'setText'; elementId: string; value: Expr }
  | { type: 'show'; elementId: string }
  | { type: 'hide'; elementId: string }
  | { type: 'if'; condition: Expr; then: ActionNode[]; else: ActionNode[] }
  /** Go to the next or previous Card in `cardOrder`. Does nothing at the end or the start. */
  | { type: 'nextCard' }
  | { type: 'prevCard' }
  | { type: 'listAdd'; key: string; value: Expr }
  /** Removes the item at a zero-based index. */
  | { type: 'listRemove'; key: string; index: Expr }
  | { type: 'listSet'; key: string; index: Expr; value: Expr }
  | { type: 'listClear'; key: string };

export const ACTION_TYPES = [
  'navigate',
  'setState',
  'setText',
  'show',
  'hide',
  'if',
  'nextCard',
  'prevCard',
  'listAdd',
  'listRemove',
  'listSet',
  'listClear',
] as const;

export const ActionNodeSchema: z.ZodType<ActionNode> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({ type: z.literal('nextCard') }),
    z.object({ type: z.literal('prevCard') }),
    z.object({ type: z.literal('listAdd'), key: z.string().min(1), value: ExprSchema }),
    z.object({ type: z.literal('listRemove'), key: z.string().min(1), index: ExprSchema }),
    z.object({ type: z.literal('listSet'), key: z.string().min(1), index: ExprSchema, value: ExprSchema }),
    z.object({ type: z.literal('listClear'), key: z.string().min(1) }),
    z.object({ type: z.literal('navigate'), cardId: z.string().min(1) }),
    z.object({ type: z.literal('setState'), key: z.string().min(1), value: ExprSchema }),
    z.object({ type: z.literal('setText'), elementId: z.string().min(1), value: ExprSchema }),
    z.object({ type: z.literal('show'), elementId: z.string().min(1) }),
    z.object({ type: z.literal('hide'), elementId: z.string().min(1) }),
    z.object({
      type: z.literal('if'),
      condition: ExprSchema,
      then: z.array(ActionNodeSchema),
      else: z.array(ActionNodeSchema),
    }),
  ]),
);

/**
 * Triggers. `card.enter` belongs on a Card; `element.click` on any Element; `element.change`
 * only on an `input` Element.
 */
export const TRIGGERS = ['card.enter', 'element.click', 'element.change'] as const;
export const TriggerSchema = z.enum(TRIGGERS);
export type Trigger = z.infer<typeof TriggerSchema>;

export const BehaviorSchema = z.object({
  /** Unique within its owner (Card or Element). */
  behaviorId: z.string().min(1),
  trigger: TriggerSchema,
  /** All must be truthy for the actions to run. */
  conditions: z.array(ExprSchema),
  actions: z.array(ActionNodeSchema),
  enabled: z.boolean(),
});
export type Behavior = z.infer<typeof BehaviorSchema>;

/* Runtime contract. Implemented by `@ghoststack/behavior`, consumed by preview and export. */

export type RuntimeEvent =
  | { type: 'card.enter' }
  | { type: 'element.click'; elementId: string }
  | { type: 'element.change'; elementId: string; value: string };

export interface ElementRuntimeState {
  visible: boolean;
  /** Overrides `properties.text` when set by a `setText` action. */
  text?: string;
}

export interface RuntimeIssue {
  behaviorId?: string;
  message: string;
}

export interface RuntimeSnapshot {
  /** Card currently shown. Changes when a `navigate` action runs. */
  cardId: string;
  state: Record<string, RuntimeValue>;
  /** Keyed by elementId of the current Card. */
  elements: Record<string, ElementRuntimeState>;
  /** Runtime errors since `start()`. Errors never mutate the Stack. */
  errors: RuntimeIssue[];
}

export interface BehaviorRuntime {
  /** Initialises state from `stateSchema` and fires `card.enter` for the start Card. */
  start(): RuntimeSnapshot;
  snapshot(): RuntimeSnapshot;
  dispatch(event: RuntimeEvent): RuntimeSnapshot;
}

export interface CreateRuntimeOptions {
  /** Defaults to `stack.entryCardId`. */
  startCardId?: string;
}

export type CreateRuntime = (stack: Stack, options?: CreateRuntimeOptions) => BehaviorRuntime;
