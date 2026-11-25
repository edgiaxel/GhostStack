import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createStack, applyCommand, validateStack } from '@ghoststack/domain';
import type { ActionNode, Behavior, Expr, ProjectCommand, Stack } from '@ghoststack/shared-contracts';
import { LIMITS, createRuntime, evaluate } from './index';

const T = '2026-11-26T00:00:00.000Z';
const lit = (value: string | number | boolean): Expr => ({ kind: 'literal', value });
const st = (key: string): Expr => ({ kind: 'state', key });
const bin = (op: Extract<Expr, { kind: 'binary' }>['op'], left: Expr, right: Expr): Expr => ({
  kind: 'binary',
  op,
  left,
  right,
});
const beh = (
  id: string,
  trigger: Behavior['trigger'],
  actions: ActionNode[],
  conditions: Expr[] = [],
  enabled = true,
): Behavior => ({
  behaviorId: id,
  trigger,
  conditions,
  actions,
  enabled,
});

function build(commands: ProjectCommand[]): Stack {
  let s = createStack({ stackId: 's', cardId: 'c1', title: 'S', now: T });
  for (const c of commands) {
    const r = applyCommand(s, c, T);
    if (!r.ok) throw new Error(`${c.type}: ${r.error.message}`);
    s = r.value;
  }
  return s;
}
const el = (id: string, type: 'button' | 'text' | 'input', properties: Record<string, unknown>) => ({
  type: 'ADD_ELEMENT' as const,
  cardId: 'c1',
  element: {
    elementId: id,
    type,
    name: id,
    properties,
    layout: { x: 0, y: 0, width: 10, height: 10, zIndex: 0 },
    behaviors: [],
  },
});
const schema: ProjectCommand = {
  type: 'UPDATE_STATE_SCHEMA',
  stateSchema: {
    score: { type: 'number', initial: 0 },
    name: { type: 'string', initial: '' },
    done: { type: 'boolean', initial: false },
  },
};

describe('evaluate', () => {
  const s = { n: 4, w: 'hi', f: false };
  it.each([
    [bin('+', lit(1), lit(2)), 3],
    [bin('+', lit('a'), lit('b')), 'ab'],
    [bin('+', lit('a'), lit(1)), 'a1'],
    [bin('*', st('n'), lit(3)), 12],
    [bin('%', lit(7), lit(4)), 3],
    [bin('==', lit(1), lit('1')), false],
    [bin('!=', lit(1), lit('1')), true],
    [bin('<', lit('a'), lit('b')), true],
    [bin('and', lit(1), lit('')), false],
    [bin('or', st('f'), lit('x')), true],
    [{ kind: 'not', arg: lit(0) } as Expr, true],
  ])('evaluates %#', (e, expected) => {
    expect(evaluate(e, s)).toBe(expected);
  });

  it.each([
    bin('/', lit(1), lit(0)),
    bin('%', lit(1), lit(0)),
    bin('-', lit('a'), lit(1)),
    bin('<', lit(1), lit('a')),
    bin('+', lit(true), lit(1)),
    st('nope'),
    bin('*', lit(1e308), lit(10)),
  ])('throws for invalid expression %#', (e) => {
    expect(() => evaluate(e, s)).toThrow();
  });
});

