import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { applyCommand, createStack } from '@ghoststack/domain';
import type { ActionNode, Behavior, Expr, ProjectCommand, Stack } from '@ghoststack/shared-contracts';
import { createRuntime } from './index';

const T = '2026-11-27T00:00:00.000Z';
const lit = (value: string | number | boolean): Expr => ({ kind: 'literal', value });

function build(commands: ProjectCommand[]): Stack {
  let s = createStack({ stackId: 's', cardId: 'c1', title: 'S', now: T });
  for (const c of commands) {
    const r = applyCommand(s, c, T);
    if (!r.ok) throw new Error(`${c.type}: ${r.error.message}`);
    s = r.value;
  }
  return s;
}
const behavior = (actions: ActionNode[]): Behavior => ({
  behaviorId: 'b',
  trigger: 'card.enter',
  conditions: [],
  actions,
  enabled: true,
});
const withList = (actions: ActionNode[], initial: (string | number)[] = []): Stack =>
  build([
    { type: 'UPDATE_STATE_SCHEMA', stateSchema: { items: { type: 'list', initial } } },
    { type: 'UPDATE_BEHAVIOR', cardId: 'c1', behaviors: [behavior(actions)] },
  ]);

describe('list state (M2.7 contract)', () => {
  it('adds, sets, removes and clears items', () => {
    const rt = createRuntime(
      withList(
        [
          { type: 'listAdd', key: 'items', value: lit('c') },
          { type: 'listSet', key: 'items', index: lit(0), value: lit('z') },
          { type: 'listRemove', key: 'items', index: lit(1) },
        ],
        ['a', 'b'],
      ),
    );
    const snap = rt.start();
    expect(snap.state['items']).toEqual(['z', 'c']);
    expect(snap.errors).toEqual([]);
  });

  it('clears a list', () => {
    const snap = createRuntime(withList([{ type: 'listClear', key: 'items' }], ['a'])).start();
    expect(snap.state['items']).toEqual([]);
  });

  it('reads length, item and join through expressions', () => {
    const stack = build([
      {
        type: 'UPDATE_STATE_SCHEMA',
        stateSchema: {
          items: { type: 'list', initial: ['a', 'b'] },
          out: { type: 'string', initial: '' },
          n: { type: 'number', initial: 0 },
        },
      },
      {
        type: 'UPDATE_BEHAVIOR',
        cardId: 'c1',
        behaviors: [
          behavior([
            { type: 'setState', key: 'out', value: { kind: 'listJoin', key: 'items', separator: ', ' } },
            { type: 'setState', key: 'n', value: { kind: 'listLength', key: 'items' } },
          ]),
        ],
      },
    ]);
    const snap = createRuntime(stack).start();
    expect(snap.state['out']).toBe('a, b');
    expect(snap.state['n']).toBe(2);
  });

  it('reports out-of-range indexes as runtime issues and keeps the list', () => {
    const snap = createRuntime(
      withList([{ type: 'listRemove', key: 'items', index: lit(5) }], ['a']),
    ).start();
    expect(snap.state['items']).toEqual(['a']);
    expect(snap.errors[0]?.message).toMatch(/not in list/);
  });

  it('never mutates the Stack initial list', () => {
    const stack = withList([{ type: 'listAdd', key: 'items', value: lit('x') }], ['a']);
    createRuntime(stack).start();
    expect(stack.stateSchema['items']?.initial).toEqual(['a']);
  });

  it('rejects list actions on a non-list variable and set on a list', () => {
    const base = build([
      {
        type: 'UPDATE_STATE_SCHEMA',
        stateSchema: { n: { type: 'number', initial: 0 }, l: { type: 'list', initial: [] } },
      },
    ]);
    const bad1 = applyCommand(
      base,
      { type: 'UPDATE_BEHAVIOR', cardId: 'c1', behaviors: [behavior([{ type: 'listClear', key: 'n' }])] },
      T,
    );
    const bad2 = applyCommand(
      base,
      {
        type: 'UPDATE_BEHAVIOR',
        cardId: 'c1',
        behaviors: [behavior([{ type: 'setState', key: 'l', value: lit(1) }])],
      },
      T,
    );
    expect(bad1.ok).toBe(false);
    expect(bad2.ok).toBe(false);
  });

  it('property: list actions never throw and stay within the cap', () => {
    const action: fc.Arbitrary<ActionNode> = fc.oneof(
      fc.string().map((s): ActionNode => ({ type: 'listAdd', key: 'items', value: lit(s) })),
      fc
        .integer({ min: -3, max: 6 })
        .map((i): ActionNode => ({ type: 'listRemove', key: 'items', index: lit(i) })),
      fc.tuple(fc.integer({ min: -3, max: 6 }), fc.string()).map(([i, s]): ActionNode => ({
        type: 'listSet',
        key: 'items',
        index: lit(i),
        value: lit(s),
      })),
      fc.constant<ActionNode>({ type: 'listClear', key: 'items' }),
      fc.constant<ActionNode>({ type: 'nextCard' }),
      fc.constant<ActionNode>({ type: 'prevCard' }),
    );
    fc.assert(
      fc.property(fc.array(action, { maxLength: 30 }), (actions) => {
        const snap = createRuntime(withList(actions, ['a'])).start();
        const list = snap.state['items'];
        expect(Array.isArray(list)).toBe(true);
        expect((list as unknown[]).length).toBeLessThanOrEqual(1000);
      }),
    );
  });

  it('next and previous card follow cardOrder and stop at the ends', () => {
    const stack = build([
      { type: 'ADD_CARD', cardId: 'c2', title: 'Two' },
      { type: 'UPDATE_BEHAVIOR', cardId: 'c1', behaviors: [behavior([{ type: 'nextCard' }])] },
    ]);
    const rt = createRuntime(stack);
    expect(rt.start().cardId).toBe('c2');
    const back = build([
      { type: 'ADD_CARD', cardId: 'c2', title: 'Two' },
      { type: 'UPDATE_BEHAVIOR', cardId: 'c1', behaviors: [behavior([{ type: 'prevCard' }])] },
    ]);
    expect(createRuntime(back).start().cardId).toBe('c1');
  });
});

describe('M2.5 and M2.6 commands', () => {
  it('sets and clears a card background, and rejects a bad color', () => {
    const s = build([{ type: 'SET_CARD_BACKGROUND', cardId: 'c1', background: '#112233' }]);
    expect(s.cards['c1']?.background).toBe('#112233');
    const cleared = applyCommand(s, { type: 'SET_CARD_BACKGROUND', cardId: 'c1', background: null }, T);
    expect(cleared.ok && cleared.value.cards['c1']?.background).toBeUndefined();
    expect(applyCommand(s, { type: 'SET_CARD_BACKGROUND', cardId: 'c1', background: 'red' }, T).ok).toBe(
      false,
    );
  });

  it('sets the viewport within bounds only', () => {
    expect(build([{ type: 'SET_VIEWPORT', width: 800, height: 600 }]).viewportDefaults).toEqual({
      width: 800,
      height: 600,
    });
    expect(applyCommand(build([]), { type: 'SET_VIEWPORT', width: 10, height: 600 }, T).ok).toBe(false);
  });
});
