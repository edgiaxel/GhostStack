import { describe, expect, it } from 'vitest';
import { createStack, applyCommand } from '@ghoststack/domain';
import type { Behavior } from '@ghoststack/shared-contracts';
import {
  allowedTriggers,
  buildContext,
  checkScript,
  completionWords,
  defaultAction,
  defaultExpr,
  describeBehavior,
  dryRun,
  moveItem,
} from './model';

const T = '2026-11-26T00:00:00.000Z';
const base = createStack({ stackId: 's', cardId: 'c1', title: 'S', now: T });
const withEl = (() => {
  const r = applyCommand(
    base,
    {
      type: 'ADD_ELEMENT',
      cardId: 'c1',
      element: {
        elementId: 'b',
        type: 'button',
        name: 'Go',
        properties: { text: 'x' },
        layout: { x: 0, y: 0, width: 1, height: 1, zIndex: 0 },
        behaviors: [],
      },
    },
    T,
  );
  if (!r.ok) throw new Error('setup');
  return r.value;
})();

describe('model', () => {
  it('limits triggers by owner', () => {
    expect(allowedTriggers('card')).toEqual(['card.enter']);
    expect(allowedTriggers('button')).toEqual(['element.click']);
    expect(allowedTriggers('input')).toContain('element.change');
  });

  it('moves items and ignores out-of-range moves', () => {
    expect(moveItem([1, 2, 3], 0, 1)).toEqual([2, 1, 3]);
    expect(moveItem([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
    expect(moveItem([1, 2, 3], 2, 1)).toEqual([1, 2, 3]);
  });

  it('builds defaults from the Stack', () => {
    const ctx = buildContext(withEl, 'c1', () => undefined);
    expect(ctx.elements).toEqual([{ id: 'b', name: 'Go', type: 'button' }]);
    expect(defaultAction('show', ctx)).toEqual({ type: 'show', elementId: 'b' });
    expect(defaultAction('navigate', ctx)).toEqual({ type: 'navigate', cardId: 'c1' });
    expect(defaultExpr('binary', [], { kind: 'literal', value: 1 })).toMatchObject({
      kind: 'binary',
      left: { value: 1 },
    });
    expect(completionWords(ctx).map((w) => w.label)).toContain('"Go"');
  });
  it('splits scalar and list variables and defaults list blocks to a list', () => {
    const s = {
      ...withEl,
      stateSchema: {
        n: { type: 'number' as const, initial: 0 },
        items: { type: 'list' as const, initial: [] },
      },
    };
    const ctx = buildContext(s, 'c1', () => undefined);
    expect(ctx.stateKeys).toEqual(['n']);
    expect(ctx.listKeys).toEqual(['items']);
    expect(defaultAction('listAdd', ctx)).toMatchObject({ type: 'listAdd', key: 'items' });
    expect(defaultExpr('listJoin', ctx.stateKeys, undefined, ctx.listKeys)).toMatchObject({ key: 'items' });
  });
  it('describes behaviors as sentences', () => {
    const ctx = buildContext(withEl, 'c1', () => undefined);
    const b: Behavior = {
      behaviorId: 'x',
      trigger: 'element.click',
      conditions: [],
      actions: [
        { type: 'listAdd', key: 'items', value: { kind: 'literal', value: 'a' } },
        { type: 'setText', elementId: 'b', value: { kind: 'listJoin', key: 'items', separator: '\n' } },
        { type: 'nextCard' },
      ],
      enabled: true,
    };
    expect(describeBehavior(b, ctx, 'Go')).toBe(
      'When Go is clicked, add "a" to items, then set the text of "Go" to items as text, then go to the next card',
    );
    expect(describeBehavior({ ...b, actions: [], enabled: false }, ctx, 'Go')).toBe(
      'When Go is clicked, do nothing (disabled)',
    );
  });
  it('maps a domain error to the offending script line', () => {
    const owner = { cardId: 'c1', elementId: 'b' };
    const src = 'behavior "a" on element.click {\n  show "Go"\n  go "nope"\n}';
    const issue = checkScript(src, withEl, owner, T, { elements: [{ id: 'b', name: 'Go' }] }).issues[0];
    expect(issue).toMatchObject({ line: 3, column: 6 });
  });
  it('resolves names in scripts', () => {
    const owner = { cardId: 'c1', elementId: 'b' };
    const ok = checkScript('behavior "a" on element.click { hide "Go" }', withEl, owner, T, {
      elements: [{ id: 'b', name: 'Go' }],
    });
    expect(ok.behaviors?.[0]?.actions[0]).toEqual({ type: 'hide', elementId: 'b' });
  });

  it('reports domain rejections before dispatch', () => {
    const bad: Behavior = {
      behaviorId: 'x',
      trigger: 'element.click',
      conditions: [],
      actions: [{ type: 'navigate', cardId: 'nope' }],
      enabled: true,
    };
    expect(dryRun(withEl, { cardId: 'c1', elementId: 'b' }, [bad], T)).toContain('unknown card');
    expect(dryRun(withEl, { cardId: 'c1', elementId: 'b' }, [], T)).toBeUndefined();
  });

  it('checks scripts: parse errors, domain errors, success', () => {
    const owner = { cardId: 'c1', elementId: 'b' };
    expect(checkScript('behavior "a" on element.click { go }', withEl, owner, T).issues[0]?.line).toBe(1);
    expect(
      checkScript('behavior "a" on element.click { go "nope" }', withEl, owner, T).issues[0]?.message,
    ).toContain('unknown card');
    expect(checkScript('behavior "a" on card.enter { }', withEl, owner, T).issues[0]?.message).toContain(
      'card.enter',
    );
    const ok = checkScript('behavior "a" on element.click { go "c1" }', withEl, owner, T);
    expect(ok.issues).toEqual([]);
    expect(ok.behaviors).toHaveLength(1);
  });
});
