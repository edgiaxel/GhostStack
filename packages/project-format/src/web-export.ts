import { strToU8, zipSync } from 'fflate';
import type { Zippable } from 'fflate';
import { err, ok } from '@ghoststack/shared-contracts';
import type { GhostError, Result, Stack } from '@ghoststack/shared-contracts';
import { validateStack } from '@ghoststack/domain';
import { checkEntryName } from './gsp';

export interface WebExport {
  /** ZIP with `index.html`, `player.js` and `assets/`. */
  bytes: Uint8Array;
  /** `relativePath` of registered assets whose bytes were not available. The page shows a fallback for them. */
  missingAssets: string[];
}

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** JSON that is safe inside `<script type="application/json">`: no `<`, and no JS line separators. */
export const jsonForScript = (value: unknown): string =>
  JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

export function renderIndexHtml(stack: Stack): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(stack.title || 'GhostStack app')}</title>
<style>html,body{margin:0;height:100%;background:#e5e7eb}#app{width:100vw;height:100vh}</style>
</head>
<body>
<div id="app"></div>
<script type="application/json" id="gs-stack">${jsonForScript(stack)}</script>
<script src="player.js"></script>
</body>
</html>
`;
}

const fail = (message: string): Result<never, GhostError> => err({ code: 'PROJECT_EXPORT_FAILED', message });

/**
 * Builds a standalone web application: static files that run from `file://` or any static host,
 * with no editor, storage or network access. `playerJs` is the contents of the standalone player bundle.
 */
export function exportWebApp(
  stack: Stack,
  assets: Record<string, Uint8Array>,
  playerJs: string,
): Result<WebExport, GhostError> {
  const valid = validateStack(stack);
  if (!valid.ok) return fail(`Stack is inconsistent: ${valid.error.message}`);
  if (playerJs.trim().length === 0) return fail('The player bundle is empty');
  const files: Zippable = {
    'index.html': strToU8(renderIndexHtml(valid.value)),
    'player.js': strToU8(playerJs),
  };
  const missingAssets: string[] = [];
  try {
    for (const asset of Object.values(valid.value.assetRegistry)) {
      const name = `assets/${asset.relativePath}`;
      checkEntryName(name, 'PROJECT_EXPORT_FAILED');
      const bytes = assets[asset.assetId];
      if (bytes) files[name] = [bytes, { level: 0 }];
      else missingAssets.push(asset.relativePath);
    }
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
  return ok({ bytes: zipSync(files, { mtime: new Date(Date.UTC(1980, 0, 1)) }), missingAssets });
}
