import { buildFixtureBundle } from '@ghoststack/domain/testing';
import type { ProjectBundle } from '@ghoststack/domain';
import { createMemoryStorage } from '@ghoststack/storage';
import { unzipSync } from 'fflate';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { importProject } from './import/importProject';
import type { ImportError, ImportReason } from './import/importProject';
import { GSP_LIMITS } from './limits';
import { serializeProject } from './serialize';
import type { ExportError } from './serialize';
import {
  buildArchive,
  buildArchiveWithDuplicateName,
  buildZeroFilledArchive,
  flipByte,
  patchDeclaredSizes,
  readEntryHeaders,
  truncateArchive,
} from './testing/archive';
import type { ArchivePart } from './testing/archive';

const encoder = new TextEncoder();
const encode = (value: unknown): Uint8Array => encoder.encode(JSON.stringify(value));
const MIB = 1_048_576;

const bundle = buildFixtureBundle();
const [pictureId, emptyId] = Object.keys(bundle.stack.assetRegistry) as [string, string];
const picture = bundle.stack.assetRegistry[pictureId]!;
const cardIds = bundle.stack.cardOrder;

async function exportOk(input: ProjectBundle): Promise<Uint8Array> {
  const result = await serializeProject(input);
  if (!result.ok) throw new Error('Expected the export to succeed');
  return result.value;
}

async function exportError(input: ProjectBundle): Promise<ExportError> {
  const result = await serializeProject(input);
  if (result.ok) throw new Error('Expected the export to fail');
  expect(result.error.code).toBe('PROJECT_EXPORT_FAILED');
  expect('value' in result).toBe(false);
  return result.error;
}

/** Valid archive entries, read back so that each fixture changes exactly one thing. */
async function validParts(): Promise<ArchivePart[]> {
  const files = unzipSync(await exportOk(bundle));
  return Object.entries(files).map(([name, data]) => ({
    name,
    data,
    level: name.startsWith('assets/') ? 0 : 6,
  }));
}

function replace(parts: ArchivePart[], name: string, data: unknown): ArchivePart[] {
  const bytes = data instanceof Uint8Array ? data : encode(data);
  return parts.map((part) => (part.name === name ? { ...part, data: bytes } : part));
}

function parse(parts: ArchivePart[], name: string): Record<string, unknown> {
  const part = parts.find((candidate) => candidate.name === name);
  return JSON.parse(new TextDecoder().decode(part!.data)) as Record<string, unknown>;
}

interface Fixture {
  readonly label: string;
  readonly reason: ImportReason;
  readonly build: () => Promise<Uint8Array>;
  readonly expected?: Partial<ImportError>;
}

const cardEntry = `cards/${cardIds[0]}.json`;
const lastCardEntry = `cards/${cardIds[2]}.json`;

