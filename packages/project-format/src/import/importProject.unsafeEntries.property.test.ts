import { arbBundle } from '@ghoststack/domain/testing';
import fc from 'fast-check';
import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { serializeProject } from '../serialize';
import { buildArchive } from '../testing/archive';
import type { ArchivePart } from '../testing/archive';
import { importProject } from './importProject';

const segment = fc.stringMatching(/^[a-z0-9]{1,8}$/);

const unsafeName = fc.oneof(
  segment.map((s) => `/${s}`),
  segment.map((s) => `/assets/${s}.png`),
  segment.map((s) => `../${s}`),
  segment.map((s) => `assets/../${s}.png`),
  fc.tuple(segment, segment).map(([a, b]) => `${a}/../${b}`),
  segment.map((s) => `assets/${s}/..`),
  fc.tuple(segment, segment).map(([a, b]) => `${a}\\${b}`),
  segment.map((s) => `assets\\${s}.png`),
  fc.tuple(segment, segment).map(([a, b]) => `${a}\u0000${b}`),
  segment.map((s) => `assets/${s}\u0000.png`),
  segment.map((s) => `${s}/`),
  segment.map((s) => `assets/${s}/`),
  segment.map((s) => `cards/${s}/`),
);

const unrecognizedName = fc.oneof(
  segment.map((s) => `extra-${s}.json`),
  segment.map((s) => `extra/${s}.bin`),
  segment.map((s) => `cards/not-a-card-id-${s}.json`),
  segment.map((s) => `cards/${s}.txt`),
  segment.map((s) => `Manifest-${s}.json`),
  segment.map((s) => `stack-${s}.json`),
);

const entryBytes = fc.uint8Array({ maxLength: 32 });

async function archiveWithExtra(
  bundle: Parameters<typeof serializeProject>[0],
  extra: ArchivePart,
): Promise<Uint8Array> {
  const exported = await serializeProject(bundle);
  if (!exported.ok) throw new Error(`Generated bundle failed to export: ${exported.error.reason}`);
  const parts: ArchivePart[] = Object.entries(unzipSync(exported.value)).map(([name, data]) => ({
    name,
    data,
  }));
  return buildArchive([...parts, extra]);
}

async function expectUnsafe(
  bundle: Parameters<typeof serializeProject>[0],
  name: string,
  data: Uint8Array,
): Promise<void> {
  const result = await importProject(await archiveWithExtra(bundle, { name, data }));
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error.code).toBe('PROJECT_IMPORT_FAILED');
    expect(result.error.reason).toBe('UNSAFE_ENTRY');
    expect(result.error.entry).toBe(name);
  }
}

describe('Property 19: unsafe or unrecognized entry names are rejected', () => {
  it('accepts the valid archive without the extra entry', async () => {
    await fc.assert(
      fc.asyncProperty(arbBundle, async (bundle) => {
        const exported = await serializeProject(bundle);
        expect(exported.ok).toBe(true);
        if (exported.ok) expect((await importProject(exported.value)).ok).toBe(true);
      }),
      { numRuns: 20 },
    );
  });

  // Feature: m1-foundation, Property 19: Unsafe or unrecognized entry names are rejected
  // **Validates: Requirements 8.8, 10.5**
  it('rejects absolute, traversal, backslash, null-character and directory names', async () => {
    await fc.assert(
      fc.asyncProperty(arbBundle, unsafeName, entryBytes, async (bundle, name, data) => {
        await expectUnsafe(bundle, name, data);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: m1-foundation, Property 19: Unsafe or unrecognized entry names are rejected
  // **Validates: Requirements 8.8, 10.5**
  it('rejects names outside manifest.json, stack.json, cards/ and assets/', async () => {
    await fc.assert(
      fc.asyncProperty(arbBundle, unrecognizedName, entryBytes, async (bundle, name, data) => {
        await expectUnsafe(bundle, name, data);
      }),
      { numRuns: 100 },
    );
  });
});
