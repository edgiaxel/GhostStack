import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createStack, validateStack } from '@ghoststack/domain';
import { createIdbStorage } from '@ghoststack/storage';
import { ELEMENT_DEFAULTS } from '@ghoststack/shared-contracts';
import type { ElementType, Stack, StackSession } from '@ghoststack/shared-contracts';
import { createStackSessionFactory } from '../history/session';
import {
  alignElements,
  cloneElements,
  deleteElements,
  dispatchAll,
  distributeElements,
  duplicateElements,
  moveElements,
  pasteElements,
} from './canvas-actions';
import { clearClipboard, copyToClipboard, readClipboard } from './clipboard';
import { minSize, resizeBox } from './geometry';

const T = '2026-11-26T00:00:00.000Z';
let n = 0;
const TYPES: ElementType[] = ['text', 'button', 'shape', 'input', 'line'];

interface Spec {
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
}
const specArb = fc.record({
  type: fc.constantFrom(...TYPES),
  x: fc.integer({ min: -100, max: 1300 }),
  y: fc.integer({ min: -100, max: 700 }),
  width: fc.integer({ min: 1, max: 500 }),
  height: fc.integer({ min: 1, max: 300 }),
});

/** A real session over fake IndexedDB with a second card and the given elements on card c1. */
async function open(specs: Spec[]): Promise<StackSession> {
  const storage = createIdbStorage();
  const stackId = `canvas${++n}`;
  await storage.stacks.save(createStack({ stackId, cardId: 'c1', title: 'T', now: T }));
  const r = await createStackSessionFactory({ ...storage, debounceMs: 600_000 }).open(stackId);
  if (!r.ok) throw new Error(r.error.message);
  const s = r.value;
  const must = (x: { ok: boolean }): void => {
    if (!x.ok) throw new Error('setup command failed');
  };
  must(s.dispatch({ type: 'ADD_CARD', cardId: 'c2', title: 'Two' }));
  specs.forEach((spec, i) =>
    must(
      s.dispatch({
        type: 'ADD_ELEMENT',
        cardId: 'c1',
        element: {
          elementId: `e${i}`,
          type: spec.type,
          name: `E ${i}`,
          properties: { ...ELEMENT_DEFAULTS[spec.type].properties },
          layout: { x: spec.x, y: spec.y, width: spec.width, height: spec.height, zIndex: 0 },
          behaviors: [],
        },
      }),
    ),
  );
  return s;
}

/** Undo and redo stamp a new `updatedAt` on purpose, so equality ignores that one field. */
const sameContent = (a: Stack, b: Stack): boolean =>
  JSON.stringify({ ...a, updatedAt: '' }) === JSON.stringify({ ...b, updatedAt: '' });

/** Runs `act`, then asserts the Stack is valid and that one undo restores the exact previous Stack. */
function expectValidAndUndoable(s: StackSession, act: () => { ok: boolean }): void {
  const before = s.getStack();
  const r = act();
  expect(r.ok).toBe(true);
  const after = s.getStack();
  expect(validateStack(after).ok).toBe(true);
  expect(s.undo()).toBe(true);
  expect(sameContent(s.getStack(), before)).toBe(true);
  expect(s.redo()).toBe(true);
  expect(sameContent(s.getStack(), after)).toBe(true);
  s.undo();
}

const idsOf = (s: StackSession): string[] => s.getStack().cards['c1']!.elements.map((e) => e.elementId);
const pickIds = (all: string[], mask: boolean[]): string[] => {
  const picked = all.filter((_, i) => mask[i % mask.length]);
  return picked.length > 0 ? picked : all.slice(0, 1);
};
const maskArb = fc.array(fc.boolean(), { minLength: 1, maxLength: 8 });
const RUNS = { numRuns: 25 };

