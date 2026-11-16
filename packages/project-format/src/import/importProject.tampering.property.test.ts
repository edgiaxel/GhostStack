import { MAX_ASSET_BYTES, ID_PATTERNS } from '@ghoststack/domain';
import type { ProjectBundle } from '@ghoststack/domain';
import { arbBundle, arbId } from '@ghoststack/domain/testing';
import { unzipSync } from 'fflate';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ManifestSchema } from '../manifest';
import type { Manifest } from '../manifest';
import { serializeProject } from '../serialize';
import { buildArchive } from '../testing/archive';
import { importProject } from './importProject';
import type { ImportReason } from './importProject';

type Files = Record<string, Uint8Array>;

interface Tampered {
  readonly archive: Uint8Array;
  readonly reason: ImportReason;
  readonly assetId?: string;
  readonly entry: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function archiveOf(bundle: ProjectBundle): Promise<Uint8Array> {
  const result = await serializeProject(bundle);
  if (!result.ok) throw new Error(`Generated bundle failed to export: ${result.error.reason}`);
  return result.value;
}

function repack(files: Files): Uint8Array {
  return buildArchive(Object.entries(files).map(([name, data]) => ({ name, data })));
}

function readManifest(files: Files): Manifest {
  return ManifestSchema.parse(JSON.parse(decoder.decode(files['manifest.json'])));
}

function withManifest(files: Files, manifest: Manifest): Files {
  return { ...files, 'manifest.json': encoder.encode(JSON.stringify(manifest)) };
}

function without(files: Files, name: string): Files {
  return Object.fromEntries(Object.entries(files).filter(([key]) => key !== name));
}

function withAssetEdited(
  manifest: Manifest,
  index: number,
  edit: (asset: Manifest['assets'][number]) => Manifest['assets'][number],
): Manifest {
  return { ...manifest, assets: manifest.assets.map((a, i) => (i === index ? edit(a) : a)) };
}

function differentChecksum(checksum: string): string {
  const last = checksum.endsWith('0') ? '1' : '0';
  return `${checksum.slice(0, -1)}${last}`;
}

interface Mutation {
  readonly label: string;
  /** Returns undefined when the bundle cannot take this mutation. */
  readonly apply: (
    files: Files,
    pick: { readonly asset: number; readonly byte: number; readonly cardId: string },
  ) => Tampered | undefined;
}

const MUTATIONS: readonly Mutation[] = [
  {
    label: "change an asset's bytes",
    apply: (files, pick) => {
      const manifest = readManifest(files);
      const asset = manifest.assets[pick.asset % Math.max(manifest.assets.length, 1)];
      const data = asset === undefined ? undefined : files[asset.relativePath];
      if (asset === undefined || data === undefined || data.length === 0) return undefined;
      const changed = data.slice();
      const offset = pick.byte % changed.length;
      changed[offset] = (changed[offset] ?? 0) ^ 0xff;
      return {
        archive: repack({ ...files, [asset.relativePath]: changed }),
        reason: 'CHECKSUM_MISMATCH',
        assetId: asset.assetId,
        entry: asset.relativePath,
      };
    },
  },
  {
    label: 'remove an asset entry',
    apply: (files, pick) => {
      const manifest = readManifest(files);
      const asset = manifest.assets[pick.asset % Math.max(manifest.assets.length, 1)];
      if (asset === undefined) return undefined;
      return {
        archive: repack(without(files, asset.relativePath)),
        reason: 'ASSET_ENTRY_MISSING',
        assetId: asset.assetId,
        entry: asset.relativePath,
      };
    },
  },
  {
    label: 'add an unlisted asset entry',
    apply: (files) => {
      const entry = 'assets/unlisted.bin';
      return {
        archive: repack({ ...files, [entry]: new Uint8Array([1, 2, 3]) }),
        reason: 'ASSET_ENTRY_UNLISTED',
        entry,
      };
    },
  },
  {
    label: 'remove a card entry',
    apply: (files, pick) => {
      const cards = Object.keys(files)
        .filter((name) => name.startsWith('cards/'))
        .sort();
      const entry = cards[pick.asset % Math.max(cards.length, 1)];
      if (entry === undefined) return undefined;
      return {
        archive: repack(without(files, entry)),
        reason: 'CARD_ENTRY_MISSING',
        entry,
      };
    },
  },
  {
    label: 'add an unreferenced card entry',
    apply: (files, pick) => {
      const source = Object.keys(files).find((name) => name.startsWith('cards/'));
      const entry = `cards/${pick.cardId}.json`;
      if (source === undefined || files[entry] !== undefined) return undefined;
      const card = JSON.parse(decoder.decode(files[source])) as Record<string, unknown>;
      return {
        archive: repack({
          ...files,
          [entry]: encoder.encode(JSON.stringify({ ...card, cardId: pick.cardId })),
        }),
        reason: 'CARD_ENTRY_UNREFERENCED',
        entry,
      };
    },
  },
  {
    label: "rename a card entry so it differs from its card's ID",
    apply: (files, pick) => {
      const cards = Object.keys(files)
        .filter((name) => name.startsWith('cards/'))
        .sort();
      const source = cards[pick.asset % Math.max(cards.length, 1)];
      const entry = `cards/${pick.cardId}.json`;
      if (source === undefined || files[entry] !== undefined) return undefined;
      const renamed = { ...without(files, source), [entry]: files[source] as Uint8Array };
      return { archive: repack(renamed), reason: 'CARD_ENTRY_MISMATCH', entry };
    },
  },
  {
    label: 'change a manifest checksum',
    apply: (files, pick) => {
      const manifest = readManifest(files);
      const index = pick.asset % Math.max(manifest.assets.length, 1);
      const asset = manifest.assets[index];
      if (asset === undefined) return undefined;
      const edited = withAssetEdited(manifest, index, (a) => ({
        ...a,
        checksum: differentChecksum(a.checksum),
      }));
      return {
        archive: repack(withManifest(files, edited)),
        reason: 'CHECKSUM_MISMATCH',
        assetId: asset.assetId,
        entry: asset.relativePath,
      };
    },
  },
  {
    label: 'change a manifest byteSize',
    apply: (files, pick) => {
      const manifest = readManifest(files);
      const index = pick.asset % Math.max(manifest.assets.length, 1);
      const asset = manifest.assets[index];
      if (asset === undefined) return undefined;
      const edited = withAssetEdited(manifest, index, (a) => ({
        ...a,
        byteSize: a.byteSize < MAX_ASSET_BYTES ? a.byteSize + 1 : a.byteSize - 1,
      }));
      return {
        archive: repack(withManifest(files, edited)),
        reason: 'SIZE_MISMATCH',
        assetId: asset.assetId,
        entry: asset.relativePath,
      };
    },
  },
];

describe('Property 20: archive tampering is detected with the right reason', () => {
  for (const mutation of MUTATIONS) {
    // Feature: m1-foundation, Property 20: Archive tampering is detected with the right reason
    // **Validates: Requirements 8.9, 10.8, 10.9, 10.10**
    it(`rejects: ${mutation.label}`, async () => {
      await fc.assert(
        fc.asyncProperty(
          arbBundle,
          fc.nat(),
          fc.nat(),
          arbId('crd'),
          async (bundle, asset, byte, cardId) => {
            expect(ID_PATTERNS.crd.test(cardId)).toBe(true);
            const files = unzipSync(await archiveOf(bundle));
            const tampered = mutation.apply(files, { asset, byte, cardId });
            fc.pre(tampered !== undefined);
            if (tampered === undefined) return;

            const result = await importProject(tampered.archive);
            expect(result.ok).toBe(false);
            if (result.ok) return;
            expect(result.error.code).toBe('PROJECT_IMPORT_FAILED');
            expect(result.error.reason).toBe(tampered.reason);
            expect(result.error.entry).toBe(tampered.entry);
            expect(result.error.assetId).toBe(tampered.assetId);
          },
        ),
        { numRuns: 50 },
      );
    });
  }
});
