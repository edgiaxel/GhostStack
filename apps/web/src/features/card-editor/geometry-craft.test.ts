import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  SNAP_THRESHOLD,
  alignBoxes,
  boundsOf,
  boxFromPoints,
  distributeBoxes,
  marqueeHits,
  snapMove,
} from './geometry';
import type { Box, IdBox } from './geometry';

const boxArb = fc.record({
  x: fc.integer({ min: -200, max: 1200 }),
  y: fc.integer({ min: -200, max: 700 }),
  width: fc.integer({ min: 1, max: 400 }),
  height: fc.integer({ min: 1, max: 300 }),
});
const itemsArb = (min: number): fc.Arbitrary<IdBox[]> =>
  fc
    .array(boxArb, { minLength: min, maxLength: 8 })
    .map((boxes) => boxes.map((box, i) => ({ id: `e${i}`, box })));
const frame = { width: 1280, height: 720 };

describe('boundsOf', () => {
  it('contains every box and is tight on all four sides', () => {
    fc.assert(
      fc.property(itemsArb(1), (items) => {
        const b = boundsOf(items.map((i) => i.box));
        for (const { box } of items) {
          expect(box.x).toBeGreaterThanOrEqual(b.x);
          expect(box.y).toBeGreaterThanOrEqual(b.y);
          expect(box.x + box.width).toBeLessThanOrEqual(b.x + b.width);
          expect(box.y + box.height).toBeLessThanOrEqual(b.y + b.height);
        }
        expect(items.some(({ box }) => box.x === b.x)).toBe(true);
        expect(items.some(({ box }) => box.y + box.height === b.y + b.height)).toBe(true);
      }),
      { numRuns: 150 },
    );
  });
});

describe('alignBoxes', () => {
  it('puts every box on the chosen line and leaves the other axis alone', () => {
    fc.assert(
      fc.property(itemsArb(2), (items) => {
        const b = boundsOf(items.map((i) => i.box));
        const left = alignBoxes(items, 'left');
        const right = alignBoxes(items, 'right');
        const middle = alignBoxes(items, 'middle');
        for (const { id, box } of items) {
          expect(left[id]).toEqual({ x: b.x });
          expect(right[id]!.x! + box.width).toBeCloseTo(b.x + b.width, 1);
          expect(middle[id]!.y! + box.height / 2).toBeCloseTo(b.y + b.height / 2, 0);
          expect(left[id]!.y).toBeUndefined();
        }
      }),
      { numRuns: 150 },
    );
  });
});

describe('distributeBoxes', () => {
  it('keeps the outer boxes fixed and makes the gaps equal', () => {
    fc.assert(
      fc.property(itemsArb(3), (items) => {
        const pos = distributeBoxes(items, 'horizontal');
        const sorted = [...items].sort((a, b) => a.box.x - b.box.x);
        const placed = sorted.map((i) => ({ ...i.box, x: pos[i.id]!.x! }));
        expect(placed[0]!.x).toBeCloseTo(sorted[0]!.box.x, 1);
        const last = placed[placed.length - 1]!;
        expect(last.x).toBeCloseTo(sorted[sorted.length - 1]!.box.x, 0);
        const gaps = placed.slice(1).map((p, i) => p.x - (placed[i]!.x + placed[i]!.width));
        for (const g of gaps) expect(g).toBeCloseTo(gaps[0]!, 0);
      }),
      { numRuns: 150 },
    );
  });
  it('does nothing for fewer than three boxes', () => {
    expect(distributeBoxes([{ id: 'a', box: { x: 0, y: 0, width: 1, height: 1 } }], 'vertical')).toEqual({});
  });
});

describe('snapMove', () => {
  it('never shifts by more than the threshold and lands on a line when it shifts', () => {
    fc.assert(
      fc.property(boxArb, fc.array(boxArb, { maxLength: 5 }), (box, others) => {
        const s = snapMove(box, others, frame);
        expect(Math.abs(s.dx)).toBeLessThanOrEqual(SNAP_THRESHOLD);
        expect(Math.abs(s.dy)).toBeLessThanOrEqual(SNAP_THRESHOLD);
        if (s.dx !== 0) expect(s.guides.some((g) => g.orientation === 'v')).toBe(true);
        if (s.dy !== 0) expect(s.guides.some((g) => g.orientation === 'h')).toBe(true);
      }),
      { numRuns: 200 },
    );
  });
  it('snaps a box near the frame edge to it and draws the guide', () => {
    const s = snapMove({ x: 4, y: 100, width: 50, height: 50 }, [], frame);
    expect(s.dx).toBe(-4);
    expect(s.guides).toContainEqual({ orientation: 'v', at: 0, from: 0, to: 720 });
  });
  it('snaps centers to another element and ignores far boxes', () => {
    const other: Box = { x: 500, y: 300, width: 100, height: 100 };
    expect(snapMove({ x: 523, y: 10, width: 50, height: 20 }, [other], frame).dx).toBe(2);
    expect(snapMove({ x: 700, y: 10, width: 50, height: 20 }, [other], frame).dx).toBe(0);
  });
  it('shifts less when the threshold is smaller', () => {
    expect(snapMove({ x: 4, y: 100, width: 50, height: 50 }, [], frame, 2).dx).toBe(0);
  });
});

describe('marqueeHits', () => {
  it('returns exactly the boxes that overlap the rectangle', () => {
    fc.assert(
      fc.property(itemsArb(0), boxArb, (items, m) => {
        const hits = new Set(marqueeHits(m, items));
        for (const { id, box } of items) {
          const overlap =
            box.x <= m.x + m.width &&
            box.x + box.width >= m.x &&
            box.y <= m.y + m.height &&
            box.y + box.height >= m.y;
          expect(hits.has(id)).toBe(overlap);
        }
      }),
      { numRuns: 150 },
    );
  });
  it('boxFromPoints works in every drag direction', () => {
    expect(boxFromPoints(10, 20, 4, 8)).toEqual({ x: 4, y: 8, width: 6, height: 12 });
  });
});
