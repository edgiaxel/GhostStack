// @vitest-environment jsdom
import fc from 'fast-check';
import { beforeEach, describe, expect, it } from 'vitest';
import { PANEL_LIMITS, loadPref, parsePref, savePref } from './layoutPrefs';
import type { PanelId } from './layoutPrefs';

const ids = Object.keys(PANEL_LIMITS) as PanelId[];
const inside = (id: PanelId, size: number): boolean =>
  size >= PANEL_LIMITS[id].min && size <= PANEL_LIMITS[id].max;

describe('layout preferences', () => {
  it('yields a size inside the limits for any stored text', () => {
    fc.assert(
      fc.property(fc.constantFrom(...ids), fc.string(), (id, raw) => {
        expect(inside(id, parsePref(id, raw).size)).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it('yields a size inside the limits for any stored number', () => {
    fc.assert(
      fc.property(fc.constantFrom(...ids), fc.double(), fc.boolean(), (id, size, collapsed) => {
        const p = parsePref(id, JSON.stringify({ size, collapsed }));
        expect(inside(id, p.size)).toBe(true);
        expect(p.collapsed).toBe(collapsed);
      }),
      { numRuns: 200 },
    );
  });

  describe('storage', () => {
    beforeEach(() => localStorage.clear());

    it('round-trips a saved preference under gs.layout.*', () => {
      savePref('inspector', { size: 400, collapsed: true });
      expect(localStorage.getItem('gs.layout.inspector')).toBe('{"size":400,"collapsed":true}');
      expect(loadPref('inspector')).toEqual({ size: 400, collapsed: true });
    });

    it('falls back to defaults on corrupt data', () => {
      localStorage.setItem('gs.layout.navigator', '{not json');
      expect(loadPref('navigator')).toEqual({ size: PANEL_LIMITS.navigator.initial, collapsed: false });
    });
  });
});
