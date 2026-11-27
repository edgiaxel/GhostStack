// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { generateBrand } from '../../../../scripts/brand/generate.mjs';

const committed = import.meta.glob('../../public/brand/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;
const onDisk = Object.fromEntries(
  Object.entries(committed).map(([path, text]) => [path.replace(/^.*\//, ''), text]),
);

describe('brand generator', () => {
  it('is deterministic: two runs are byte-identical', () => {
    const a = generateBrand();
    const b = generateBrand();
    expect(Object.keys(a)).toEqual(Object.keys(b));
    for (const name of Object.keys(a))
      expect(new TextEncoder().encode(a[name])).toEqual(new TextEncoder().encode(b[name]));
  });

  it('produces the mark, favicon, mono mark, both horizontal lockups and the stacked lockup', () => {
    const files = generateBrand();
    for (const name of [
      'mark.svg',
      'favicon.svg',
      'mark-mono.svg',
      'wordmark.svg',
      'wordmark-light.svg',
      'lockup-stacked.svg',
    ])
      expect(files[name], name).toMatch(/^<svg [^>]*role="img" aria-label="GhostStack/);
    expect(files['mark-mono.svg']).toContain('currentColor');
  });

  it('matches the committed files in public/brand (run node scripts/brand/generate.mjs after edits)', () => {
    expect(onDisk).toEqual(generateBrand());
  });
});
