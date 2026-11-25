import { createRuntime } from '@ghoststack/behavior';
import type { PlayerHandle } from './index';

/**
 * SKELETON entry of the standalone bundle (`apps/web/public/player.standalone.js`, global
 * `GhostStackPlayer`). The `preview-export` worktree implements `boot`: it reads the embedded
 * Stack JSON, resolves assets relative to the page, and calls `mountPlayer` with `createRuntime`.
 * The bundle must not import React, storage or any editor code.
 */
export function boot(): PlayerHandle {
  void createRuntime;
  throw new Error('GhostStackPlayer.boot is not implemented yet');
}
