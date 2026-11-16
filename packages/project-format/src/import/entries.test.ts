import { describe, expect, it } from 'vitest';
import { GSP_LIMITS } from '../limits';
import {
  buildArchive,
  buildArchiveWithDuplicateName,
  buildZeroFilledArchive,
  patchDeclaredSizes,
  readEntryHeaders,
} from '../testing/archive';
import type { ArchivePart } from '../testing/archive';
import { checkEntryRules, readEntryMetadata, scanEntries } from './entries';

const encode = (text: string): Uint8Array => new TextEncoder().encode(text);
const CARD = 'cards/crd_00000000-0000-4000-8000-000000000001.json';

const baseParts: ArchivePart[] = [
  { name: 'manifest.json', data: encode('{}') },
  { name: 'stack.json', data: encode('{}') },
];

function failure(bytes: Uint8Array): { reason: string; entry?: string; limit?: string } {
  const result = scanEntries(bytes);
  if (result.ok) throw new Error('Expected the scan to fail');
  return result.error;
}

describe('scanEntries', () => {
  it('accepts a well-formed archive and reports declared metadata', () => {
    const bytes = buildArchive([
      ...baseParts,
      { name: CARD, data: encode('{}') },
      { name: 'assets/picture.bin', data: Uint8Array.from([1, 2, 3]), level: 0 },
    ]);
    const result = scanEntries(bytes);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.map((entry) => entry.name)).toEqual([
      'manifest.json',
      'stack.json',
      CARD,
      'assets/picture.bin',
    ]);
    expect(result.value[3]).toMatchObject({ originalSize: 3, compression: 0 });
  });

  it.each([
    ['path traversal', 'cards/../manifest.json'],
    ['absolute path', '/etc/passwd'],
    ['drive letter', 'C:/windows.json'],
    ['backslash', 'assets\\evil.bin'],
    ['null character', 'assets/a\u0000.bin'],
    ['directory entry', 'assets/'],
    ['unknown location', 'notes/readme.txt'],
    ['unknown root file', 'extra.json'],
    ['card name that is not an id', 'cards/first.json'],
    ['asset in a subfolder', 'assets/sub/file.bin'],
    ['asset with a space', 'assets/my file.bin'],
  ])('rejects %s as UNSAFE_ENTRY', (_label, name) => {
    const error = failure(buildArchive([...baseParts, { name, data: encode('x') }]));
    expect(error).toMatchObject({ reason: 'UNSAFE_ENTRY', entry: name });
  });

  it('rejects a duplicate entry name', () => {
    const bytes = buildArchiveWithDuplicateName(
      { data: encode('{}') },
      { data: encode('{"a":1}') },
      'stack.json',
      [{ name: 'manifest.json', data: encode('{}') }],
    );
    expect(failure(bytes)).toMatchObject({ reason: 'DUPLICATE_ENTRY', entry: 'stack.json' });
  });

  it('rejects more entries than the count limit', () => {
    const parts: ArchivePart[] = [...baseParts];
    for (let index = 0; parts.length <= GSP_LIMITS.maxEntries; index += 1) {
      parts.push({ name: `assets/a${index}.bin`, data: new Uint8Array(0), level: 0 });
    }
    expect(failure(buildArchive(parts))).toMatchObject({
      reason: 'LIMIT_EXCEEDED',
      limit: 'entry-count',
    });
  });

  it('rejects a declared size above the entry cap', () => {
    const bytes = patchDeclaredSizes(buildArchive(baseParts), 1, {
      uncompressedSize: GSP_LIMITS.maxEntryBytes + 1,
    });
    expect(failure(bytes)).toMatchObject({
      reason: 'LIMIT_EXCEEDED',
      limit: 'entry-size',
      entry: 'stack.json',
    });
  });

  it('rejects declared sizes that add up above the total cap', () => {
    let bytes = buildArchive([
      ...baseParts,
      { name: 'assets/a.bin', data: encode('x'), level: 0 },
      { name: 'assets/b.bin', data: encode('x'), level: 0 },
      { name: 'assets/c.bin', data: encode('x'), level: 0 },
    ]);
    for (let index = 0; index < 5; index += 1) {
      bytes = patchDeclaredSizes(bytes, index, {
        compressedSize: 22_000_000,
        uncompressedSize: 22_000_000,
      });
    }
    expect(failure(bytes)).toMatchObject({ reason: 'LIMIT_EXCEEDED', limit: 'total-size' });
  });

  it('rejects a ratio bomb from 1 MiB', () => {
    const bomb = buildZeroFilledArchive('assets/zeros.bin', GSP_LIMITS.ratioMinEntryBytes);
    expect(failure(bomb)).toMatchObject({ reason: 'RATIO_EXCEEDED', entry: 'assets/zeros.bin' });
  });

  it('allows a compressible entry below 1 MiB', () => {
    const bytes = buildArchive([
      ...baseParts,
      { name: 'assets/zeros.bin', data: new Uint8Array(GSP_LIMITS.ratioMinEntryBytes - 1) },
    ]);
    expect(scanEntries(bytes).ok).toBe(true);
  });

  it('rejects an unsupported compression method', () => {
    const archive = buildArchive(baseParts);
    const [first] = readEntryHeaders(archive);
    const patched = archive.slice();
    new DataView(patched.buffer).setUint16(first!.centralOffset + 10, 14, true);
    expect(failure(patched)).toMatchObject({
      reason: 'UNSUPPORTED_COMPRESSION',
      entry: 'manifest.json',
    });
  });

  it('requires manifest.json and stack.json', () => {
    expect(failure(buildArchive([baseParts[1]!]))).toMatchObject({ reason: 'MANIFEST_MISSING' });
    expect(failure(buildArchive([baseParts[0]!]))).toMatchObject({
      reason: 'ENTRY_SET_MISMATCH',
      entry: 'stack.json',
    });
  });

  it('reports NOT_A_ZIP for empty, short and random input', () => {
    expect(failure(new Uint8Array(0)).reason).toBe('NOT_A_ZIP');
    expect(failure(Uint8Array.from([1, 2, 3, 4, 5])).reason).toBe('NOT_A_ZIP');
    expect(failure(buildArchive(baseParts).slice(0, 40)).reason).toBe('NOT_A_ZIP');
  });

  it('reads metadata without inflating entry data', () => {
    const archive = buildArchive([
      ...baseParts,
      { name: 'assets/a.bin', data: encode('aaaaaaaa') },
    ]);
    const [, , asset] = readEntryHeaders(archive);
    const localExtra = new DataView(archive.buffer).getUint16(asset!.localOffset + 28, true);
    const dataStart = asset!.localOffset + 30 + 'assets/a.bin'.length + localExtra;
    const corrupt = archive.slice();
    corrupt.fill(0xff, dataStart, dataStart + 4);

    const result = scanEntries(corrupt);
    expect(result.ok).toBe(true);
    expect(readEntryMetadata(corrupt).ok).toBe(true);
  });
});

describe('checkEntryRules', () => {
  it('returns the entries unchanged when every rule passes', () => {
    const entries = [
      { name: 'manifest.json', compressedSize: 2, originalSize: 2, compression: 8 },
      { name: 'stack.json', compressedSize: 2, originalSize: 2, compression: 0 },
    ];
    const result = checkEntryRules(entries);
    expect(result).toEqual({ ok: true, value: entries });
  });
});
