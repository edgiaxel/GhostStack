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
] as const;

for (const theme of ['spectral', 'paper', 'midnight']) {
  test(`theme ${theme}: text pairs meet WCAG AA 4.5:1 and the focus color 3:1`, async ({ page }) => {
    await page.goto('/#/library');
    const vars = await page.evaluate((name) => {
      document.documentElement.dataset['theme'] = name;
      const css = getComputedStyle(document.documentElement);
      return Object.fromEntries(
        ['bg', 'panel', 'text', 'text-dim', 'accent', 'accent-2', 'on-accent', 'danger'].map((k) => [
          k,
          css.getPropertyValue(`--gs-${k}`).trim(),
        ]),
      );
    }, theme);
    for (const [label, fg, bg] of PAIRS) {
      expect.soft(contrast(vars[fg]!, vars[bg]!), `${theme}: ${label}`).toBeGreaterThanOrEqual(4.5);
    }
    expect
      .soft(contrast(vars['accent-2']!, vars['bg']!), `${theme}: focus color on page`)
      .toBeGreaterThanOrEqual(3);
  });
}
