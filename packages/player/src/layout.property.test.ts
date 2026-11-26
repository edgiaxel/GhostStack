import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { ANCHORS, resolveFontScale, resolveLayout } from '@ghoststack/shared-contracts';
import type { Layout } from '@ghoststack/shared-contracts';

/** Properties of the shared placement math that editor, preview and export all rely on (M2.6). */
const design = { width: 1280, height: 720 };
const anchor = fc.constantFrom(...ANCHORS);
// Authored rects lie inside the design frame, the only inputs the editor can produce.
const inside = fc
  .record({
    x: fc.integer({ min: 0, max: 1000 }),
    y: fc.integer({ min: 0, max: 500 }),
    width: fc.integer({ min: 1, max: 280 }),
    height: fc.integer({ min: 1, max: 220 }),
  })
  .map((r): Omit<Layout, 'anchor' | 'scaleMode'> => ({ ...r, zIndex: 0 }));
const view = fc.record({
  width: fc.integer({ min: 120, max: 4000 }),
  height: fc.integer({ min: 120, max: 4000 }),
});
const runs = { numRuns: 200 };
const scaleOf = (v: { width: number; height: number }): number =>
  Math.min(v.width / design.width, v.height / design.height);

describe('resolveLayout properties', () => {
  it('is the identity at the design size for every anchor and mode', () => {
    fc.assert(
      fc.property(inside, anchor, fc.constantFrom('fixed', 'scale', 'stretch'), (l, a, m) => {
        const r = resolveLayout({ ...l, anchor: a, scaleMode: m }, design, design);
        expect([r.x, r.y, r.width, r.height].map(Math.round)).toEqual([l.x, l.y, l.width, l.height]);
      }),
      runs,
    );
  });
  it('keeps proportions in scale mode at any viewport', () => {
    fc.assert(
      fc.property(inside, anchor, view, (l, a, v) => {
        const r = resolveLayout({ ...l, anchor: a, scaleMode: 'scale' }, design, v);
        expect(r.width / r.height).toBeCloseTo(l.width / l.height, 6);
        expect(resolveFontScale({ ...l, scaleMode: 'scale' }, r)).toBeCloseTo(scaleOf(v), 9);
      }),
      runs,
    );
  });
  it('keeps the scaled distance to the anchored edges', () => {
    fc.assert(
      fc.property(inside, anchor, view, (l, a, v) => {
        const s = scaleOf(v);
        const r = resolveLayout({ ...l, anchor: a, scaleMode: 'scale' }, design, v);
        if (a.endsWith('right'))
          expect(v.width - (r.x + r.width)).toBeCloseTo((design.width - l.x - l.width) * s, 6);
        if (a.endsWith('left')) expect(r.x).toBeCloseTo(l.x * s, 6);
        if (a.startsWith('bottom'))
          expect(v.height - (r.y + r.height)).toBeCloseTo((design.height - l.y - l.height) * s, 6);
        if (a.startsWith('top')) expect(r.y).toBeCloseTo(l.y * s, 6);
        if (a === 'center') {
          expect(r.x + r.width / 2 - v.width / 2).toBeCloseTo((l.x + l.width / 2 - design.width / 2) * s, 6);
          expect(r.y + r.height / 2 - v.height / 2).toBeCloseTo(
            (l.y + l.height / 2 - design.height / 2) * s,
            6,
          );
        }
      }),
      runs,
    );
  });
  it('keeps fixed elements at their authored size and edge distance', () => {
    fc.assert(
      fc.property(inside, view, (l, v) => {
        const r = resolveLayout({ ...l, anchor: 'bottom-right', scaleMode: 'fixed' }, design, v);
        expect([r.width, r.height]).toEqual([l.width, l.height]);
        expect(v.width - (r.x + r.width)).toBeCloseTo(design.width - l.x - l.width, 6);
      }),
      runs,
    );
  });
  it('never shrinks a scaled element when the viewport grows on both axes', () => {
    fc.assert(
      fc.property(inside, anchor, view, fc.nat(500), fc.nat(500), (l, a, v, dw, dh) => {
        const bigger = { width: v.width + dw, height: v.height + dh };
        const lay: Layout = { ...l, anchor: a, scaleMode: 'scale' };
        const small = resolveLayout(lay, design, v);
        const large = resolveLayout(lay, design, bigger);
        expect(large.width).toBeGreaterThanOrEqual(small.width - 1e-9);
        expect(large.height).toBeGreaterThanOrEqual(small.height - 1e-9);
      }),
      runs,
    );
  });
  it('keeps a scaled element inside the view when it starts inside the design frame', () => {
    fc.assert(
      fc.property(inside, anchor, view, (l, a, v) => {
        const r = resolveLayout({ ...l, anchor: a, scaleMode: 'scale' }, design, v);
        expect(r.x).toBeGreaterThanOrEqual(-1e-6);
        expect(r.y).toBeGreaterThanOrEqual(-1e-6);
        expect(r.x + r.width).toBeLessThanOrEqual(v.width + 1e-6);
        expect(r.y + r.height).toBeLessThanOrEqual(v.height + 1e-6);
      }),
      runs,
    );
  });
});