const fixtures: Fixture[] = [
  // Requirement 10.2
  {
    label: '10.2 manifest missing',
    reason: 'MANIFEST_MISSING',
    build: async () =>
      buildArchive((await validParts()).filter((part) => part.name !== 'manifest.json')),
  },
  {
    label: '10.2 manifest is not JSON',
    reason: 'MANIFEST_INVALID_JSON',
    build: async () =>
      buildArchive(replace(await validParts(), 'manifest.json', encoder.encode('{not json'))),
  },
  {
    label: '10.2 manifest fails the schema',
    reason: 'MANIFEST_INVALID_SCHEMA',
    build: async () => {
      const parts = await validParts();
      return buildArchive(
        replace(parts, 'manifest.json', { ...parse(parts, 'manifest.json'), producer: 7 }),
      );
    },
  },
  // Requirement 10.3
  {
    label: '10.3 newer format version',
    reason: 'UNSUPPORTED_VERSION',
    expected: { archiveVersion: 2, supportedVersions: [1] },
    build: async () => {
      const parts = await validParts();
      return buildArchive(
        replace(parts, 'manifest.json', { ...parse(parts, 'manifest.json'), formatVersion: 2 }),
      );
    },
  },
  {
    label: '10.3 older format version',
    reason: 'UNSUPPORTED_VERSION',
    expected: { archiveVersion: 0, supportedVersions: [1] },
    build: async () => {
      const parts = await validParts();
      return buildArchive(
        replace(parts, 'manifest.json', { ...parse(parts, 'manifest.json'), formatVersion: 0 }),
      );
    },
  },
  // Requirement 10.4
  {
    label: '10.4 empty input',
    reason: 'NOT_A_ZIP',
    build: () => Promise.resolve(new Uint8Array(0)),
  },
  {
    label: '10.4 truncated archive',
    reason: 'NOT_A_ZIP',
    build: async () => {
      const archive = await exportOk(bundle);
      return truncateArchive(archive, Math.floor(archive.length / 2));
    },
  },
  {
    label: '10.4 end of central directory signature destroyed',
    reason: 'NOT_A_ZIP',
    build: async () => {
      const archive = await exportOk(bundle);
      return flipByte(archive, archive.length - 22);
    },
  },
  {
    label: '10.4 random bytes',
    reason: 'NOT_A_ZIP',
    build: () => Promise.resolve(Uint8Array.from({ length: 256 }, (_v, i) => (i * 31 + 7) % 256)),
  },
  // Requirement 10.5
  ...(
    [
      ['path traversal', 'cards/../evil.json'],
      ['absolute path', '/etc/passwd'],
      ['backslash', 'assets\\evil.bin'],
      ['null character', 'assets/evil\u0000.bin'],
      ['unknown location', 'extra/notes.txt'],
    ] as const
  ).map(([label, name]): Fixture => ({
    label: `10.5 unsafe entry: ${label}`,
    reason: 'UNSAFE_ENTRY',
    expected: { entry: name },
    build: async () => buildArchive([...(await validParts()), { name, data: encode({}) }]),
  })),
  // Requirement 10.6
  {
    label: '10.6 archive above the size limit',
    reason: 'LIMIT_EXCEEDED',
    expected: { limit: 'archive-size' },
    build: () => Promise.resolve(new Uint8Array(GSP_LIMITS.maxArchiveBytes + 1)),
  },
  {
    label: '10.6 entry above the per-entry limit',
    reason: 'LIMIT_EXCEEDED',
    expected: { limit: 'entry-size' },
    build: () =>
      Promise.resolve(buildZeroFilledArchive('assets/big.bin', GSP_LIMITS.maxEntryBytes + 1, 9)),
  },
  {
    label: '10.6 entries above the total limit',
    reason: 'LIMIT_EXCEEDED',
    expected: { limit: 'total-size' },
    build: () => {
      const size = 21 * MIB;
      const parts = Array.from({ length: 5 }, (_v, i) => ({
        name: `assets/zeros-${i}.bin`,
        data: new Uint8Array(size),
        level: 9 as const,
      }));
      return Promise.resolve(buildArchive(parts));
    },
  },
  {
    label: '10.6 entry count above the limit',
    reason: 'LIMIT_EXCEEDED',
    expected: { limit: 'entry-count' },
    build: async () => {
      const extra = Array.from({ length: GSP_LIMITS.maxEntries }, (_v, i) => ({
        name: `assets/e${i}.bin`,
        data: new Uint8Array(0),
        level: 0 as const,
      }));
      return buildArchive([...(await validParts()), ...extra]);
    },
  },
  // Requirement 10.7
  {
    label: '10.7 declared size smaller than the real size',
    reason: 'SIZE_MISMATCH',
    build: async () => {
      const archive = await exportOk(bundle);
      const index = readEntryHeaders(archive).findIndex((entry) => entry.name === cardEntry);
      return patchDeclaredSizes(archive, index, { uncompressedSize: 5 });
    },
  },
  {
    label: '10.7 compression ratio bomb',
    reason: 'RATIO_EXCEEDED',
    build: () => Promise.resolve(buildZeroFilledArchive('assets/bomb.bin', 2 * MIB)),
  },
  {
    label: '10.7 duplicate entry name',
    reason: 'DUPLICATE_ENTRY',
    expected: { entry: 'manifest.json' },
    build: () =>
      Promise.resolve(
        buildArchiveWithDuplicateName({ data: encode({}) }, { data: encode({}) }, 'manifest.json', [
          { name: 'stack.json', data: encode({}) },
        ]),
      ),
  },
  // Requirement 10.8
  {
    label: '10.8 asset checksum mismatch',
    reason: 'CHECKSUM_MISMATCH',
    expected: { assetId: pictureId },
    build: async () =>
      buildArchive(
        replace(await validParts(), picture.relativePath, flipByte(bundle.assets[pictureId]!, 0)),
      ),
  },
  // Requirement 10.9
  {
    label: '10.9 manifest asset has no entry',
    reason: 'ASSET_ENTRY_MISSING',
    expected: { assetId: pictureId },
    build: async () =>
      buildArchive((await validParts()).filter((part) => part.name !== picture.relativePath)),
  },
  {
    label: '10.9 asset entry not listed in the manifest',
    reason: 'ASSET_ENTRY_UNLISTED',
    expected: { entry: 'assets/unlisted.bin' },
    build: async () =>
      buildArchive([
        ...(await validParts()),
        { name: 'assets/unlisted.bin', data: encoder.encode('x'), level: 0 },
      ]),
  },
  // Requirement 10.10
  {
    label: '10.10 card entry missing',
    reason: 'CARD_ENTRY_MISSING',
    expected: { entry: lastCardEntry },
    build: async () =>
      buildArchive((await validParts()).filter((part) => part.name !== lastCardEntry)),
  },
  {
    label: '10.10 card entry not referenced',
    reason: 'CARD_ENTRY_UNREFERENCED',
    build: async () => {
      const id = 'crd_00000000-0000-4000-8000-0000000000ff';
      return buildArchive([
        ...(await validParts()),
        { name: `cards/${id}.json`, data: encode({ cardId: id, title: 'Extra', elements: [] }) },
      ]);
    },
  },
  // Requirement 10.12
  {
    label: '10.12 project fails validation',
    reason: 'PROJECT_INVALID',
    build: async () => {
      const parts = await validParts();
      const dangling = 'crd_00000000-0000-4000-8000-0000000000ee';
      return buildArchive(
        replace(parts, 'stack.json', { ...parse(parts, 'stack.json'), entryCardId: dangling }),
      );
    },
  },
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fixture round trip', () => {
  it('imports the exported fixture bundle as an equal project with identical asset bytes', async () => {
    const imported = await importProject(await exportOk(bundle));
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect(Object.keys(imported.value.stack.cards)).toHaveLength(3);
    expect(Object.keys(imported.value.stack.assetRegistry)).toHaveLength(2);
    expect(imported.value.stack).toEqual(bundle.stack);
    expect(imported.value.assets[pictureId]).toEqual(bundle.assets[pictureId]);
    expect(imported.value.assets[pictureId]!.length).toBeGreaterThan(0);
    expect(imported.value.assets[emptyId]).toBeInstanceOf(Uint8Array);
    expect(imported.value.assets[emptyId]!.length).toBe(0);
  });

  it('keeps script-like and HTML-like text as plain text', async () => {
    const script = '<script>alert("x")</script>';
    const html = '<img src=x onerror=alert(1)> & "quotes" \u2028 </title>';
    const first = bundle.stack.cards[cardIds[0]!]!;
    const element = first.elements[0] as Extract<(typeof first.elements)[number], { type: 'text' }>;
    const hostile: ProjectBundle = {
      ...bundle,
      stack: {
        ...bundle.stack,
        title: script,
        cards: {
          ...bundle.stack.cards,
          [first.cardId]: {
            ...first,
            title: html,
            elements: [
              { ...element, name: script, properties: { text: html } },
              ...first.elements.slice(1),
            ],
          },
        },
      },
    };
    const imported = await importProject(await exportOk(hostile));
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect(imported.value.stack.title).toBe(script);
    expect(imported.value.stack.cards[first.cardId]!.title).toBe(html);
    expect(imported.value.stack).toEqual(hostile.stack);
  });
});

