import { expect, test } from '@playwright/test';

/** WCAG 2.x relative luminance and contrast ratio. */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const lin = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!;
}
const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

const PAIRS = [
  ['text on panel', 'text', 'panel'],
  ['text on page', 'text', 'bg'],
  ['dim text on panel', 'text-dim', 'panel'],
  ['dim text on page', 'text-dim', 'bg'],
  ['button text on accent', 'on-accent', 'accent'],
  ['danger text on panel', 'danger', 'panel'],
  ['success text on panel', 'success', 'panel'],
  ['warning text on panel', 'warning', 'panel'],
  ['info text on panel', 'info', 'panel'],
] as const;
const UI_PAIRS = [
  ['control border on page', 'border-strong', 'bg'],
  ['control border on panel', 'border-strong', 'panel'],
  ['focus color on page', 'accent-2', 'bg'],
  ['accent on page', 'accent', 'bg'],
] as const;

const ACCENTS = ['default', 'violet', 'ember', 'azure', 'jade', 'rose'];
const VARS = [
  'bg',
  'panel',
  'text',
  'text-dim',
  'accent',
  'accent-2',
  'on-accent',
  'danger',
  'success',
  'warning',
  'info',
  'border-strong',
];
for (const theme of ['spectral', 'paper', 'midnight']) {
  for (const accent of ACCENTS) {
    test(`theme ${theme} + accent ${accent}: text pairs meet 4.5:1, borders, focus and accent 3:1`, async ({
      page,
    }) => {
      await page.goto('/#/library');
      const vars = await page.evaluate(
        ([name, acc, names]) => {
          const root = document.documentElement;
          root.dataset['theme'] = name;
          if (acc === 'default') delete root.dataset['accent'];
          else root.dataset['accent'] = acc;
          const css = getComputedStyle(root);
          return Object.fromEntries(
            (names as string[]).map((k) => [k, css.getPropertyValue(`--gs-${k}`).trim()]),
          );
        },
        [theme, accent, VARS] as const,
      );
      for (const [label, fg, bg] of PAIRS) {
        expect
          .soft(contrast(vars[fg]!, vars[bg]!), `${theme}/${accent}: ${label}`)
          .toBeGreaterThanOrEqual(4.5);
      }
      for (const [label, fg, bg] of UI_PAIRS) {
        expect.soft(contrast(vars[fg]!, vars[bg]!), `${theme}/${accent}: ${label}`).toBeGreaterThanOrEqual(3);
      }
    });
  }
}
