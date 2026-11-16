import { arbBundle } from '@ghoststack/domain/testing';
import { unzipSync } from 'fflate';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { serializeProject } from '../serialize';
import { buildArchive } from '../testing/archive';
import type { ArchivePart } from '../testing/archive';
import { importProject } from './importProject';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Serializes the bundle, then rewrites `formatVersion` in the manifest and re-zips every entry. */
async function withFormatVersion(
  bundle: Parameters<typeof serializeProject>[0],
  formatVersion: unknown,
): Promise<Uint8Array | undefined> {
  const exported = await serializeProject(bundle);
  if (!exported.ok) return undefined;
  const files = unzipSync(exported.value);
  const manifest = JSON.parse(decoder.decode(files['manifest.json'])) as Record<string, unknown>;
  manifest['formatVersion'] = formatVersion;
  const parts: ArchivePart[] = Object.entries(files).map(([name, data]) => ({
    name,
    data: name === 'manifest.json' ? encoder.encode(JSON.stringify(manifest)) : data,
  }));
  return buildArchive(parts);
}

const arbOtherInteger = fc
  .oneof(
    fc.constantFrom(0, 2, -1, 1000, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER),
    fc.integer({ min: Number.MIN_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER }),
  )
  .filter((value) => value !== 1);

const arbNonInteger = fc.oneof(
  fc.double({ noNaN: true, noDefaultInfinity: true }).filter((value) => !Number.isInteger(value)),
  fc.string(),
  fc.constantFrom('1', 'v1', '', null, true, false),
  fc.array(fc.integer(), { maxLength: 3 }),
  fc.dictionary(fc.string({ maxLength: 5 }), fc.integer(), { maxKeys: 3 }),
);

describe('Property 21: Unsupported format versions are rejected', () => {
  /**
   * **Validates: Requirements 8.3, 8.10, 10.3**
   */
  it('reports the archive version and the supported versions for any integer other than 1', async () => {
    await fc.assert(
      fc.asyncProperty(arbBundle, arbOtherInteger, async (bundle, version) => {
        const archive = await withFormatVersion(bundle, version);
        expect(archive).toBeDefined();
        const result = await importProject(archive!);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('PROJECT_IMPORT_FAILED');
        expect(result.error.reason).toBe('UNSUPPORTED_VERSION');
        expect(result.error.archiveVersion).toBe(version);
        expect(result.error.supportedVersions).toEqual([1]);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 8.3, 8.10, 10.3**
   */
  it('rejects any non-integer or non-number version without returning a project', async () => {
    await fc.assert(
      fc.asyncProperty(arbBundle, arbNonInteger, async (bundle, version) => {
        const archive = await withFormatVersion(bundle, version);
        expect(archive).toBeDefined();
        const result = await importProject(archive!);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(['UNSUPPORTED_VERSION', 'MANIFEST_INVALID_SCHEMA']).toContain(result.error.reason);
      }),
      { numRuns: 100 },
    );
  });
});