describe('failure fixtures for Requirement 10', () => {
  it.each(fixtures.map((fixture) => [fixture.label, fixture] as const))(
    '%s returns a structured error and no project',
    async (_label, fixture) => {
      const bytes = await fixture.build();
      let result: Awaited<ReturnType<typeof importProject>> | undefined;
      await expect(
        (async () => {
          result = await importProject(bytes);
        })(),
      ).resolves.toBeUndefined();
      expect(result!.ok).toBe(false);
      if (result!.ok) return;
      expect(result!.error).toMatchObject({
        code: 'PROJECT_IMPORT_FAILED',
        reason: fixture.reason,
        ...fixture.expected,
      });
      expect(result!.error.message).not.toHaveLength(0);
      expect('value' in result!).toBe(false);
    },
  );

  it('covers every ImportReason except the ones needing special setup', () => {
    const covered = new Set(fixtures.map((fixture) => fixture.reason));
    for (const reason of [
      'NOT_A_ZIP',
      'MANIFEST_MISSING',
      'MANIFEST_INVALID_JSON',
      'MANIFEST_INVALID_SCHEMA',
      'UNSUPPORTED_VERSION',
      'UNSAFE_ENTRY',
      'DUPLICATE_ENTRY',
      'LIMIT_EXCEEDED',
      'SIZE_MISMATCH',
      'RATIO_EXCEEDED',
      'CHECKSUM_MISMATCH',
      'ASSET_ENTRY_MISSING',
      'ASSET_ENTRY_UNLISTED',
      'CARD_ENTRY_MISSING',
      'CARD_ENTRY_UNREFERENCED',
      'PROJECT_INVALID',
    ] as const) {
      expect(covered.has(reason)).toBe(true);
    }
  });

  it('leaves memory-storage state and the input bundle unchanged after rejected imports', async () => {
    const storage = createMemoryStorage();
    const saved = await storage.saveProject(bundle);
    expect(saved.ok).toBe(true);
    const listingBefore = await storage.listProjects();
    const loadedBefore = await storage.loadProject(bundle.stack.stackId);
    const active = structuredClone(bundle);
    expect(listingBefore.ok && loadedBefore.ok).toBe(true);

    for (const fixture of fixtures) {
      const result = await importProject(await fixture.build(), {
        existingStackIds: new Set([bundle.stack.stackId]),
      });
      expect(result.ok).toBe(false);
    }

    expect(await storage.listProjects()).toEqual(listingBefore);
    expect(await storage.loadProject(bundle.stack.stackId)).toEqual(loadedBefore);
    expect(bundle).toEqual(active);
  });
});

