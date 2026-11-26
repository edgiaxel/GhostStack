// @vitest-environment node
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { contrastRatio } from './contrast';
import { ACCENTS, THEMES } from '../app/theme';

// Vitest strips imported CSS, so read the real file. The specifier is built at runtime because the web tsconfig has no Node types.
const nodeFs = 'node:' + 'fs';
const { readFileSync } = (await import(/* @vite-ignore */ nodeFs)) as {
  readFileSync: (path: URL, encoding: 'utf8') => string;
};
const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

interface Rule {
  attrs: Record<string, string>;
  vars: Record<string, string>;
  order: number;
}
const rules: Rule[] = [];
for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const vars = Object.fromEntries(
    [...m[2]!.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((v) => [v[1]!, v[2]!.trim()]),
  );
  for (const sel of m[1]!.split(',').map((s: string) => s.trim())) {
    const attrs: Record<string, string> = {};
    for (const a of sel.matchAll(/\[data-(\w+)='([^']+)'\]/g)) attrs[a[1]!] = a[2]!;
    rules.push({ attrs, vars, order: rules.length });
  }
}
/** Cascade for one pair: :root and non-matching rules are skipped, more specific wins, later wins ties. */
function resolve(theme: string, accent: string): Record<string, string> {
  const state: Record<string, string> = { theme, accent };
  const hit = rules.filter((r) => Object.entries(r.attrs).every(([k, v]) => state[k] === v));
  hit.sort((a, b) => Object.keys(a.attrs).length - Object.keys(b.attrs).length || a.order - b.order);
  return Object.assign({}, ...hit.map((r) => r.vars)) as Record<string, string>;
}
const ACCENT_IDS = ['default', ...ACCENTS];

describe('contrast helper', () => {
  it('is symmetric and at least 1', () => {
    const hex = fc.integer({ min: 0, max: 0xffffff }).map((n) => `#${n.toString(16).padStart(6, '0')}`);
    fc.assert(
      fc.property(hex, hex, (a, b) => {
        expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 10);
        expect(contrastRatio(a, b)).toBeGreaterThanOrEqual(1);
      }),
      { numRuns: 200 },
    );
  });
  it('matches the known black on white ratio of 21', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });
});

describe('every theme and accent pair keeps AA contrast', () => {
  it('has at least 5 accent presets', () => expect(ACCENTS.length).toBeGreaterThanOrEqual(5));
  for (const theme of THEMES) {
    for (const accent of ACCENT_IDS) {
      it(`${theme} + ${accent}`, () => {
        const v = resolve(theme, accent === 'default' ? '' : accent);
        const c = (a: string, b: string): number => contrastRatio(v[`--gs-${a}`]!, v[`--gs-${b}`]!);
        const label = `${theme}/${accent}`;
        for (const surface of ['bg', 'panel', 'panel-2']) {
          for (const fg of ['text', 'text-dim', 'danger', 'success', 'warning', 'info']) {
            expect(c(fg, surface), `${label}: ${fg} on ${surface}`).toBeGreaterThanOrEqual(4.5);
          }
          expect(c('border-strong', surface), `${label}: border on ${surface}`).toBeGreaterThanOrEqual(3);
        }
        for (const surface of ['bg', 'panel']) {
          expect(c('accent-2', surface), `${label}: focus on ${surface}`).toBeGreaterThanOrEqual(3);
          expect(c('accent', surface), `${label}: accent on ${surface}`).toBeGreaterThanOrEqual(3);
        }
        expect(c('on-accent', 'accent'), `${label}: on-accent`).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
  it('keeps the Midnight primary accent at #7C3AED by default', () => {
    expect(resolve('midnight', '')['--gs-accent']).toBe('#7c3aed');
  });
});
