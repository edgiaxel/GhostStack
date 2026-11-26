// @vitest-environment node
import markSvg from '../../public/brand/mark.svg?raw';
import faviconSvg from '../../public/brand/favicon.svg?raw';
import wordmarkSvg from '../../public/brand/wordmark.svg?raw';
import { describe, expect, it } from 'vitest';
import { generateBrand } from '../../../../scripts/brand/generate.mjs';

describe('brand generator', () => {
  it('is deterministic: two runs are byte-identical', () => {
    const a = generateBrand();
    const b = generateBrand();
    expect(Object.keys(a)).toEqual(Object.keys(b));
    for (const name of Object.keys(a))
      expect(new TextEncoder().encode(a[name])).toEqual(new TextEncoder().encode(b[name]));
  });
  it('produces the mark, the wordmark and the favicon as SVG', () => {
    const files = generateBrand();
    for (const name of ['mark.svg', 'wordmark.svg', 'favicon.svg']) expect(files[name]).toMatch(/^<svg /);
  });
  it('matches the committed files in public/brand (run node scripts/brand/generate.mjs after edits)', () => {
    const files = generateBrand();
    expect(markSvg).toBe(files['mark.svg']);
    expect(faviconSvg).toBe(files['favicon.svg']);
    expect(wordmarkSvg).toBe(files['wordmark.svg']);
  });
});
