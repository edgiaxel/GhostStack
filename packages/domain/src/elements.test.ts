import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { ActionNode, Behavior, Element, ProjectCommand, Stack } from '@ghoststack/shared-contracts';
import { applyCommand, createStack, findCardReferences, validateStack } from './index';

const t0 = '2026-11-26T00:00:00.000Z';
const t1 = '2026-11-26T00:00:01.000Z';

const base = (): Stack => createStack({ stackId: 's', cardId: 'c1', title: 'S', now: t0 });

const element = (id: string, over: Partial<Element> = {}): Element => ({
  elementId: id,
  type: 'button',
  name: id,
  properties: { text: id },
  layout: { x: 0, y: 0, width: 100, height: 40, zIndex: 0 },
  behaviors: [],
  ...over,
});

function run(stack: Stack, ...commands: ProjectCommand[]): Stack {
  let current = stack;
  for (const c of commands) {
    const r = applyCommand(current, c, t1);
    if (!r.ok) throw new Error(`${c.type}: ${r.error.code} ${r.error.message}`);
    current = r.value;
  }
  return current;
}

const click = (id: string, actions: ActionNode[]): Behavior => ({
  behaviorId: id,
  trigger: 'element.click',
  conditions: [],
  actions,
  enabled: true,
});

describe('element commands', () => {
  it('adds elements on top and ignores the supplied zIndex', () => {
    const s = run(
      base(),
      { type: 'ADD_ELEMENT', cardId: 'c1', element: element('a') },
      {
        type: 'ADD_ELEMENT',
        cardId: 'c1',
        element: element('b', { layout: { x: 0, y: 0, width: 1, height: 1, zIndex: 99 } }),
      },
    );
    expect(s.cards['c1']?.elements.map((e) => e.layout.zIndex)).toEqual([0, 1]);
  });

  it('rejects a duplicate element id, an unknown card and bad properties', () => {
    const s = run(base(), { type: 'ADD_ELEMENT', cardId: 'c1', element: element('a') });
    expect(applyCommand(s, { type: 'ADD_ELEMENT', cardId: 'c1', element: element('a') }, t1).ok).toBe(false);
    expect(applyCommand(s, { type: 'ADD_ELEMENT', cardId: 'nope', element: element('x') }, t1).ok).toBe(
      false,
    );
    const bad = applyCommand(
      s,
      {
        type: 'ADD_ELEMENT',
        cardId: 'c1',
        element: element('x', { properties: { text: 'x', onclick: 'alert(1)' } }),
      },
      t1,
    );
    expect(bad).toMatchObject({ ok: false, error: { code: 'PROJECT_VALIDATION_FAILED' } });
    const color = applyCommand(
      s,
      { type: 'UPDATE_ELEMENT', cardId: 'c1', elementId: 'a', patch: { properties: { color: 'red;x:y' } } },
      t1,
    );
    expect(color.ok).toBe(false);
  });

  it('updates name, merges properties and layout, and does not mutate the input', () => {
    const s = run(base(), { type: 'ADD_ELEMENT', cardId: 'c1', element: element('a') });
    const frozen = JSON.stringify(s);
    const next = run(s, {
      type: 'UPDATE_ELEMENT',
      cardId: 'c1',
      elementId: 'a',
      patch: {
        name: 'Go',
        properties: { fontSize: 18 },
        layout: { x: 10, anchor: 'bottom-right', scaleMode: 'scale' },
      },
    });
    const el = next.cards['c1']?.elements[0];
    expect(el?.name).toBe('Go');
    expect(el?.properties).toEqual({ text: 'a', fontSize: 18 });
    expect(el?.layout).toMatchObject({ x: 10, width: 100, anchor: 'bottom-right', scaleMode: 'scale' });
    expect(JSON.stringify(s)).toBe(frozen);
  });

  it('only image elements reference registered assets, and null clears the reference', () => {
    const asset = {
      assetId: 'as1',
      relativePath: 'as1-a.png',
      mimeType: 'image/png',
      byteSize: 3,
      checksum: 'x',
    };
    let s = run(base(), { type: 'REGISTER_ASSET', asset });
    s = run(s, {
      type: 'ADD_ELEMENT',
      cardId: 'c1',
      element: element('img', { type: 'image', properties: { alt: 'a' }, assetId: 'as1' }),
    });
    expect(s.cards['c1']?.elements[0]?.assetId).toBe('as1');
    expect(
      applyCommand(s, { type: 'ADD_ELEMENT', cardId: 'c1', element: element('t', { assetId: 'as1' }) }, t1)
        .ok,
    ).toBe(false);
    expect(
      applyCommand(
        s,
        { type: 'UPDATE_ELEMENT', cardId: 'c1', elementId: 'img', patch: { assetId: 'missing' } },
        t1,
      ).ok,
    ).toBe(false);
    s = run(s, { type: 'UPDATE_ELEMENT', cardId: 'c1', elementId: 'img', patch: { assetId: null } });
    expect(s.cards['c1']?.elements[0]).not.toHaveProperty('assetId');
  });

  it('rejects unsafe or duplicate asset registration', () => {
    const asset = {
      assetId: 'as1',
      relativePath: 'a.png',
      mimeType: 'image/png',
      byteSize: 1,
      checksum: 'x',
    };
    const s = run(base(), { type: 'REGISTER_ASSET', asset });
    expect(applyCommand(s, { type: 'REGISTER_ASSET', asset }, t1).ok).toBe(false);
    expect(applyCommand(s, { type: 'REGISTER_ASSET', asset: { ...asset, assetId: 'as2' } }, t1).ok).toBe(
      false,
    );
    for (const relativePath of ['../x.png', '/x.png', 'a\\b.png', 'C:x.png', 'a//b.png']) {
      expect(
        applyCommand(s, { type: 'REGISTER_ASSET', asset: { ...asset, assetId: 'as3', relativePath } }, t1).ok,
      ).toBe(false);
    }
  });
});

