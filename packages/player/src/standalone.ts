import { createRuntime } from '@ghoststack/behavior';
import type { Stack } from '@ghoststack/shared-contracts';
import { mountPlayer } from './index';
import type { PlayerHandle } from './index';

/** `/` is kept, every other character in a path segment is percent-encoded. */
export const assetUrl = (relativePath: string): string =>
  `assets/${relativePath.split('/').map(encodeURIComponent).join('/')}`;

/**
 * Entry of the standalone bundle (`player.js` in a web export, global `GhostStackPlayer`). Reads the
 * Stack embedded in the page and runs it. Imports no React, storage or editor code.
 */
export function boot(doc: Document = document): PlayerHandle {
  const data = doc.getElementById('gs-stack');
  const container = doc.getElementById('app');
  if (!data || !container) throw new Error('This page is missing the embedded application data.');
  const stack = JSON.parse(data.textContent ?? '') as Stack;
  return mountPlayer({
    container,
    stack,
    createRuntime,
    resolveAssetUrl: (id) => {
      const asset = stack.assetRegistry[id];
      return asset ? assetUrl(asset.relativePath) : undefined;
    },
    onError: (message) => console.error(`[GhostStack] ${message}`),
  });
}

if (typeof document !== 'undefined' && document.getElementById('gs-stack')) boot();
