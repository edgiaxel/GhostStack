import type { CreateRuntime, Stack } from '@ghoststack/shared-contracts';

export interface PlayerOptions {
  container: HTMLElement;
  stack: Stack;
  /** Returns a URL for the asset bytes, or undefined when the asset is missing (renders the fallback). */
  resolveAssetUrl(assetId: string): string | undefined;
  createRuntime: CreateRuntime;
  /** Starting card. Defaults to the entry card. */
  startCardId?: string;
  /** Runtime issues are reported here as well as shown in preview. */
  onError?(message: string): void;
}

export interface PlayerHandle {
  destroy(): void;
}

/**
 * SKELETON. The `preview-export` worktree implements the DOM renderer. Preview and the standalone
 * export both call this one function, so they cannot interpret a Stack differently.
 */
export function mountPlayer(options: PlayerOptions): PlayerHandle {
  void options;
  throw new Error('mountPlayer is not implemented yet');
}
