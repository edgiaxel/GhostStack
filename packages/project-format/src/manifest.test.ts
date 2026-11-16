import { describe, expect, it } from 'vitest';
import { GSP_LIMITS, SUPPORTED_FORMAT_VERSIONS } from './limits';
import { ManifestSchema } from './manifest';

const asset = {
  assetId: 'ast_1',
  relativePath: 'assets/ast_1.png',
  mimeType: 'image/png',
  byteSize: 3,
  checksum: `sha256:${'a'.repeat(64)}`,
};
const manifest = {
  formatVersion: 1,
  producer: 'ghoststack-web',
  stackId: 'stk_1',
  assets: [asset],
};

describe('ManifestSchema', () => {
  it('accepts a valid manifest', () => {
    expect(ManifestSchema.safeParse(manifest).success).toBe(true);
  });

  it('rejects extra fields at the top level and inside assets', () => {
    expect(ManifestSchema.safeParse({ ...manifest, exportedAt: 'x' }).success).toBe(false);
    expect(
      ManifestSchema.safeParse({ ...manifest, assets: [{ ...asset, extra: 1 }] }).success,
    ).toBe(false);
  });

  it('rejects other format versions, bad checksums and oversized assets', () => {
    expect(ManifestSchema.safeParse({ ...manifest, formatVersion: 2 }).success).toBe(false);
    const bad = { ...asset, checksum: `md5:${'a'.repeat(64)}` };
    expect(ManifestSchema.safeParse({ ...manifest, assets: [bad] }).success).toBe(false);
    const big = { ...asset, byteSize: GSP_LIMITS.maxEntryBytes + 1 };
    expect(ManifestSchema.safeParse({ ...manifest, assets: [big] }).success).toBe(false);
  });

  it('agrees with the supported version list', () => {
    expect(SUPPORTED_FORMAT_VERSIONS).toEqual([1]);
  });
});
