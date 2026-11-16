import { buildFixtureBundle } from '@ghoststack/domain/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GSP_LIMITS } from '../limits';
import {
  buildArchive,
  buildArchiveWithDuplicateName,
  buildZeroFilledArchive,
  flipByte,
  readEntryHeaders,
  truncateArchive,
} from '../testing/archive';
import type { ArchivePart } from '../testing/archive';
import { importProject } from './importProject';
import type { ImportError } from './importProject';

const encode = (value: unknown): Uint8Array =>
  new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value));

const bundle = buildFixtureBundle();
const stack = bundle.stack;
const cardIds = stack.cardOrder;
const [pictureId, emptyId] = Object.keys(stack.assetRegistry) as [string, string];
const picture = stack.assetRegistry[pictureId]!;
const empty = stack.assetRegistry[emptyId]!;

function manifestOf(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    formatVersion: 1,
    producer: 'ghoststack-web',
    stackId: stack.stackId,
    assets: Object.values(stack.assetRegistry),
    ...overrides,
  };
}

const stackFile: Record<string, unknown> = { ...stack };
delete stackFile['cards'];

function validParts(): ArchivePart[] {
  return [
    { name: 'manifest.json', data: encode(manifestOf()) },
    { name: 'stack.json', data: encode(stackFile) },
    ...cardIds.map((id) => ({ name: `cards/${id}.json`, data: encode(stack.cards[id]) })),
    { name: picture.relativePath, data: bundle.assets[pictureId]!, level: 0 as const },
    { name: empty.relativePath, data: bundle.assets[emptyId]!, level: 0 as const },
  ];
}

function withPart(name: string, data: unknown): ArchivePart[] {
  const bytes = data instanceof Uint8Array ? data : encode(data);
  return validParts().map((part) => (part.name === name ? { ...part, data: bytes } : part));
}

function without(name: string): ArchivePart[] {
  return validParts().filter((part) => part.name !== name);
}

async function failure(
  bytes: Uint8Array,
  options?: Parameters<typeof importProject>[1],
): Promise<ImportError> {
  const result = await importProject(bytes, options);
  if (result.ok) throw new Error('Expected the import to fail');
  expect(result.error.code).toBe('PROJECT_IMPORT_FAILED');
  return result.error;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('importProject success', () => {
  it('returns the stack and byte-identical assets', async () => {
    const result = await importProject(buildArchive(validParts()));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.stack).toEqual(stack);
    expect(result.value.assets).toEqual(bundle.assets);
  });
});

describe('importProject input and entry failures', () => {
  it.each([
    ['empty input', new Uint8Array(0)],
    ['random bytes', Uint8Array.from({ length: 200 }, (_v, i) => (i * 37 + 11) % 256)],
    ['text', encode('this is not a zip')],
    ['not a Uint8Array', 'text' as unknown as Uint8Array],
  ])('reports NOT_A_ZIP for %s', async (_label, bytes) => {
    expect((await failure(bytes)).reason).toBe('NOT_A_ZIP');
  });

  it('reports LIMIT_EXCEEDED for an input above the archive size limit', async () => {
    const error = await failure(new Uint8Array(GSP_LIMITS.maxArchiveBytes + 1));
    expect(error).toMatchObject({ reason: 'LIMIT_EXCEEDED', limit: 'archive-size' });
  });

  it('reports UNSAFE_ENTRY and names the entry', async () => {
    const bytes = buildArchive([
      ...validParts(),
      { name: 'cards/../evil.json', data: encode('{}') },
    ]);
    expect(await failure(bytes)).toMatchObject({
      reason: 'UNSAFE_ENTRY',
      entry: 'cards/../evil.json',
    });
  });

  it('reports DUPLICATE_ENTRY', async () => {
    const bytes = buildArchiveWithDuplicateName(
      { data: encode('{}') },
      { data: encode('{}') },
      'manifest.json',
      [{ name: 'stack.json', data: encode('{}') }],
    );
    expect(await failure(bytes)).toMatchObject({ reason: 'DUPLICATE_ENTRY' });
  });

  it('reports UNSUPPORTED_COMPRESSION', async () => {
    const archive = buildArchive(validParts());
    const copy = archive.slice();
    const header = readEntryHeaders(archive)[0]!;
    new DataView(copy.buffer).setUint16(header.centralOffset + 10, 99, true);
    expect((await failure(copy)).reason).toBe('UNSUPPORTED_COMPRESSION');
  });

  it('reports RATIO_EXCEEDED and LIMIT_EXCEEDED from declared sizes', async () => {
    const ratio = buildZeroFilledArchive('assets/zeros.bin', 2 * 1_048_576);
    expect((await failure(ratio)).reason).toBe('RATIO_EXCEEDED');
    const large = buildZeroFilledArchive('assets/zeros.bin', GSP_LIMITS.maxEntryBytes + 1, 9);
    expect(await failure(large)).toMatchObject({ reason: 'LIMIT_EXCEEDED', limit: 'entry-size' });
  });

  it('reports MANIFEST_MISSING', async () => {
    expect((await failure(buildArchive(without('manifest.json')))).reason).toBe('MANIFEST_MISSING');
  });

  it('reports ENTRY_SET_MISMATCH when stack.json is absent', async () => {
    expect((await failure(buildArchive(without('stack.json')))).reason).toBe('ENTRY_SET_MISMATCH');
  });
});