describe('z-order', () => {
  const three = (): Stack =>
    run(
      base(),
      { type: 'ADD_ELEMENT', cardId: 'c1', element: element('a') },
      { type: 'ADD_ELEMENT', cardId: 'c1', element: element('b') },
      { type: 'ADD_ELEMENT', cardId: 'c1', element: element('c') },
    );
  const order = (s: Stack): string[] =>
    [...(s.cards['c1']?.elements ?? [])]
      .sort((x, y) => x.layout.zIndex - y.layout.zIndex)
      .map((e) => e.elementId);

  it('moves to front, back, forward and backward and renumbers densely', () => {
    const s = three();
    expect(
      order(run(s, { type: 'REORDER_ELEMENT', cardId: 'c1', elementId: 'a', placement: 'front' })),
    ).toEqual(['b', 'c', 'a']);
    expect(
      order(run(s, { type: 'REORDER_ELEMENT', cardId: 'c1', elementId: 'c', placement: 'back' })),
    ).toEqual(['c', 'a', 'b']);
    expect(
      order(run(s, { type: 'REORDER_ELEMENT', cardId: 'c1', elementId: 'a', placement: 'forward' })),
    ).toEqual(['b', 'a', 'c']);
    expect(
      order(run(s, { type: 'REORDER_ELEMENT', cardId: 'c1', elementId: 'c', placement: 'backward' })),
    ).toEqual(['a', 'c', 'b']);
    const z = run(s, { type: 'REORDER_ELEMENT', cardId: 'c1', elementId: 'b', placement: 'front' })
      .cards['c1']?.elements.map((e) => e.layout.zIndex)
      .sort();
    expect(z).toEqual([0, 1, 2]);
  });

  it('keeps zIndex a permutation of 0..n-1 for any sequence of placements', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(fc.constantFrom('a', 'b', 'c'), fc.constantFrom('front', 'back', 'forward', 'backward')),
          { maxLength: 20 },
        ),
        (steps) => {
          let s = three();
          for (const [elementId, placement] of steps) {
            s = run(s, { type: 'REORDER_ELEMENT', cardId: 'c1', elementId, placement });
          }
          expect(s.cards['c1']?.elements.map((e) => e.layout.zIndex).sort()).toEqual([0, 1, 2]);
          expect(validateStack(s).ok).toBe(true);
        },
      ),
    );
  });
});

