import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { arrowDelta, cascadePosition, fitScale, minSize, moveBox, resizeBox } from './geometry';

const box = { x: 100, y: 100, width: 200, height: 100 };

describe('geometry', () => {
  it('fits the view into the area without enlarging', () => {
    expect(fitScale(640, 1280)).toBe(0.5);
    expect(fitScale(2000, 1280)).toBe(1);
    expect(fitScale(0, 1280)).toBe(1);
  });

  it('moves a box', () => {
    expect(moveBox(box, 5.26, -3)).toEqual({ x: 105.3, y: 97 });
  });

  it('resizes from each handle keeping the opposite edge fixed', () => {
    const min = minSize('shape');
    expect(resizeBox(box, 'se', 10, 20, min)).toEqual({ x: 100, y: 100, width: 210, height: 120 });
    expect(resizeBox(box, 'nw', 10, 20, min)).toEqual({ x: 110, y: 120, width: 190, height: 80 });
    expect(resizeBox(box, 'e', -500, 0, min)).toMatchObject({ width: 1, x: 100 });
    expect(resizeBox(box, 'w', 500, 0, min)).toMatchObject({ width: 1, x: 299 });
    expect(resizeBox(box, 'n', 0, 500, minSize('line'))).toMatchObject({ height: 0, y: 200 });
  });

  it('keeps the opposite edge fixed and size at least the minimum for any drag', () => {
    const handles = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as const;
    fc.assert(
      fc.property(
        fc.constantFrom(...handles),
        fc.integer({ min: -2000, max: 2000 }),
        fc.integer({ min: -2000, max: 2000 }),
        (h, dx, dy) => {
          const r = resizeBox(box, h, dx, dy, minSize('shape'));
          expect(r.width).toBeGreaterThanOrEqual(1);
          expect(r.height).toBeGreaterThanOrEqual(1);
          if (h.includes('e')) expect(r.x).toBe(box.x);
          if (h.includes('w')) expect(r.x + r.width).toBeCloseTo(box.x + box.width, 0);
          if (h.includes('s')) expect(r.y).toBe(box.y);
          if (h.includes('n')) expect(r.y + r.height).toBeCloseTo(box.y + box.height, 0);
        },
      ),
    );
  });

  it('maps arrow keys', () => {
    expect(arrowDelta('ArrowLeft', false)).toEqual({ dx: -1, dy: 0 });
    expect(arrowDelta('ArrowDown', true)).toEqual({ dx: 0, dy: 10 });
    expect(arrowDelta('a', false)).toBeUndefined();
  });

  it('cascades new element positions and wraps', () => {
    expect(cascadePosition(0)).toEqual({ x: 40, y: 40 });
    expect(cascadePosition(2)).toEqual({ x: 88, y: 88 });
    expect(cascadePosition(10)).toEqual({ x: 40, y: 40 });
  });
});
