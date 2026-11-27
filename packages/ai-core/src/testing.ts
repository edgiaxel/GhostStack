/**
 * Test support only: an in-memory `StackSession` (same contract as the real one), plan builders and
 * fixture plans for the two MVP demonstrations. Product code never imports this file.
 */
import { applyCommand, createStack, validateStack } from '@ghoststack/domain';
import { err, ok } from '@ghoststack/shared-contracts';
import type {
  AIPlan,
  AIPlanCommand,
  Behavior,
  Element,
  GhostError,
  ProjectCommand,
  Result,
  SessionStatus,
  Stack,
  StackSession,
} from '@ghoststack/shared-contracts';
import { clone } from './util';

export const NOW = '2026-12-02T10:00:00.000Z';

export function baseStack(): Stack {
  return createStack({
    stackId: 'stack-1',
    cardId: 'c1',
    title: 'Test stack',
    now: '2026-12-01T09:00:00.000Z',
  });
}

export interface MemorySession extends StackSession {
  restoreCalls: number;
  dispatchCalls: number;
  /** Replaces the Stack behind the session's back, as a concurrent edit would. */
  forceStack(stack: Stack): void;
}

export interface MemorySessionOptions {
  restoreFails?: 'error' | 'throw';
}

export function createMemorySession(initial: Stack, options: MemorySessionOptions = {}): MemorySession {
  let current = clone(initial);
  const past: Stack[] = [];
  const future: Stack[] = [];
  const listeners = new Set<() => void>();
  const notify = (): void => listeners.forEach((l) => l());
  const session: MemorySession = {
    stackId: initial.stackId,
    restoreCalls: 0,
    dispatchCalls: 0,
    getStack: () => current,
    getStatus: (): SessionStatus => ({
      saveState: 'saved',
      canUndo: past.length > 0,
      canRedo: future.length > 0,
    }),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispatch(command: ProjectCommand): Result<Stack, GhostError> {
      session.dispatchCalls += 1;
      const next = applyCommand(current, command, NOW);
      if (!next.ok) return next;
      past.push(current);
      future.length = 0;
      current = next.value;
      notify();
      return ok(current);
    },
    restore(snapshot) {
      session.restoreCalls += 1;
      if (options.restoreFails === 'throw') throw new Error('restore exploded');
      if (options.restoreFails === 'error') {
        return err({ code: 'STORAGE_FAILED', message: 'Could not save the restored project' });
      }
      if (snapshot.stackId !== session.stackId) {
        return err({ code: 'TRANSACTION_FAILED', message: 'Snapshot belongs to a different Stack' });
      }
      const valid = validateStack(snapshot);
      if (!valid.ok) return valid;
      past.push(current);
      future.length = 0;
      current = valid.value;
      notify();
      return ok(current);
    },
    undo() {
      const previous = past.pop();
      if (!previous) return false;
      future.push(current);
      current = previous;
      notify();
      return true;
    },
    redo() {
      const next = future.pop();
      if (!next) return false;
      past.push(current);
      current = next;
      notify();
      return true;
    },
    flush: () => Promise.resolve(),
    dispose: () => listeners.clear(),
    forceStack(stack) {
      current = clone(stack);
    },
  };
  return session;
}

export function step(
  id: string,
  command: AIPlanCommand,
  extra: { dependsOn?: string[] } = {},
): AIPlan['steps'][number] {
  return { id, rationale: `Step ${id}`, command, ...extra };
}

export function plan(steps: AIPlan['steps'], summary = 'Test plan'): AIPlan {
  return { schemaVersion: 1, summary, affectedCardIds: [], steps };
}

export function element(
  elementId: string,
  type: Element['type'],
  properties: Record<string, unknown>,
  behaviors: Behavior[] = [],
): Element {
  return {
    elementId,
    type,
    name: elementId,
    properties,
    layout: { x: 40, y: 40, width: 240, height: 48, zIndex: 0, anchor: 'top-left', scaleMode: 'scale' },
    behaviors,
  };
}

/** Quiz: a question Card with answer buttons that branch to a result Card. Built against `baseStack()`. */
export function quizPlan(): AIPlan {
  const correct: Behavior = {
    behaviorId: 'b-correct',
    trigger: 'element.click',
    conditions: [],
    enabled: true,
    actions: [
      {
        type: 'setState',
        key: 'score',
        value: {
          kind: 'binary',
          op: '+',
          left: { kind: 'state', key: 'score' },
          right: { kind: 'literal', value: 1 },
        },
      },
      { type: 'navigate', cardId: 'result' },
    ],
  };
  const wrong: Behavior = {
    ...correct,
    behaviorId: 'b-wrong',
    actions: [{ type: 'navigate', cardId: 'result' }],
  };
  return plan(
    [
      step('schema', { type: 'UPDATE_STATE_SCHEMA', stateSchema: { score: { type: 'number', initial: 0 } } }),
      step('q', { type: 'ADD_CARD', cardId: 'question', title: 'Capital of France' }),
      step('q-text', {
        type: 'ADD_ELEMENT',
        cardId: 'question',
        element: element('q-prompt', 'text', { text: 'What is the capital of France?', fontSize: 24 }),
      }),
      step('r', { type: 'ADD_CARD', cardId: 'result', title: 'Result' }),
      step('r-text', {
        type: 'ADD_ELEMENT',
        cardId: 'result',
        element: element('r-text', 'text', { text: 'Thanks for playing', fontSize: 24 }),
      }),
      step('a1', {
        type: 'ADD_ELEMENT',
        cardId: 'question',
        element: element('a-paris', 'button', { text: 'Paris', fontSize: 16 }, [correct]),
      }),
      step('a2', {
        type: 'ADD_ELEMENT',
        cardId: 'question',
        element: element('a-rome', 'button', { text: 'Rome', fontSize: 16 }, [wrong]),
      }),
    ],
    'Add a quiz question that branches to a result card',
  );
}

/** Recipe list: an input, an Add button that appends to a list variable, and a text that shows the list. */
export function recipePlan(): AIPlan {
  const add: Behavior = {
    behaviorId: 'b-add',
    trigger: 'element.click',
    conditions: [],
    enabled: true,
    actions: [
      { type: 'listAdd', key: 'items', value: { kind: 'state', key: 'draft' } },
      { type: 'setState', key: 'draft', value: { kind: 'literal', value: '' } },
      { type: 'setText', elementId: 'list-view', value: { kind: 'listJoin', key: 'items', separator: '\n' } },
    ],
  };
  return plan(
    [
      step('schema', {
        type: 'UPDATE_STATE_SCHEMA',
        stateSchema: { items: { type: 'list', initial: [] }, draft: { type: 'string', initial: '' } },
      }),
      step('card', { type: 'ADD_CARD', cardId: 'recipes', title: 'Recipes' }),
      step('input', {
        type: 'ADD_ELEMENT',
        cardId: 'recipes',
        element: element('draft-input', 'input', {
          placeholder: 'Ingredient',
          fontSize: 16,
          stateKey: 'draft',
        }),
      }),
      step('view', {
        type: 'ADD_ELEMENT',
        cardId: 'recipes',
        element: element('list-view', 'text', { text: '', fontSize: 18 }),
      }),
      step('button', {
        type: 'ADD_ELEMENT',
        cardId: 'recipes',
        element: element('add-btn', 'button', { text: 'Add', fontSize: 16 }, [add]),
      }),
    ],
    'Add a recipe card with an ingredient list',
  );
}
