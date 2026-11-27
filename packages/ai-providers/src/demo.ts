import {
  AIPlanSchema,
  MAX_PLAN_BYTES,
  StateVariableSchema,
  err,
  ok,
  type AIPlan,
  type AIPlanCommand,
  type AIPlanStep,
  type AIProviderAdapter,
  type Behavior,
  type Element,
  type ElementType,
  type Expr,
  type PlanRequest,
  type ProjectContext,
  type Result,
  type GhostError,
  type StateVariable,
} from '@ghoststack/shared-contracts';
import { withSafeSerialization } from './adapter-util';
import { validatePrompt } from './chat';
import { MESSAGES } from './errors';
import { byteLength } from './transport';

/**
 * Deterministic, rule-based plan builder. It makes no network call and reads no clock or random
 * source. The same context, prompt and seed always give the same plan. Request text only selects a
 * template and fills a topic label; it never adds, removes or changes a command.
 */

export interface DemoOptions {
  /** Prefix for generated ids. Letters, digits, dash and underscore only. Default none. */
  idSeed?: string;
}

const SUPPORTED_REQUESTS = 'a quiz question with three answers, or a recipe or inventory list';

interface Viewport {
  width: number;
  height: number;
}

type Template = 'quiz' | 'recipe' | 'inventory';

function chooseTemplate(prompt: string): Template | undefined {
  const text = prompt.toLowerCase();
  if (/\b(quiz|trivia|question|questions)\b/.test(text)) return 'quiz';
  if (/\b(inventory|stock|pantry|supplies|items?)\b/.test(text) && !/\brecipe/.test(text)) return 'inventory';
  if (/\b(recipe|recipes|ingredient|ingredients|cookbook|shopping)\b/.test(text)) return 'recipe';
  return undefined;
}

/** A short label taken from "about <topic>" or "for <topic>". Letters, digits and spaces only. */
function topicOf(prompt: string): string | undefined {
  const match = /\b(?:about|on|for)\s+([A-Za-z0-9][A-Za-z0-9 ]{0,38})/.exec(prompt);
  const topic = match?.[1]?.trim().replace(/\s+/g, ' ');
  return topic !== undefined && topic.length > 0 ? topic : undefined;
}

function collectStrings(value: unknown, into: Set<string>, depth = 0): void {
  if (depth > 12) return;
  if (typeof value === 'string') into.add(value);
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, into, depth + 1));
  else if (typeof value === 'object' && value !== null) {
    for (const [key, v] of Object.entries(value)) {
      into.add(key);
      collectStrings(v, into, depth + 1);
    }
  }
}

function usedNames(context: ProjectContext): Set<string> {
  const used = new Set<string>();
  collectStrings(context, used);
  return used;
}