describe('importProject manifest failures', () => {
  it.each([
    ['text that is not JSON', encode('not json')],
    ['bytes that are not UTF-8', Uint8Array.from([0xff, 0xfe, 0x7b, 0x7d])],
  ])('reports MANIFEST_INVALID_JSON for %s', async (_label, data) => {
    const error = await failure(buildArchive(withPart('manifest.json', data)));
    expect(error).toMatchObject({ reason: 'MANIFEST_INVALID_JSON', entry: 'manifest.json' });
  });

  it.each([
    ['an extra field', manifestOf({ extra: true })],
    ['a missing field', { formatVersion: 1, producer: 'ghoststack-web', stackId: stack.stackId }],
    ['a non-object', [1, 2, 3]],
    ['a bad checksum format', manifestOf({ assets: [{ ...picture, checksum: 'md5:abc' }] })],
  ])('reports MANIFEST_INVALID_SCHEMA for %s', async (_label, manifest) => {
    const error = await failure(buildArchive(withPart('manifest.json', manifest)));
    expect(error.reason).toBe('MANIFEST_INVALID_SCHEMA');
  });

  it.each([0, 2, 7, 1.5])('reports UNSUPPORTED_VERSION for version %s', async (version) => {
    const error = await failure(
      buildArchive(withPart('manifest.json', { ...manifestOf(), formatVersion: version })),
    );
    expect(error).toMatchObject({
      reason: 'UNSUPPORTED_VERSION',
      archiveVersion: version,
      supportedVersions: [1],
    });
  });

  it('reports UNSUPPORTED_VERSION without archiveVersion for a non-number version', async () => {
    const error = await failure(
      buildArchive(withPart('manifest.json', { ...manifestOf(), formatVersion: '2' })),
    );
    expect(error.reason).toBe('UNSUPPORTED_VERSION');
    expect(error.archiveVersion).toBeUndefined();
  });

  it('checks the version before the rest of the schema', async () => {
    const error = await failure(buildArchive(withPart('manifest.json', { formatVersion: 2 })));
    expect(error.reason).toBe('UNSUPPORTED_VERSION');
  });
});

describe('importProject stack and card failures', () => {
  it('reports ENTRY_INVALID_JSON for stack.json and a card', async () => {
    const stackError = await failure(buildArchive(withPart('stack.json', encode('{nope'))));
    expect(stackError).toMatchObject({ reason: 'ENTRY_INVALID_JSON', entry: 'stack.json' });
    const name = `cards/${cardIds[0]}.json`;
    const cardError = await failure(buildArchive(withPart(name, encode('{nope'))));
    expect(cardError).toMatchObject({ reason: 'ENTRY_INVALID_JSON', entry: name });
  });

  it('reports ENTRY_INVALID_SCHEMA for stack.json and a card', async () => {
    const stackError = await failure(
      buildArchive(withPart('stack.json', { ...stackFile, extra: 1 })),
    );
    expect(stackError).toMatchObject({ reason: 'ENTRY_INVALID_SCHEMA', entry: 'stack.json' });
    const name = `cards/${cardIds[0]}.json`;
    const cardError = await failure(
      buildArchive(withPart(name, { ...stack.cards[cardIds[0]!], elements: 'none' })),
    );
    expect(cardError).toMatchObject({ reason: 'ENTRY_INVALID_SCHEMA', entry: name });
  });

  it('reports CARD_ENTRY_MISSING for a card in cardOrder with no entry', async () => {
    const name = `cards/${cardIds[2]}.json`;
    expect(await failure(buildArchive(without(name)))).toMatchObject({
      reason: 'CARD_ENTRY_MISSING',
      entry: name,
    });
  });

  it('reports CARD_ENTRY_UNREFERENCED for a card entry outside cardOrder', async () => {
    const id = 'crd_00000000-0000-4000-8000-0000000000ff';
    const name = `cards/${id}.json`;
    const extra = { cardId: id, title: 'Extra', elements: [] };
    const error = await failure(buildArchive([...validParts(), { name, data: encode(extra) }]));
    expect(error).toMatchObject({ reason: 'CARD_ENTRY_UNREFERENCED', entry: name });
  });

  it('reports CARD_ENTRY_MISMATCH when the entry name differs from its card ID', async () => {
    const name = `cards/${cardIds[2]}.json`;
    const error = await failure(buildArchive(withPart(name, stack.cards[cardIds[1]!])));
    expect(error).toMatchObject({ reason: 'CARD_ENTRY_MISMATCH', entry: name });
  });
});

