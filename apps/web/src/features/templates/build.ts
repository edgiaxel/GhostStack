import { applyCommand, createStack } from '@ghoststack/domain';
import { DEFAULT_ELEMENT_PLACEMENT, ELEMENT_DEFAULTS, err, ok } from '@ghoststack/shared-contracts';
import type {
  ActionNode,
  Behavior,
  Element,
  ElementType,
  Expr,
  GhostError,
  ProjectCommand,
  Result,
  Stack,
  StateVariable,
  Trigger,
} from '@ghoststack/shared-contracts';

/** What a template needs from the UI edge. The domain stays free of randomness and clocks. */
export interface TemplateInput {
  stackId: string;
  title: string;
  /** ISO 8601 */
  now: string;
  /** Returns a fresh id on every call (`crypto.randomUUID` in the app). */
  newId: () => string;
}

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  /** Builds a Stack through `createStack` and `applyCommand` only. */
  build: (input: TemplateInput) => Result<Stack, GhostError>;
}

class BuildFailure extends Error {
  constructor(readonly ghost: GhostError) {
    super(ghost.message);
  }
}

export const lit = (value: string | number | boolean): Expr => ({ kind: 'literal', value });
export const st = (key: string): Expr => ({ kind: 'state', key });
export const bin = (op: '==' | '!=' | '-' | '+', left: Expr, right: Expr): Expr => ({
  kind: 'binary',
  op,
  left,
  right,
});

export interface Place {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Applies commands one at a time to a Stack that starts as a blank one-card Stack. */
export class StackBuilder {
  private stack: Stack;
  readonly firstCardId: string;

  constructor(private readonly input: TemplateInput) {
    this.firstCardId = input.newId();
    this.stack = createStack({
      stackId: input.stackId,
      cardId: this.firstCardId,
      title: input.title,
      now: input.now,
    });
  }

  run(command: ProjectCommand): void {
    const r = applyCommand(this.stack, command, this.input.now);
    if (!r.ok) throw new BuildFailure(r.error);
    this.stack = r.value;
  }

  /** Renames the first card or adds a new one. Returns the card id. */
  card(title: string, first = false): string {
    if (first) {
      this.run({ type: 'RENAME_CARD', cardId: this.firstCardId, title });
      return this.firstCardId;
    }
    const cardId = this.input.newId();
    this.run({ type: 'ADD_CARD', cardId, title });
    return cardId;
  }

  element(
    cardId: string,
    type: ElementType,
    name: string,
    place: Place,
    properties: Record<string, unknown>,
  ): string {
    const elementId = this.input.newId();
    const d = ELEMENT_DEFAULTS[type];
    const element: Element = {
      elementId,
      type,
      name,
      properties: { ...d.properties, ...properties },
      layout: { ...place, zIndex: 0, ...DEFAULT_ELEMENT_PLACEMENT },
      behaviors: [],
    };
    this.run({ type: 'ADD_ELEMENT', cardId, element });
    return elementId;
  }

  behavior(
    cardId: string,
    elementId: string | undefined,
    trigger: Trigger,
    actions: ActionNode[],
    conditions: Expr[] = [],
  ): void {
    const owner = this.stack.cards[cardId];
    if (!owner) throw new BuildFailure({ code: 'PROJECT_VALIDATION_FAILED', message: 'Unknown card.' });
    const list = elementId
      ? (owner.elements.find((e) => e.elementId === elementId)?.behaviors ?? [])
      : owner.behaviors;
    const behavior: Behavior = {
      behaviorId: this.input.newId(),
      trigger,
      conditions,
      actions,
      enabled: true,
    };
    this.run({
      type: 'UPDATE_BEHAVIOR',
      cardId,
      ...(elementId ? { elementId } : {}),
      behaviors: [...list, behavior],
    });
  }

  state(stateSchema: Record<string, StateVariable>): void {
    this.run({ type: 'UPDATE_STATE_SCHEMA', stateSchema });
  }

  finish(): Stack {
    return this.stack;
  }
}

/** Runs `script` against a fresh builder and converts a failed command into an error result. */
export function buildWith(
  input: TemplateInput,
  script: (b: StackBuilder) => void,
): Result<Stack, GhostError> {
  try {
    const b = new StackBuilder(input);
    script(b);
    return ok(b.finish());
  } catch (e) {
    if (e instanceof BuildFailure) return err(e.ghost);
    return err({
      code: 'PROJECT_VALIDATION_FAILED',
      message: e instanceof Error ? e.message : 'Template failed.',
    });
  }
}
