import type { Stack } from '@ghoststack/shared-contracts';

/** Ids of assets that at least one element references. */
export function referencedAssetIds(stack: Stack): Set<string> {
  const used = new Set<string>();
  for (const card of Object.values(stack.cards)) {
    for (const element of card.elements) if (element.assetId !== undefined) used.add(element.assetId);
  }
  return used;
}

/**
 * Returns the Stack without registered assets that no element references. Exports call this so an
 * orphaned asset never reaches a `.gsp` or a web app. The input is not changed.
 */
export function pruneOrphanAssets(stack: Stack): Stack {
  const used = referencedAssetIds(stack);
  const entries = Object.entries(stack.assetRegistry);
  if (entries.every(([id]) => used.has(id))) return stack;
  return { ...stack, assetRegistry: Object.fromEntries(entries.filter(([id]) => used.has(id))) };
}