function safeSeed(seed: string | undefined): string {
  return (seed ?? '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 20);
}

/** First numeric suffix for which no generated name is already used in the project. */
function pickSuffix(candidates: (suffix: string) => string[], used: Set<string>): string {
  for (let n = 1; n < 1000; n++) {
    const suffix = n === 1 ? '' : `-${n}`;
    if (candidates(suffix).every((name) => !used.has(name))) return suffix;
  }
  return '-x';
}

const lit = (value: string | number | boolean): Expr => ({ kind: 'literal', value });
const stateOf = (key: string): Expr => ({ kind: 'state', key });

function px(viewport: Viewport, fx: number, fy: number, fw: number, fh: number) {
  return {
    x: Math.round(viewport.width * fx),
    y: Math.round(viewport.height * fy),
    width: Math.round(viewport.width * fw),
    height: Math.round(viewport.height * fh),
  };
}

function element(
  elementId: string,
  type: ElementType,
  name: string,
  properties: Record<string, unknown>,
  box: ReturnType<typeof px>,
  zIndex: number,
): Element {
  return {
    elementId,
    type,
    name,
    properties,
    layout: { ...box, zIndex, anchor: 'top-left', scaleMode: 'scale' },
    behaviors: [],
  };
}

class StepList {
  readonly steps: AIPlanStep[] = [];
  constructor(private readonly prefix: string) {}
  add(rationale: string, command: AIPlanCommand, cardId?: string): void {
    const id = `${this.prefix}s${this.steps.length + 1}`;
    this.steps.push({ id, ...(cardId !== undefined ? { cardId } : {}), rationale, command });
  }
}

/** Existing state variables that still parse, so the replacing `UPDATE_STATE_SCHEMA` keeps them. */
function existingState(context: ProjectContext): Record<string, StateVariable> {
  const out: Record<string, StateVariable> = {};
  for (const [key, value] of Object.entries(context.stack.stateSchema)) {
    const parsed = StateVariableSchema.safeParse(value);
    if (parsed.success) out[key] = parsed.data;
  }
  return out;
}

function click(behaviorId: string, actions: Behavior['actions']): Behavior {
  return { behaviorId, trigger: 'element.click', conditions: [], actions, enabled: true };
}

function quizPlan(context: ProjectContext, prompt: string, seed: string): AIPlan {
  const used = usedNames(context);
  const names = (s: string) => ({
    q: `${seed}quiz-question${s}`,
    r: `${seed}quiz-result${s}`,
    qText: `${seed}quiz-question-text${s}`,
    a: [1, 2, 3].map((n) => `${seed}quiz-answer-${n}${s}`),
    rText: `${seed}quiz-result-text${s}`,
    back: `${seed}quiz-restart${s}`,
    key: `quizAnswer${s.replace('-', '_')}`,
    bClick: `${seed}quiz-click${s}`,
    bEnter: `${seed}quiz-enter${s}`,
  });
  const suffix = pickSuffix((s) => {
    const n = names(s);
    return [n.q, n.r, n.qText, ...n.a, n.rText, n.back, n.key, n.bClick, n.bEnter];
  }, used);
  const n = names(suffix);
  const vp = context.stack.viewport;
  const topic = topicOf(prompt);
  const list = new StepList(`${seed}q${suffix}-`);
  const stateSchema = {
    ...existingState(context),
    [n.key]: { type: 'string', initial: '' } as StateVariable,
  };
  list.add('Add a variable that remembers which answer was chosen.', {
    type: 'UPDATE_STATE_SCHEMA',
    stateSchema,
  });
  list.add('Add the question Card.', { type: 'ADD_CARD', cardId: n.q, title: 'Quiz question' }, n.q);
  list.add('Add the result Card.', { type: 'ADD_CARD', cardId: n.r, title: 'Quiz result' }, n.r);
  list.add(
    'Add the question text.',
    {
      type: 'ADD_ELEMENT',
      cardId: n.q,
      element: element(
        n.qText,
        'text',
        'Question',
        {
          text: topic ? `Question about ${topic}: pick the best answer.` : 'Question: pick the best answer.',
          fontSize: 28,
        },
        px(vp, 0.1, 0.1, 0.8, 0.15),
        0,
      ),
    },
    n.q,
  );
  const labels = ['Answer A', 'Answer B', 'Answer C'];
  n.a.forEach((id, i) => {
    list.add(
      `Add the button for ${labels[i]}.`,
      {
        type: 'ADD_ELEMENT',
        cardId: n.q,
        element: element(
          id,
          'button',
          labels[i]!,
          { text: labels[i]!, fontSize: 20 },
          px(vp, 0.1, 0.35 + i * 0.17, 0.5, 0.12),
          i + 1,
        ),
      },
      n.q,
    );
  });
  list.add(
    'Add the result text.',
    {
      type: 'ADD_ELEMENT',
      cardId: n.r,
      element: element(
        n.rText,
        'text',
        'Result',
        { text: 'Your answer', fontSize: 28 },
        px(vp, 0.1, 0.2, 0.8, 0.15),
        0,
      ),
    },
    n.r,
  );
  list.add(
    'Add a button that returns to the question.',
    {
      type: 'ADD_ELEMENT',
      cardId: n.r,
      element: element(
        n.back,
        'button',
        'Try again',
        { text: 'Try again', fontSize: 20 },
        px(vp, 0.1, 0.5, 0.4, 0.12),
        1,
      ),
    },
    n.r,
  );
  n.a.forEach((id, i) => {
    list.add(
      `Make ${labels[i]} record the answer and open the result Card.`,
      {
        type: 'UPDATE_BEHAVIOR',
        cardId: n.q,
        elementId: id,
        behaviors: [
          click(n.bClick, [
            { type: 'setState', key: n.key, value: lit(labels[i]!) },
            { type: 'navigate', cardId: n.r },
          ]),
        ],
      },
      n.q,
    );
  });
  list.add(
    'Show the chosen answer when the result Card opens.',
    {
      type: 'UPDATE_BEHAVIOR',
      cardId: n.r,
      behaviors: [
        {
          behaviorId: n.bEnter,
          trigger: 'card.enter',
          conditions: [],
          actions: [
            {
              type: 'setText',
              elementId: n.rText,
              value: { kind: 'binary', op: '+', left: lit('You chose: '), right: stateOf(n.key) },
            },
          ],
          enabled: true,
        },
      ],
    },
    n.r,
  );
  list.add(
    'Let the player go back to the question.',
    {
      type: 'UPDATE_BEHAVIOR',
      cardId: n.r,
      elementId: n.back,
      behaviors: [click(n.bClick, [{ type: 'navigate', cardId: n.q }])],
    },
    n.r,
  );
  return {
    schemaVersion: 1,
    summary: 'Add a quiz question with three answers that open a result Card.',
    affectedCardIds: [n.q, n.r],
    steps: list.steps,
  };
}

function listPlan(
  context: ProjectContext,
  prompt: string,
  seed: string,
  template: 'recipe' | 'inventory',
): AIPlan {
  const used = usedNames(context);
  const word = template === 'recipe' ? 'ingredients' : 'items';
  const names = (s: string) => ({
    card: `${seed}${template}-card${s}`,
    title: `${seed}${template}-title${s}`,
    display: `${seed}${template}-list${s}`,
    input: `${seed}${template}-input${s}`,
    add: `${seed}${template}-add${s}`,
    list: `${word}${s.replace('-', '_')}`,
    draft: `${word}Draft${s.replace('-', '_')}`,
    bClick: `${seed}${template}-click${s}`,
    bEnter: `${seed}${template}-enter${s}`,
  });
  const suffix = pickSuffix((s) => {
    const n = names(s);
    return [n.card, n.title, n.display, n.input, n.add, n.list, n.draft, n.bClick, n.bEnter];
  }, used);
  const n = names(suffix);
  const vp = context.stack.viewport;
  const topic = topicOf(prompt);
  const heading = template === 'recipe' ? 'Ingredients' : 'Inventory';
  const empty = template === 'recipe' ? 'No ingredients yet.' : 'No items yet.';
  const list = new StepList(`${seed}l${suffix}-`);
  const stateSchema: Record<string, StateVariable> = {
    ...existingState(context),
    [n.list]: { type: 'list', initial: [] },
    [n.draft]: { type: 'string', initial: '' },
  };
  list.add(`Add a list for the ${word} and a variable for the text being typed.`, {
    type: 'UPDATE_STATE_SCHEMA',
    stateSchema,
  });
  list.add(
    `Add the ${heading.toLowerCase()} Card.`,
    { type: 'ADD_CARD', cardId: n.card, title: topic ? `${heading}: ${topic}` : heading },
    n.card,
  );
  list.add(
    'Add the heading.',
    {
      type: 'ADD_ELEMENT',
      cardId: n.card,
      element: element(
        n.title,
        'text',
        'Heading',
        { text: topic ? `${heading}: ${topic}` : heading, fontSize: 28, fontWeight: 'bold' },
        px(vp, 0.1, 0.05, 0.8, 0.12),
        0,
      ),
    },
    n.card,
  );
  list.add(
    `Add the text that shows the ${word}, one per line.`,
    {
      type: 'ADD_ELEMENT',
      cardId: n.card,
      element: element(
        n.display,
        'text',
        'List',
        { text: empty, fontSize: 20 },
        px(vp, 0.1, 0.2, 0.8, 0.4),
        1,
      ),
    },
    n.card,
  );
  list.add(
    'Add the input for a new entry.',
    {
      type: 'ADD_ELEMENT',
      cardId: n.card,
      element: element(
        n.input,
        'input',
        'New entry',
        { placeholder: 'Type an entry', fontSize: 18, stateKey: n.draft },
        px(vp, 0.1, 0.68, 0.5, 0.1),
        2,
      ),
    },
    n.card,
  );
  list.add(
    'Add the button that adds the entry.',
    {
      type: 'ADD_ELEMENT',
      cardId: n.card,
      element: element(
        n.add,
        'button',
        'Add',
        { text: 'Add', fontSize: 18 },
        px(vp, 0.65, 0.68, 0.25, 0.1),
        3,
      ),
    },
    n.card,
  );
  const join: Expr = { kind: 'listJoin', key: n.list, separator: '\n' };
  list.add(
    'Make the button append a non-empty entry and refresh the list text.',
    {
      type: 'UPDATE_BEHAVIOR',
      cardId: n.card,
      elementId: n.add,
      behaviors: [
        click(n.bClick, [
          {
            type: 'if',
            condition: { kind: 'binary', op: '!=', left: stateOf(n.draft), right: lit('') },
            then: [
              { type: 'listAdd', key: n.list, value: stateOf(n.draft) },
              { type: 'setText', elementId: n.display, value: join },
            ],
            else: [],
          },
        ]),
      ],
    },
    n.card,
  );
  list.add(
    'Show the current list when the Card opens.',
    {
      type: 'UPDATE_BEHAVIOR',
      cardId: n.card,
      behaviors: [
        {
          behaviorId: n.bEnter,
          trigger: 'card.enter',
          conditions: [],
          actions: [
            {
              type: 'if',
              condition: {
                kind: 'binary',
                op: '>',
                left: { kind: 'listLength', key: n.list },
                right: lit(0),
              },
              then: [{ type: 'setText', elementId: n.display, value: join }],
              else: [{ type: 'setText', elementId: n.display, value: lit(empty) }],
            },
          ],
          enabled: true,
        },
      ],
    },
    n.card,
  );
  return {
    schemaVersion: 1,
    summary: `Add a ${template === 'recipe' ? 'recipe ingredient' : 'inventory'} list with an input and an add button.`,
    affectedCardIds: [n.card],
    steps: list.steps,
  };
}

/** Builds a plan for `request`, or a normalized error. Exported for tests of the pure rule engine. */
export function planForRequest(request: PlanRequest, options: DemoOptions = {}): Result<AIPlan, GhostError> {
  const prompt = validatePrompt(request.prompt);
  if (!prompt.ok) return prompt;
  const template = chooseTemplate(request.prompt);
  if (template === undefined) {
    return err({
      code: 'INVALID_AI_PLAN',
      message: `The demo provider can only build ${SUPPORTED_REQUESTS}. Try one of those, or connect a model.`,
    });
  }
  const seed = safeSeed(options.idSeed);
  const plan =
    template === 'quiz'
      ? quizPlan(request.context, request.prompt, seed)
      : listPlan(request.context, request.prompt, seed, template);
  const withMeta: AIPlan = { ...plan, providerMeta: { providerId: 'demo' } };
  const parsed = AIPlanSchema.safeParse(withMeta);
  if (!parsed.success || byteLength(JSON.stringify(withMeta)) > MAX_PLAN_BYTES) {
    return err({ code: 'INVALID_AI_PLAN', message: MESSAGES.badOutput });
  }
  return ok(withMeta);
}

export function createDemoProvider(options: DemoOptions = {}): AIProviderAdapter {
  return withSafeSerialization({
    id: 'demo',
    label: 'Demo (offline)',
    capabilities: { structuredOutput: true, jsonMode: false, streaming: false, local: true },
    async testConnection() {
      return ok({ ok: true as const, detail: 'Demo provider ready. It runs on this computer.' });
    },
    async generatePlan(request) {
      if (request.signal?.aborted) return err({ code: 'PROVIDER_UNAVAILABLE', message: MESSAGES.cancelled });
      return planForRequest(request, options);
    },
  });
}