describe('createRuntime', () => {
  it('initialises state and runs card.enter on start', () => {
    const stack = build([
      schema,
      el('t', 'text', { text: 'hi' }),
      {
        type: 'UPDATE_BEHAVIOR',
        cardId: 'c1',
        behaviors: [
          beh('b', 'card.enter', [
            { type: 'setState', key: 'score', value: lit(5) },
            { type: 'hide', elementId: 't' },
          ]),
        ],
      },
    ]);
    const snap = createRuntime(stack).start();
    expect(snap.state).toEqual({ score: 5, name: '', done: false });
    expect(snap.elements['t']).toEqual({ visible: false });
    expect(snap.errors).toEqual([]);
  });

  it('runs click behaviors in order, honoring conditions, enabled and branching', () => {
    const stack = build([
      schema,
      el('btn', 'button', { text: 'Go' }),
      el('lbl', 'text', { text: 'x' }),
      { type: 'ADD_CARD', cardId: 'c2', title: 'Two' },
      {
        type: 'UPDATE_BEHAVIOR',
        cardId: 'c1',
        elementId: 'btn',
        behaviors: [
          beh('inc', 'element.click', [
            { type: 'setState', key: 'score', value: bin('+', st('score'), lit(1)) },
          ]),
          beh('off', 'element.click', [{ type: 'setState', key: 'score', value: lit(99) }], [], false),
          beh('branch', 'element.click', [
            {
              type: 'if',
              condition: bin('>=', st('score'), lit(2)),
              then: [{ type: 'navigate', cardId: 'c2' }],
              else: [{ type: 'setText', elementId: 'lbl', value: bin('+', lit('score '), st('score')) }],
            },
          ]),
          beh('never', 'element.click', [{ type: 'setState', key: 'done', value: lit(true) }], [lit(false)]),
        ],
      },
    ]);
    const rt = createRuntime(stack);
    rt.start();
    let snap = rt.dispatch({ type: 'element.click', elementId: 'btn' });
    expect(snap).toMatchObject({ cardId: 'c1', state: { score: 1, done: false } });
    expect(snap.elements['lbl']?.text).toBe('score 1');
    snap = rt.dispatch({ type: 'element.click', elementId: 'btn' });
    expect(snap.cardId).toBe('c2');
    expect(snap.errors).toEqual([]);
  });

  it('writes input values to the bound variable and runs change behaviors', () => {
    const stack = build([
      schema,
      el('inp', 'input', { stateKey: 'score' }),
      {
        type: 'UPDATE_BEHAVIOR',
        cardId: 'c1',
        elementId: 'inp',
        behaviors: [
          beh('c', 'element.change', [
            { type: 'setState', key: 'done', value: bin('>', st('score'), lit(2)) },
          ]),
        ],
      },
    ]);
    const rt = createRuntime(stack);
    rt.start();
    expect(rt.dispatch({ type: 'element.change', elementId: 'inp', value: '7' }).state).toMatchObject({
      score: 7,
      done: true,
    });
    const bad = rt.dispatch({ type: 'element.change', elementId: 'inp', value: 'abc' });
    expect(bad.state['score']).toBe(7);
    expect(bad.errors[0]?.message).toContain('not a valid number');
  });

  it('reports errors without throwing and keeps going', () => {
    const stack = build([
      schema,
      el('btn', 'button', { text: 'x' }),
      {
        type: 'UPDATE_BEHAVIOR',
        cardId: 'c1',
        elementId: 'btn',
        behaviors: [
          beh('b', 'element.click', [
            { type: 'setState', key: 'score', value: bin('/', lit(1), lit(0)) },
            { type: 'setState', key: 'score', value: lit('text') },
            { type: 'setState', key: 'score', value: lit(3) },
          ]),
        ],
      },
    ]);
    const rt = createRuntime(stack);
    rt.start();
    const snap = rt.dispatch({ type: 'element.click', elementId: 'btn' });
    expect(snap.state['score']).toBe(3);
    expect(snap.errors.map((e) => e.behaviorId)).toEqual(['b', 'b']);
    expect(rt.dispatch({ type: 'element.click', elementId: 'ghost' }).errors).toHaveLength(3);
  });

  it('stops endless navigation loops', () => {
    const stack = build([
      { type: 'ADD_CARD', cardId: 'c2', title: 'Two' },
      {
        type: 'UPDATE_BEHAVIOR',
        cardId: 'c1',
        behaviors: [beh('a', 'card.enter', [{ type: 'navigate', cardId: 'c2' }])],
      },
      {
        type: 'UPDATE_BEHAVIOR',
        cardId: 'c2',
        behaviors: [beh('b', 'card.enter', [{ type: 'navigate', cardId: 'c1' }])],
      },
    ]);
    const snap = createRuntime(stack).start();
    expect(snap.errors.some((e) => e.message.includes('Too many card changes'))).toBe(true);
    expect(LIMITS.navigationsPerDispatch).toBeGreaterThan(0);
  });

  it('never mutates the Stack', () => {
    const stack = build([
      schema,
      el('btn', 'button', { text: 'x' }),
      {
        type: 'UPDATE_BEHAVIOR',
        cardId: 'c1',
        elementId: 'btn',
        behaviors: [
          beh('b', 'element.click', [
            { type: 'setState', key: 'score', value: lit(9) },
            { type: 'setText', elementId: 'btn', value: lit('y') },
          ]),
        ],
      },
    ]);
    const before = JSON.stringify(stack);
    const deepFreeze = <T>(o: T): T => {
      Object.values(o as object).forEach((v) => typeof v === 'object' && v !== null && deepFreeze(v));
      return Object.freeze(o);
    };
    const rt = createRuntime(deepFreeze(JSON.parse(JSON.stringify(stack)) as Stack));
    rt.start();
    rt.dispatch({ type: 'element.click', elementId: 'btn' });
    expect(JSON.stringify(stack)).toBe(before);
  });

  it('never throws for random valid behaviors', () => {
    const exprArb: fc.Arbitrary<Expr> = fc.letrec<{ e: Expr }>((tie) => ({
      e: fc.oneof(
        { depthSize: 'small', maxDepth: 2 },
        fc.oneof(fc.integer(), fc.string({ maxLength: 3 }), fc.boolean()).map((v): Expr => lit(v)),
        fc.constantFrom('score', 'name', 'done', 'missing').map((k): Expr => st(k)),
        tie('e').map((arg): Expr => ({ kind: 'not', arg })),
        fc
          .tuple(fc.constantFrom('+', '-', '*', '/', '%', '<', '==', 'and', 'or'), tie('e'), tie('e'))
          .map(([op, l, r]): Expr => bin(op as never, l, r)),
      ),
    })).e;
    const actionArb: fc.Arbitrary<ActionNode> = fc.oneof(
      fc
        .tuple(fc.constantFrom('score', 'name', 'done', 'missing'), exprArb)
        .map(([key, value]): ActionNode => ({ type: 'setState', key, value })),
      exprArb.map((value): ActionNode => ({ type: 'setText', elementId: 'btn', value })),
      fc.constantFrom('btn', 'ghost').map((elementId): ActionNode => ({ type: 'hide', elementId })),
      fc.constantFrom('c1', 'c2', 'nope').map((cardId): ActionNode => ({ type: 'navigate', cardId })),
    );
    const base = build([
      schema,
      el('btn', 'button', { text: 'x' }),
      { type: 'ADD_CARD', cardId: 'c2', title: 'Two' },
    ]);
    fc.assert(
      fc.property(
        fc.array(actionArb, { maxLength: 6 }),
        fc.array(exprArb, { maxLength: 2 }),
        (actions, conditions) => {
          const stack: Stack = {
            ...base,
            cards: {
              ...base.cards,
              c1: {
                ...base.cards['c1']!,
                behaviors: [beh('e', 'card.enter', actions, conditions)],
                elements: base.cards['c1']!.elements.map((e) => ({
                  ...e,
                  behaviors: [beh('k', 'element.click', actions, conditions)],
                })),
              },
            },
          };
          const rt = createRuntime(stack);
          rt.start();
          rt.dispatch({ type: 'element.click', elementId: 'btn' });
          expect(validateStack(base).ok).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });
});
