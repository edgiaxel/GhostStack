import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  MAX_ZOOM,
  MIN_ZOOM,
  ZOOM_STEPS,
  clampZoom,
  fitZoom,
  pointUnderCursor,
  scrollDeltaToPin,
  stepZoom,
} from './zoom';

const scale = fc.double({ min: MIN_ZOOM, max: MAX_ZOOM, noNaN: true });

describe('zoom', () => {
  it('keeps the design point under the cursor fixed after any zoom', () => {
    fc.assert(
      fc.property(
        scale,
        scale,
        fc.double({ min: -500, max: 500, noNaN: true }), // view start on screen before
        fc.double({ min: 0, max: 2000, noNaN: true }), // cursor on screen
        fc.double({ min: 0, max: 1000, noNaN: true }), // scroll the content has after the zoom, before pinning
        (before, after, start, cursor, scrollAfter) => {
          const p = pointUnderCursor(cursor, start, before);
          // After the new scale renders the view start is `start2`. The model: start2 = base - scroll.
          const start2 = 40 - scrollAfter;
          const delta = scrollDeltaToPin(cursor, start2, p, after);
          const pinnedStart = start2 - delta; // scrolling by delta moves the view start by -delta
          expect(pointUnderCursor(cursor, pinnedStart, after)).toBeCloseTo(p, 6);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('always yields a scale inside the allowed range', () => {
    fc.assert(
      fc.property(fc.double({ noNaN: false }), fc.constantFrom<1 | -1>(1, -1), (s, dir) => {
        const c = clampZoom(s);
        expect(c).toBeGreaterThanOrEqual(MIN_ZOOM);
        expect(c).toBeLessThanOrEqual(MAX_ZOOM);
        const n = stepZoom(s, dir);
        expect(n).toBeGreaterThanOrEqual(MIN_ZOOM);
        expect(n).toBeLessThanOrEqual(MAX_ZOOM);
      }),
      { numRuns: 200 },
    );
  });

  it('stepping up then down returns to a preset step', () => {
    for (const z of ZOOM_STEPS.slice(0, -1)) expect(stepZoom(stepZoom(z, 1), -1)).toBe(z);
  });

  it('fit never exceeds 100% and leaves the whole view visible', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 3000 }),
        fc.integer({ min: 100, max: 3000 }),
        fc.integer({ min: 120, max: 3000 }),
        fc.integer({ min: 120, max: 3000 }),
        (aw, ah, vw, vh) => {
          const f = fitZoom(aw, ah, vw, vh);
          expect(f).toBeLessThanOrEqual(1);
          if (f > MIN_ZOOM) {
            expect(vw * f).toBeLessThanOrEqual(aw + 1e-6);
            expect(vh * f).toBeLessThanOrEqual(ah + 1e-6);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('ignores an unmeasured area side', () => {
    expect(fitZoom(0, 0, 1280, 720)).toBe(1);
    expect(fitZoom(640, 0, 1280, 720)).toBe(0.5);
  });
});
