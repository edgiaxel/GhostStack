import { useEffect, useState } from 'react';
import type { Asset } from '@ghoststack/shared-contracts';
import { isSafeRelativePath } from '@ghoststack/shared-contracts';
import { useServices } from './services';

export type AssetUrlState =
  | { status: 'loading' }
  | { status: 'ready'; url: string }
  /** The registry lists the asset but its bytes are not in storage. Render the fallback, never crash. */
  | { status: 'missing' };

/** Object URL for a stored asset, revoked on unmount. `assetId` undefined resolves to `missing`. */
export function useAssetUrl(stackId: string, assetId: string | undefined): AssetUrlState {
  const { assets } = useServices();
  const key = `${stackId}/${assetId ?? ''}`;
  const [resolved, setResolved] = useState<{ key: string; state: AssetUrlState } | undefined>();

  useEffect(() => {
    if (assetId === undefined) return;
    let cancelled = false;
    let url: string | undefined;
    assets.get(stackId, assetId).then(
      (bytes) => {
        if (cancelled) return;
        if (!bytes) return setResolved({ key, state: { status: 'missing' } });
        url = URL.createObjectURL(new Blob([bytes.slice().buffer]));
        setResolved({ key, state: { status: 'ready', url } });
      },
      () => {
        if (!cancelled) setResolved({ key, state: { status: 'missing' } });
      },
    );
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [assets, stackId, assetId, key]);

  if (assetId === undefined) return { status: 'missing' };
  return resolved?.key === key ? resolved.state : { status: 'loading' };
}

const hex = (buf: ArrayBuffer): string =>
  Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');

/** Builds registry metadata for a user-chosen file. `assetId` comes from the caller (`crypto.randomUUID()`). */
export async function describeAssetFile(
  file: Blob & { name?: string },
  assetId: string,
): Promise<{ asset: Asset; bytes: Uint8Array }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const safeName = (file.name ?? 'asset').replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 80) || 'asset';
  const relativePath = `${assetId}-${safeName}`;
  if (!isSafeRelativePath(relativePath)) throw new Error('Unsafe asset file name');
  const checksum = hex(await crypto.subtle.digest('SHA-256', bytes));
  return {
    asset: {
      assetId,
      relativePath,
      mimeType: file.type || 'application/octet-stream',
      byteSize: bytes.length,
      checksum,
    },
    bytes,
  };
}
