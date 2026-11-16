import { buildFixtureBundle } from '@ghoststack/domain/testing';
import type { ProjectBundle } from '@ghoststack/domain';
import { unzipSync } from 'fflate';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { importProject } from './import/importProject';
import { FIXED_ZIP_TIME, GSP_LIMITS } from './limits';
import { ManifestSchema } from './manifest';
import { serializeProject } from './serialize';
import type { ExportError } from './serialize';
import { readEntryHeaders } from './testing/archive';

const bundle = buildFixtureBundle();
const [pictureId, emptyId] = Object.keys(bundle.stack.assetRegistry) as [string, string];
const picture = bundle.stack.assetRegistry[pictureId]!;
const decoder = new TextDecoder();

function withStack(changes: Record<string, unknown>): ProjectBundle {
  return { ...bundle, stack: { ...bundle.stack, ...changes } };
}

function withAssets(assets: Record<string, Uint8Array>): ProjectBundle {
  return { ...bundle, assets };
}

async function failure(input: ProjectBundle): Promise<ExportError> {
  const result = await serializeProject(input);
  if (result.ok) throw new Error('Expected the export to fail');
  expect(result.error.code).toBe('PROJECT_EXPORT_FAILED');
  return result.error;
}

async function archiveOf(input: ProjectBundle): Promise<Uint8Array> {
  const result = await serializeProject(input);
  if (!result.ok) throw new Error('Expected the export to succeed');
  return result.value;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('serializeProject success', () => {
  it('round-trips the fixture bundle through importProject', async () => {
    const imported = await importProject(await archiveOf(bundle));
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect(imported.value.stack).toEqual(bundle.stack);
    expect(imported.value.assets[pictureId]).toEqual(bundle.assets[pictureId]);
    expect(imported.value.assets[emptyId]?.length).toBe(0);
  });

  it('produces byte-identical archives for equal input', async () => {
    const first = await archiveOf(bundle);
    const second = await archiveOf(buildFixtureBundle());
    expect(second).toEqual(first);
  });

  it('writes exactly the specified entries in the specified order', async () => {
    const names = readEntryHeaders(await archiveOf(bundle)).map((entry) => entry.name);
    const cardNames = [...bundle.stack.cardOrder].sort().map((id) => `cards/${id}.json`);
    const assetPaths = Object.values(bundle.stack.assetRegistry)
      .map((asset) => asset.relativePath)
      .sort();
    expect(names).toEqual(['manifest.json', 'stack.json', ...cardNames, ...assetPaths]);
  });

  it('stores assets and deflates JSON', async () => {
    const headers = readEntryHeaders(await archiveOf(bundle));
    for (const entry of headers) {
      expect(entry.method).toBe(entry.name.startsWith('assets/') ? 0 : 8);
    }
  });

  it('writes the fixed DOS time of 1980-01-01 00:00 on every entry', async () => {
    const archive = await archiveOf(bundle);
    const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
    const count = view.getUint16(archive.byteLength - 22 + 10, true);
    let offset = view.getUint32(archive.byteLength - 22 + 16, true);
    for (let index = 0; index < count; index += 1) {
      expect(view.getUint16(offset + 12, true)).toBe(0);
      expect(view.getUint16(offset + 14, true)).toBe(0x21);
      offset += 46 + view.getUint16(offset + 28, true) + view.getUint16(offset + 30, true);
    }
    expect(FIXED_ZIP_TIME.getFullYear()).toBe(1980);
  });

  it('records manifest checksums equal to independently computed SHA-256', async () => {
    const files = unzipSync(await archiveOf(bundle));
    const manifest = ManifestSchema.parse(JSON.parse(decoder.decode(files['manifest.json'])));
    expect(manifest.assets).toHaveLength(2);
    for (const asset of manifest.assets) {
      const data = files[asset.relativePath]!;
      const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
      const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join(
        '',
      );
      expect(asset.checksum).toBe(`sha256:${hex}`);
      expect(asset.byteSize).toBe(data.length);
    }
  });

  it('ignores bytes for unregistered assets and does not mutate the input', async () => {
    const extra = withAssets({ ...bundle.assets, ast_unregistered: Uint8Array.of(1) });
    const before = structuredClone(extra);
    expect(await archiveOf(extra)).toEqual(await archiveOf(bundle));
    expect(extra).toEqual(before);
  });
});

describe('serializeProject refusals', () => {
  it('rejects an invalid project with validation errors', async () => {
    const error = await failure(
      withStack({
        cardOrder: [...bundle.stack.cardOrder, 'crd_00000000-0000-4000-8000-0000000000ff'],
      }),
    );
    expect(error.reason).toBe('VALIDATION_FAILED');
    expect(error.validationErrors?.length).toBeGreaterThan(0);
  });

  it('rejects a registered asset with no bytes', async () => {
    const rest = Object.fromEntries(
      Object.entries(bundle.assets).filter(([id]) => id !== pictureId),
    );
    const error = await failure(withAssets(rest));
    expect(error).toMatchObject({ reason: 'ASSET_BYTES_MISSING', assetId: pictureId });
  });

  it('rejects bytes whose length differs from the registry', async () => {
    const error = await failure(
      withAssets({ ...bundle.assets, [pictureId]: new Uint8Array(picture.byteSize + 1) }),
    );
    expect(error).toMatchObject({ reason: 'ASSET_INCONSISTENT', assetId: pictureId });
  });

  it('rejects bytes whose checksum differs from the registry', async () => {
    const flipped = Uint8Array.from(bundle.assets[pictureId]!);
    flipped[0] = flipped[0]! ^ 0xff;
    const error = await failure(withAssets({ ...bundle.assets, [pictureId]: flipped }));
    expect(error).toMatchObject({ reason: 'ASSET_INCONSISTENT', assetId: pictureId });
  });

  it('rejects a project that would exceed the entry limit', async () => {
    const limits = GSP_LIMITS as { maxEntries: number };
    const original = limits.maxEntries;
    limits.maxEntries = 3;
    try {
      expect((await failure(bundle)).reason).toBe('LIMIT_EXCEEDED');
    } finally {
      limits.maxEntries = original;
    }
  });

  it('reports CRYPTO_UNAVAILABLE when Web Crypto is missing', async () => {
    vi.stubGlobal('crypto', undefined);
    expect((await failure(bundle)).reason).toBe('CRYPTO_UNAVAILABLE');
  });
});
