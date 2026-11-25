import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { ANCHORS, SCALE_MODES, resolveLayout } from './layout';
import type { Layout } from './project';

const design = { width: 1280, height: 720 };
const box = (over: Partial<Layout> = {}): Layout => ({
  x: 100,
  y: 50,
  width: 200,
  height: 100,
  zIndex: 0,
  ...over,
});

describe('resolveLayout', () => {
  it('is the identity when the viewport equals the design size', () => {
    fc.assert(
      fc.property(fc.constantFrom(...ANCHORS), fc.constantFrom(...SCALE_MODES), (anchor, scaleMode) => {
        const r = resolveLayout(box({ anchor, scaleMode }), design, design);
        expect(r.x).toBeCloseTo(100);
        expect(r.y).toBeCloseTo(50);
        expect(r.width).toBeCloseTo(200);
        expect(r.height).toBeCloseTo(100);
      }),
    );
  });

  it('defaults to a fixed top-left element', () => {
    expect(resolveLayout(box(), design, { width: 390, height: 844 })).toEqual({
      x: 100,
      y: 50,
      width: 200,
      height: 100,
    });
  });

  it('keeps the distance to the right and bottom edges for end anchors', () => {
    const r = resolveLayout(box({ anchor: 'bottom-right' }), design, { width: 390, height: 844 });
    expect(390 - (r.x + r.width)).toBeCloseTo(1280 - (100 + 200));
    expect(844 - (r.y + r.height)).toBeCloseTo(720 - (50 + 100));
  });

  it('keeps the center offset for center anchors', () => {
    const r = resolveLayout(box({ x: 540, y: 310, anchor: 'center' }), design, { width: 390, height: 844 });
    expect(r.x + r.width / 2).toBeCloseTo(390 / 2 + (640 - 640));
    expect(r.y + r.height / 2).toBeCloseTo(844 / 2);
  });

  it('scales uniformly in scale mode and independently in stretch mode', () => {
    const view = { width: 640, height: 720 };
    const scaled = resolveLayout(box({ scaleMode: 'scale' }), design, view);
    expect(scaled).toEqual({ x: 50, y: 25, width: 100, height: 50 });
    const stretched = resolveLayout(box({ scaleMode: 'stretch' }), design, view);
    expect(stretched).toEqual({ x: 50, y: 50, width: 100, height: 100 });
  });
});
