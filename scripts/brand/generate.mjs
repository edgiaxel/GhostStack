// Generates the GhostStack brand files. Deterministic: same bytes on every run.
// Usage: node scripts/brand/generate.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Spectral Workstation ink and the violet ghost (DESIGN section 9). The ghost is the one motif.
const INK = '#191724';
const GHOST = '#a78bfa';
const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif";
const BODY =
  'M6 27V14C6 8.48 10.48 4 16 4s10 4.48 10 10v13l-3.33-2.67L19.33 27 16 24.33 12.67 27l-3.34-2.67z';
const EYES = (fill) =>
  `<circle cx="12.5" cy="14" r="1.8" fill="${fill}"/><circle cx="19.5" cy="14" r="1.8" fill="${fill}"/>`;

/** The mark on its ink tile, drawn in a 32 by 32 box at (x, y). */
const tile = (x = 0, y = 0) =>
  `<g transform="translate(${x} ${y})">` +
  `<rect width="32" height="32" rx="8" fill="${INK}"/>` +
  `<path d="${BODY}" fill="${GHOST}" transform="translate(0 .5)"/>` +
  EYES(INK) +
  `</g>`;

const svg = (w, h, label, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}">${body}</svg>\n`;

const mark = (size) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" role="img" aria-label="GhostStack mark">${tile()}</svg>\n`;

const name = (x, y, fill, anchor = 'start') =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-size="19" font-weight="700" fill="${fill}"${anchor === 'start' ? '' : ` text-anchor="${anchor}"`}>GhostStack</text>`;

/** Single color, no tile: the eyes are cut out, so it works on any background with `color`. */
const mono =
  `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" role="img" aria-label="GhostStack mark">` +
  `<mask id="gs-eyes"><rect width="32" height="32" fill="#fff"/>${EYES('#000')}</mask>` +
  `<path d="${BODY}" fill="currentColor" mask="url(#gs-eyes)" transform="translate(0 .5)"/>` +
  `</svg>\n`;

/** Pure: returns file name to file content. */
export function generateBrand() {
  return {
    'mark.svg': mark(32),
    'favicon.svg': mark(64),
    'mark-mono.svg': mono,
    // Horizontal lockup for dark surfaces (the shell) and for light surfaces (documents, README).
    'wordmark.svg': svg(168, 32, 'GhostStack', tile() + name(42, 22, GHOST)),
    'wordmark-light.svg': svg(168, 32, 'GhostStack', tile() + name(42, 22, INK)),
    // Stacked lockup for square slots (submission thumbnail, social card).
    'lockup-stacked.svg': svg(
      128,
      116,
      'GhostStack',
      `<g transform="translate(32 4) scale(2)">${tile()}</g>` + name(64, 104, INK, 'middle'),
    ),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = new URL('../../apps/web/public/brand/', import.meta.url);
  mkdirSync(out, { recursive: true });
  for (const [file, text] of Object.entries(generateBrand())) writeFileSync(new URL(file, out), text);
  console.log('brand files written to apps/web/public/brand/');
}