describe('importProject asset failures', () => {
  it('reports ASSET_ENTRY_MISSING with the asset ID', async () => {
    const error = await failure(buildArchive(without(picture.relativePath)));
    expect(error).toMatchObject({
      reason: 'ASSET_ENTRY_MISSING',
      assetId: pictureId,
      entry: picture.relativePath,
    });
  });

  it('reports ASSET_ENTRY_UNLISTED', async () => {
    const bytes = buildArchive([...validParts(), { name: 'assets/extra.bin', data: encode('x') }]);
    expect(await failure(bytes)).toMatchObject({
      reason: 'ASSET_ENTRY_UNLISTED',
      entry: 'assets/extra.bin',
    });
  });

  it('reports CHECKSUM_MISMATCH when the bytes change but the size does not', async () => {
    const changed = flipByte(bundle.assets[pictureId]!, 0);
    const error = await failure(buildArchive(withPart(picture.relativePath, changed)));
    expect(error).toMatchObject({ reason: 'CHECKSUM_MISMATCH', assetId: pictureId });
  });

  it('reports SIZE_MISMATCH when the entry size differs from the manifest', async () => {
    const longer = new Uint8Array([...bundle.assets[pictureId]!, 1]);
    const error = await failure(buildArchive(withPart(picture.relativePath, longer)));
    expect(error).toMatchObject({ reason: 'SIZE_MISMATCH', assetId: pictureId });
  });

  it('reports CRYPTO_UNAVAILABLE when Web Crypto is missing', async () => {
    vi.stubGlobal('crypto', undefined);
    expect((await failure(buildArchive(validParts()))).reason).toBe('CRYPTO_UNAVAILABLE');
  });
});

describe('importProject project failures', () => {
  it('reports MANIFEST_STACK_MISMATCH for a different stack ID', async () => {
    const other = 'stk_00000000-0000-4000-8000-0000000000aa';
    const error = await failure(
      buildArchive(withPart('manifest.json', manifestOf({ stackId: other }))),
    );
    expect(error.reason).toBe('MANIFEST_STACK_MISMATCH');
  });

  it('reports MANIFEST_STACK_MISMATCH when the manifest lists fewer assets', async () => {
    const error = await failure(
      buildArchive([
        ...withPart('manifest.json', manifestOf({ assets: [picture] })).filter(
          (part) => part.name !== empty.relativePath,
        ),
      ]),
    );
    expect(error.reason).toBe('MANIFEST_STACK_MISMATCH');
  });

  it('reports PROJECT_INVALID with the validation errors', async () => {
    const dangling = 'crd_00000000-0000-4000-8000-0000000000ee';
    const error = await failure(
      buildArchive(withPart('stack.json', { ...stackFile, entryCardId: dangling })),
    );
    expect(error.reason).toBe('PROJECT_INVALID');
    expect(error.validationErrors?.map((e) => e.code)).toContain('ENTRY_CARD_NOT_FOUND');
  });
});

describe('importProject stack ID collisions', () => {
  const fresh = 'stk_11111111-1111-4111-8111-111111111111';

  it('keeps the stack ID when it is not taken', async () => {
    const result = await importProject(buildArchive(validParts()), {
      existingStackIds: new Set([fresh]),
    });
    expect(result.ok && result.value.stack.stackId).toBe(stack.stackId);
  });

  it('replaces only the stack ID on a collision', async () => {
    const newId = vi.fn(() => fresh);
    const result = await importProject(buildArchive(validParts()), {
      existingStackIds: new Set([stack.stackId]),
      newId,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(newId).toHaveBeenCalledWith('stk');
    expect(result.value.stack).toEqual({ ...stack, stackId: fresh });
  });

  it('retries until it finds an unused ID', async () => {
    const taken = 'stk_22222222-2222-4222-8222-222222222222';
    const ids = [stack.stackId, taken, fresh];
    const result = await importProject(buildArchive(validParts()), {
      existingStackIds: new Set([stack.stackId, taken]),
      newId: () => ids.shift() ?? stack.stackId,
    });
    expect(result.ok && result.value.stack.stackId).toBe(fresh);
  });

  it.each([
    ['always collides', () => stack.stackId],
    ['returns a malformed ID', () => 'not-an-id'],
  ])('reports STACK_ID_UNRESOLVED after 10 attempts when the generator %s', async (_l, make) => {
    const newId = vi.fn(make);
    const error = await failure(buildArchive(validParts()), {
      existingStackIds: new Set([stack.stackId]),
      newId,
    });
    expect(error.reason).toBe('STACK_ID_UNRESOLVED');
    expect(newId).toHaveBeenCalledTimes(10);
  });
});

describe('importProject totality', () => {
  it('never throws on truncated or corrupted archives and messages hold no content', async () => {
    const valid = buildArchive(validParts());
    const inputs: Uint8Array[] = [];
    for (let length = 0; length < valid.length; length += 17) {
      inputs.push(truncateArchive(valid, length));
    }
    for (let offset = 0; offset < valid.length; offset += 13) {
      inputs.push(flipByte(valid, offset));
    }
    for (const input of inputs) {
      const result = await importProject(input);
      if (!result.ok) {
        expect(result.error.code).toBe('PROJECT_IMPORT_FAILED');
        expect(result.error.message).not.toContain(stack.title);
      }
    }
  });
});
