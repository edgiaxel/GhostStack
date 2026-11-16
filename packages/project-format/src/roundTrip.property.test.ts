import { arbBundle, checksumOf } from '@ghoststack/domain/testing';
import { unzipSync } from 'fflate';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { importProject } from './import/importProject';
import { ManifestSchema } from './manifest';
import { serializeProject } from './serialize';
import { readEntryHeaders } from './testing/archive';

const byCodeUnit = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

describe('Property 15: .gsp round trip preserves the project', () => {
  /**
   * **Validates: Requirements 8.1, 8.2, 9.3, 9.4, 11.1**
   */
  it('imports an equal stack with byte-identical assets and the specified entries', async () => {
    await fc.assert(
      fc.asyncProperty(arbBundle, async (bundle) => {
        const exported = await serializeProject(bundle);
        expect(exported.ok).toBe(true);
        if (!exported.ok) return;
        const archive = exported.value;

        const imported = await importProject(archive);
        expect(imported.ok).toBe(true);
        if (!imported.ok) return;
        expect(imported.value.stack).toEqual(bundle.stack);

        const registry = bundle.stack.assetRegistry;
        const assetIds = Object.keys(registry);
        expect(Object.keys(imported.value.assets).sort(byCodeUnit)).toEqual(
          [...assetIds].sort(byCodeUnit),
        );
        for (const assetId of assetIds) {
          expect(imported.value.assets[assetId]).toEqual(bundle.assets[assetId]);
        }

        const names = readEntryHeaders(archive).map((entry) => entry.name);
        const expectedNames = [
          'manifest.json',
          'stack.json',
          ...Object.keys(bundle.stack.cards).map((id) => `cards/${id}.json`),
          ...assetIds.map((id) => registry[id]!.relativePath),
        ];
        expect([...names].sort(byCodeUnit)).toEqual(expectedNames.sort(byCodeUnit));

        const files = unzipSync(archive);
        const manifest = ManifestSchema.parse(
          JSON.parse(new TextDecoder().decode(files['manifest.json'])),
        );
        expect(manifest.assets).toHaveLength(assetIds.length);
        for (const entry of manifest.assets) {
          const data = files[entry.relativePath];
          expect(data).toBeDefined();
          expect(entry.byteSize).toBe(data!.length);
          expect(entry.checksum).toBe(checksumOf(data!));
        }
      }),
      { numRuns: 100 },
    );
  });
});
