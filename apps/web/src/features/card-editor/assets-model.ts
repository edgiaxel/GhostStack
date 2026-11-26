import type { Asset, Stack } from '@ghoststack/shared-contracts';

export interface AssetRow {
  asset: Asset;
  /** Number of elements, across all cards, that reference the asset. */
  uses: number;
  /** File name without the id prefix that `describeAssetFile` adds. */
  fileName: string;
}

/** Elements that reference each registered asset. Unregistered references are not counted. */
export function assetRows(stack: Stack): AssetRow[] {
  const counts = new Map<string, number>();
  for (const card of Object.values(stack.cards)) {
    for (const element of card.elements) {
      if (element.assetId !== undefined) counts.set(element.assetId, (counts.get(element.assetId) ?? 0) + 1);
    }
  }
  return Object.values(stack.assetRegistry)
    .map((asset) => ({
      asset,
      uses: counts.get(asset.assetId) ?? 0,
      fileName: asset.relativePath.startsWith(`${asset.assetId}-`)
        ? asset.relativePath.slice(asset.assetId.length + 1)
        : asset.relativePath,
    }))
    .sort((a, b) => a.fileName.localeCompare(b.fileName) || a.asset.assetId.localeCompare(b.asset.assetId));
}

export const orphanIds = (rows: AssetRow[]): string[] =>
  rows.filter((r) => r.uses === 0).map((r) => r.asset.assetId);

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