type MutableLimits = { -readonly [K in keyof typeof GSP_LIMITS]: number };

async function withLimits(
  changes: Partial<MutableLimits>,
  run: () => Promise<void>,
): Promise<void> {
  const limits = GSP_LIMITS as MutableLimits;
  const saved = { ...limits };
  Object.assign(limits, changes);
  try {
    await run();
  } finally {
    Object.assign(limits, saved);
  }
}

describe('serializeProject limits and reopen failures', () => {
  async function entrySizes(): Promise<number[]> {
    return Object.values(unzipSync(await exportOk(bundle))).map((data) => data.length);
  }

  it('reports LIMIT_EXCEEDED when one entry is above the per-entry limit', async () => {
    const largest = Math.max(...(await entrySizes()));
    await withLimits({ maxEntryBytes: largest - 1 }, async () => {
      expect((await exportError(bundle)).reason).toBe('LIMIT_EXCEEDED');
    });
  });

  it('reports LIMIT_EXCEEDED when the entries together are above the total limit', async () => {
    const sizes = await entrySizes();
    const total = sizes.reduce((sum, size) => sum + size, 0);
    await withLimits({ maxTotalBytes: total - 1 }, async () => {
      expect((await exportError(bundle)).reason).toBe('LIMIT_EXCEEDED');
    });
    await withLimits({ maxTotalBytes: total }, async () => {
      expect((await exportOk(bundle)).length).toBeGreaterThan(0);
    });
  });

  it('reports LIMIT_EXCEEDED when the finished archive is above the archive size limit', async () => {
    const size = (await exportOk(bundle)).length;
    await withLimits({ maxArchiveBytes: size - 1 }, async () => {
      const error = await exportError(bundle);
      expect(error.reason).toBe('LIMIT_EXCEEDED');
      expect(error.message).toContain('archive size');
    });
  });

  it('reports REOPEN_FAILED with the importer error when the reopen step rejects the archive', async () => {
    // Every deflated JSON entry exceeds a ratio of 1:1 here, so only the importer rejects it.
    await withLimits({ ratioMinEntryBytes: 1, maxRatio: 1.0001 }, async () => {
      const error = await exportError(bundle);
      expect(error.reason).toBe('REOPEN_FAILED');
      expect(error.importErrors).toHaveLength(1);
      expect(error.importErrors![0]).toMatchObject({
        code: 'PROJECT_IMPORT_FAILED',
        reason: 'RATIO_EXCEEDED',
      });
    });
  });

  it('returns REOPEN_FAILED instead of throwing when reading the input throws', async () => {
    const throwing = {
      stack: bundle.stack,
      get assets(): Record<string, Uint8Array> {
        throw new Error('boom');
      },
    } as ProjectBundle;
    const error = await exportError(throwing);
    expect(error.reason).toBe('REOPEN_FAILED');
    expect(error.message).not.toContain('boom');
  });
});

describe('time zone determinism', () => {
  const zones = ['America/Los_Angeles', 'UTC', 'Pacific/Auckland'];

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('serializes to the same bytes whatever the process time zone is at module load', async () => {
    const outputs: Uint8Array[] = [];
    for (const zone of zones) {
      vi.stubEnv('TZ', zone);
      vi.resetModules();
      const fresh = await import('./serialize');
      const result = await fresh.serializeProject(buildFixtureBundle());
      if (!result.ok) throw new Error(`Export failed under ${zone}`);
      outputs.push(result.value);
    }
    expect(outputs[1]).toEqual(outputs[0]);
    expect(outputs[2]).toEqual(outputs[0]);
  });
});
