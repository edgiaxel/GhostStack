// Generates the GhostStack brand files. Deterministic: same bytes on every run.
// Usage: node scripts/brand/generate.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const INK = '#191724';
const GHOST = '#a78bfa';
const BODY =
  'M6 27V14C6 8.48 10.48 4 16 4s10 4.48 10 10v13l-3.33-2.67L19.33 27 16 24.33 12.67 27l-3.34-2.67z';

const mark = (size) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" role="img" aria-label="GhostStack mark">` +
  `<rect width="32" height="32" rx="8" fill="${INK}"/>` +
  `<path d="${BODY}" fill="${GHOST}" transform="translate(0 .5)"/>` +
  `<circle cx="12.5" cy="14" r="1.8" fill="${INK}"/><circle cx="19.5" cy="14" r="1.8" fill="${INK}"/>` +
  `</svg>\n`;

const wordmark =
  `<svg xmlns="http://www.w3.org/2000/svg" width="168" height="32" viewBox="0 0 168 32" role="img" aria-label="GhostStack">` +
  `<rect width="32" height="32" rx="8" fill="${INK}"/>` +
  `<path d="${BODY}" fill="${GHOST}" transform="translate(0 .5)"/>` +
  `<circle cx="12.5" cy="14" r="1.8" fill="${INK}"/><circle cx="19.5" cy="14" r="1.8" fill="${INK}"/>` +
  `<text x="42" y="22" font-family="Inter, system-ui, sans-serif" font-size="19" font-weight="700" fill="${GHOST}">GhostStack</text>` +
  `</svg>\n`;

/** Pure: returns file name to file content. */
export function generateBrand() {
  return { 'mark.svg': mark(32), 'favicon.svg': mark(64), 'wordmark.svg': wordmark };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = new URL('../../apps/web/public/brand/', import.meta.url);
  mkdirSync(out, { recursive: true });
  for (const [name, text] of Object.entries(generateBrand())) writeFileSync(new URL(name, out), text);
  console.log('brand files written to apps/web/public/brand/');
}