describe('canvas operations keep the Stack valid and undo restores it exactly', () => {
  it('move', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(specArb, { minLength: 1, maxLength: 6 }),
        maskArb,
        fc.integer({ min: -600, max: 600 }),
        fc.integer({ min: -600, max: 600 }),
        async (specs, mask, dx, dy) => {
          const s = await open(specs);
          expectValidAndUndoable(s, () => moveElements(s, 'c1', pickIds(idsOf(s), mask), dx, dy));
        },
      ),
      RUNS,
    );
  });

  it('resize', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(specArb, { minLength: 1, maxLength: 4 }),
        fc.constantFrom('n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw' as const),
        fc.integer({ min: -700, max: 700 }),
        fc.integer({ min: -700, max: 700 }),
        async (specs, handle, dx, dy) => {
          const s = await open(specs);
          const el = s.getStack().cards['c1']!.elements[0]!;
          expectValidAndUndoable(s, () => {
            const box = resizeBox(
              { x: el.layout.x, y: el.layout.y, width: el.layout.width, height: el.layout.height },
              handle,
              dx,
              dy,
              minSize(el.type),
            );
            return s.dispatch(
              { type: 'UPDATE_ELEMENT', cardId: 'c1', elementId: el.elementId, patch: { layout: box } },
              { coalesceKey: 'resize:test' },
            );
          });
        },
      ),
      RUNS,
    );
  });

  it('align', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(specArb, { minLength: 2, maxLength: 6 }),
        fc.constantFrom('left', 'center', 'right', 'top', 'middle', 'bottom' as const),
        async (specs, mode) => {
          const s = await open(specs);
          const sizes = s.getStack().cards['c1']!.elements.map((e) => [e.layout.width, e.layout.height]);
          expectValidAndUndoable(s, () => alignElements(s, 'c1', idsOf(s), mode));
          expect(s.getStack().cards['c1']!.elements.map((e) => [e.layout.width, e.layout.height])).toEqual(
            sizes,
          );
        },
      ),
      RUNS,
    );
  });

  it('distribute', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(specArb, { minLength: 3, maxLength: 7 }),
        fc.constantFrom('horizontal', 'vertical' as const),
        async (specs, axis) => {
          const s = await open(specs);
          expectValidAndUndoable(s, () => distributeElements(s, 'c1', idsOf(s), axis));
        },
      ),
      RUNS,
    );
  });

  it('delete', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(specArb, { minLength: 1, maxLength: 6 }), maskArb, async (specs, mask) => {
        const s = await open(specs);
        const targets = pickIds(idsOf(s), mask);
        expectValidAndUndoable(s, () => deleteElements(s, 'c1', targets));
      }),
      RUNS,
    );
  });

  it('duplicate', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(specArb, { minLength: 1, maxLength: 6 }), maskArb, async (specs, mask) => {
        const s = await open(specs);
        const targets = pickIds(idsOf(s), mask);
        const count = idsOf(s).length;
        expectValidAndUndoable(s, () => duplicateElements(s, 'c1', targets));
        duplicateElements(s, 'c1', targets);
        const ids = idsOf(s);
        expect(ids.length).toBe(count + targets.length);
        expect(new Set(ids).size).toBe(ids.length);
      }),
      RUNS,
    );
  });

  it('paste on the same card and on another card', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(specArb, { minLength: 1, maxLength: 6 }),
        maskArb,
        fc.constantFrom('c1', 'c2'),
        async (specs, mask, target) => {
          clearClipboard();
          const s = await open(specs);
          const source = s.getStack().cards['c1']!.elements;
          const wanted = new Set(pickIds(idsOf(s), mask));
          copyToClipboard(
            s.stackId,
            source.filter((e) => wanted.has(e.elementId)),
          );
          expectValidAndUndoable(s, () => pasteElements(s, target));
          const r = pasteElements(s, target);
          expect(r.ok && r.elementIds.length).toBe(wanted.size);
          const card = s.getStack().cards[target]!;
          const all = card.elements.map((e) => e.elementId);
          expect(new Set(all).size).toBe(all.length);
          // The pasted copies sit on top, in the original stacking order.
          const z = card.elements.map((e) => e.layout.zIndex).sort((a, b) => a - b);
          expect(z).toEqual(z.map((_, i) => i));
        },
      ),
      RUNS,
    );
  });
});

describe('canvas operations: failures and edge cases', () => {
  it('paste with an empty clipboard says what to do and changes nothing', async () => {
    clearClipboard();
    const s = await open([]);
    const before = s.getStack();
    expect(pasteElements(s, 'c1')).toEqual({
      ok: false,
      message: 'The clipboard is empty. Copy an element first.',
    });
    expect(s.getStack()).toBe(before);
    expect(s.getStatus().canUndo).toBe(true);
  });

  it('refuses to paste an image into another stack', async () => {
    const s = await open([]);
    const other = await open([]);
    copyToClipboard('somewhere-else', [
      {
        elementId: 'img',
        type: 'image',
        name: 'Image 1',
        properties: { ...ELEMENT_DEFAULTS.image.properties },
        layout: { x: 0, y: 0, width: 10, height: 10, zIndex: 0 },
        assetId: 'asset-1',
        behaviors: [],
      },
    ]);
    const r = pasteElements(other, 'c1');
    expect(r.ok).toBe(false);
    expect(other.getStack().cards['c1']!.elements).toHaveLength(0);
    expect(s.getStack().cards['c1']!.elements).toHaveLength(0);
  });

  it('align and distribute explain how many elements they need', async () => {
    const s = await open([{ type: 'text', x: 0, y: 0, width: 5, height: 5 }]);
    expect(alignElements(s, 'c1', ['e0'], 'left').ok).toBe(false);
    expect(distributeElements(s, 'c1', ['e0'], 'horizontal').ok).toBe(false);
  });

  it('dispatchAll applies nothing when one command is invalid', async () => {
    const s = await open([{ type: 'text', x: 0, y: 0, width: 5, height: 5 }]);
    const before = s.getStack();
    const r = dispatchAll(
      s,
      [
        { type: 'UPDATE_ELEMENT', cardId: 'c1', elementId: 'e0', patch: { layout: { x: 9 } } },
        { type: 'DELETE_ELEMENT', cardId: 'c1', elementId: 'missing' },
      ],
      'k',
    );
    expect(r.ok).toBe(false);
    expect(s.getStack()).toBe(before);
  });

  it('cloneElements gives fresh ids, drops behaviors and marks a repeated name', () => {
    const source = [
      {
        elementId: 'a',
        type: 'text' as const,
        name: 'Title',
        properties: {},
        layout: { x: 1, y: 2, width: 3, height: 4, zIndex: 5 },
        behaviors: [
          { behaviorId: 'b', trigger: 'element.click' as const, conditions: [], actions: [], enabled: true },
        ],
      },
    ];
    const [copy] = cloneElements(source, source, 16);
    expect(copy!.elementId).not.toBe('a');
    expect(copy!.behaviors).toEqual([]);
    expect(copy!.name).toBe('Title copy');
    expect(copy!.layout).toMatchObject({ x: 17, y: 18 });
    expect(source[0]!.behaviors).toHaveLength(1);
    expect(readClipboard()).toBeDefined();
  });
});