describe('behaviors and references', () => {
  const withTwoCards = (): Stack =>
    run(
      base(),
      { type: 'ADD_CARD', cardId: 'c2', title: 'Two' },
      { type: 'ADD_ELEMENT', cardId: 'c1', element: element('go') },
      {
        type: 'ADD_ELEMENT',
        cardId: 'c1',
        element: element('label', { type: 'text', properties: { text: 'hi' } }),
      },
      { type: 'UPDATE_STATE_SCHEMA', stateSchema: { score: { type: 'number', initial: 0 } } },
    );

  it('stores a behavior and rejects dangling references and invalid triggers', () => {
    const s = withTwoCards();
    const ok = run(s, {
      type: 'UPDATE_BEHAVIOR',
      cardId: 'c1',
      elementId: 'go',
      behaviors: [click('b1', [{ type: 'navigate', cardId: 'c2' }])],
    });
    expect(ok.cards['c1']?.elements[0]?.behaviors).toHaveLength(1);

    const cases: Behavior[] = [
      click('x', [{ type: 'navigate', cardId: 'nope' }]),
      click('x', [{ type: 'setState', key: 'nope', value: { kind: 'literal', value: 1 } }]),
      click('x', [{ type: 'setText', elementId: 'ghost', value: { kind: 'literal', value: 'a' } }]),
      { ...click('x', []), conditions: [{ kind: 'state', key: 'nope' }] },
      { ...click('x', []), trigger: 'card.enter' },
      { ...click('x', []), trigger: 'element.change' },
    ];
    for (const behavior of cases) {
      const r = applyCommand(
        s,
        { type: 'UPDATE_BEHAVIOR', cardId: 'c1', elementId: 'go', behaviors: [behavior] },
        t1,
      );
      expect(r.ok).toBe(false);
    }
    const cardLevel = applyCommand(
      s,
      { type: 'UPDATE_BEHAVIOR', cardId: 'c1', behaviors: [click('y', [])] },
      t1,
    );
    expect(cardLevel.ok).toBe(false);
    const dup = applyCommand(
      s,
      { type: 'UPDATE_BEHAVIOR', cardId: 'c1', elementId: 'go', behaviors: [click('d', []), click('d', [])] },
      t1,
    );
    expect(dup.ok).toBe(false);
  });

  it('finds navigate references, including inside if branches', () => {
    const s = run(withTwoCards(), {
      type: 'UPDATE_BEHAVIOR',
      cardId: 'c1',
      elementId: 'go',
      behaviors: [
        click('b1', [
          {
            type: 'if',
            condition: { kind: 'literal', value: true },
            then: [{ type: 'navigate', cardId: 'c2' }],
            else: [],
          },
        ]),
      ],
    });
    expect(findCardReferences(s, 'c2')).toEqual([{ cardId: 'c1', elementId: 'go', behaviorId: 'b1' }]);
    expect(findCardReferences(s, 'c1')).toEqual([]);
  });

  it('deleting a card removes navigate actions that target it and keeps the Stack valid', () => {
    const s = run(withTwoCards(), {
      type: 'UPDATE_BEHAVIOR',
      cardId: 'c1',
      elementId: 'go',
      behaviors: [
        click('b1', [
          { type: 'navigate', cardId: 'c2' },
          { type: 'setText', elementId: 'label', value: { kind: 'literal', value: 'x' } },
        ]),
      ],
    });
    const after = run(s, { type: 'DELETE_CARD', cardId: 'c2' });
    expect(after.cards['c1']?.elements[0]?.behaviors[0]?.actions).toEqual([
      { type: 'setText', elementId: 'label', value: { kind: 'literal', value: 'x' } },
    ]);
    expect(validateStack(after).ok).toBe(true);
  });

  it('deleting an element removes actions that target it', () => {
    const s = run(withTwoCards(), {
      type: 'UPDATE_BEHAVIOR',
      cardId: 'c1',
      elementId: 'go',
      behaviors: [
        click('b1', [
          { type: 'hide', elementId: 'label' },
          { type: 'navigate', cardId: 'c2' },
        ]),
      ],
    });
    const after = run(s, { type: 'DELETE_ELEMENT', cardId: 'c1', elementId: 'label' });
    expect(after.cards['c1']?.elements.map((e) => e.elementId)).toEqual(['go']);
    expect(after.cards['c1']?.elements[0]?.behaviors[0]?.actions).toEqual([
      { type: 'navigate', cardId: 'c2' },
    ]);
  });

  it('refuses to drop a state variable that is still referenced, and binds inputs to state', () => {
    let s = run(withTwoCards(), {
      type: 'ADD_ELEMENT',
      cardId: 'c1',
      element: element('in', { type: 'input', properties: { stateKey: 'score' } }),
    });
    expect(applyCommand(s, { type: 'UPDATE_STATE_SCHEMA', stateSchema: {} }, t1).ok).toBe(false);
    s = run(
      s,
      { type: 'DELETE_ELEMENT', cardId: 'c1', elementId: 'in' },
      { type: 'UPDATE_STATE_SCHEMA', stateSchema: {} },
    );
    expect(s.stateSchema).toEqual({});
    expect(
      applyCommand(
        s,
        {
          type: 'UPDATE_STATE_SCHEMA',
          stateSchema: { n: { type: 'number', initial: 'x' as unknown as number } },
        },
        t1,
      ).ok,
    ).toBe(false);
  });

  it('duplicating a card keeps a valid Stack with behaviors', () => {
    const s = run(withTwoCards(), {
      type: 'UPDATE_BEHAVIOR',
      cardId: 'c1',
      elementId: 'go',
      behaviors: [click('b1', [{ type: 'navigate', cardId: 'c2' }])],
    });
    const after = run(s, { type: 'DUPLICATE_CARD', cardId: 'c1', newCardId: 'c3' });
    expect(validateStack(after).ok).toBe(true);
    expect(findCardReferences(after, 'c2')).toHaveLength(2);
  });
});

describe('property removal', () => {
  it('removes a property set to null and keeps the rest', () => {
    let s = run(base(), {
      type: 'ADD_ELEMENT',
      cardId: 'c1',
      element: element('a', { properties: { text: 'a', color: '#112233' } }),
    });
    s = run(s, {
      type: 'UPDATE_ELEMENT',
      cardId: 'c1',
      elementId: 'a',
      patch: { properties: { color: null } },
    });
    expect(s.cards['c1']?.elements[0]?.properties).toEqual({ text: 'a' });
  });
});
