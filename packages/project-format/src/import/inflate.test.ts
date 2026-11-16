import { describe, expect, it } from 'vitest';
import { GSP_LIMITS } from '../limits';
import { buildArchive, buildZeroFilledArchive, patchDeclaredSizes } from '../testing/archive';
import type { ArchivePart } from '../testing/archive';
import { readEntryMetadata } from './entries';
import type { ArchiveEntry } from './entries';
import { createInflateBudget, inflateEntries } from './inflate';

const encode = (text: string): Uint8Array => new TextEncoder().encode(text);

const baseParts: ArchivePart[] = [
  { name: 'manifest.json', data: encode('{"a":1}') },
  { name: 'stack.json', data: encode('{"b":2}') },
];

function metadata(bytes: Uint8Array): readonly ArchiveEntry[] {
  const result = readEntryMetadata(bytes);
  if (!result.ok) throw new Error('Expected readable metadata');
  return result.value;
}

function inflate(bytes: Uint8Array, wanted: string[], budget = createInflateBudget()) {
  return inflateEntries(bytes, metadata(bytes), new Set(wanted), budget);
}

function failure(result: ReturnType<typeof inflate>): { reason: string; limit?: string } {
  if (result.ok) throw new Error('Expected inflation to fail');
  return result.error;
}

describe('inflateEntries', () => {
  it('returns the bytes of the wanted entries only', () => {
    const picture = Uint8Array.from([9, 8, 7, 6]);
    const bytes = buildArchive([
      ...baseParts,
      { name: 'assets/picture.bin', data: picture, level: 0 },
      { name: 'assets/empty.bin', data: new Uint8Array(0), level: 0 },
    ]);
    const budget = createInflateBudget();
    const result = inflate(
      bytes,
      ['manifest.json', 'assets/picture.bin', 'assets/empty.bin'],
      budget,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect([...result.value.keys()].sort()).toEqual([
      'assets/empty.bin',
      'assets/picture.bin',
      'manifest.json',
    ]);
    expect(new TextDecoder().decode(result.value.get('manifest.json'))).toBe('{"a":1}');
    expect(result.value.get('assets/picture.bin')).toEqual(picture);
    expect(result.value.get('assets/empty.bin')).toEqual(new Uint8Array(0));
    expect(budget.usedBytes).toBe(7 + 4);
  });

  it('inflates an entry spanning many 16 KiB input slices', () => {
    const data = new Uint8Array(200_000).map((_value, index) => (index * 31 + (index >> 8)) & 0xff);
    const bytes = buildArchive([...baseParts, { name: 'assets/big.bin', data }]);
    const result = inflate(bytes, ['assets/big.bin']);
    expect(result.ok && result.value.get('assets/big.bin')).toEqual(data);
  });

  it('reports SIZE_MISMATCH when the declared size is smaller than the real size', () => {
    const data = new Uint8Array(100_000).fill(7);
    const archive = buildArchive([...baseParts, { name: 'assets/a.bin', data, level: 0 }]);
    const lying = patchDeclaredSizes(archive, 2, { uncompressedSize: 100 }, 'central');
    const budget = createInflateBudget();
    const result = inflate(lying, ['assets/a.bin'], budget);
    expect(failure(result).reason).toBe('SIZE_MISMATCH');
    expect(budget.usedBytes).toBeLessThanOrEqual(GSP_LIMITS.inflateChunkBytes);
  });

  it('reports SIZE_MISMATCH when the declared size is larger than the real size', () => {
    const archive = buildArchive([...baseParts, { name: 'assets/a.bin', data: encode('abcd') }]);
    const lying = patchDeclaredSizes(archive, 2, { uncompressedSize: 5000 }, 'central');
    expect(failure(inflate(lying, ['assets/a.bin'])).reason).toBe('SIZE_MISMATCH');
  });

  it('stops at the entry cap when the real size exceeds a declared size at the cap', () => {
    const archive = buildZeroFilledArchive('assets/zeros.bin', GSP_LIMITS.maxEntryBytes + 1);
    const lying = patchDeclaredSizes(archive, 0, { uncompressedSize: GSP_LIMITS.maxEntryBytes });
    const result = inflate(lying, ['assets/zeros.bin']);
    expect(failure(result)).toMatchObject({ reason: 'LIMIT_EXCEEDED', limit: 'entry-size' });
  });

  it('stops early when a tiny declared size hides a very large entry', () => {
    const archive = buildZeroFilledArchive('assets/zeros.bin', GSP_LIMITS.maxEntryBytes + 1);
    const lying = patchDeclaredSizes(archive, 0, { uncompressedSize: 100 });
    const budget = createInflateBudget();
    expect(failure(inflate(lying, ['assets/zeros.bin'], budget)).reason).toBe('SIZE_MISMATCH');
    expect(budget.usedBytes).toBeLessThan(GSP_LIMITS.maxEntryBytes);
  });

  it('stops at the total budget across calls', () => {
    const bytes = buildArchive([
      ...baseParts,
      { name: 'assets/a.bin', data: new Uint8Array(3000).fill(1), level: 0 },
    ]);
    const budget = createInflateBudget(1000);
    const result = inflate(bytes, ['assets/a.bin'], budget);
    expect(failure(result)).toMatchObject({ reason: 'LIMIT_EXCEEDED', limit: 'total-size' });

    const shared = createInflateBudget(10);
    expect(inflate(bytes, ['manifest.json'], shared).ok).toBe(true);
    expect(failure(inflate(bytes, ['stack.json'], shared)).limit).toBe('total-size');
  });

  it('terminates on overrun without reading the rest of the entry', () => {
    const archive = buildArchive([
      ...baseParts,
      { name: 'assets/a.bin', data: new Uint8Array(1_000_000).fill(5), level: 0 },
    ]);
    const lying = patchDeclaredSizes(archive, 2, { uncompressedSize: 10 }, 'central');
    const budget = createInflateBudget();
    expect(failure(inflate(lying, ['assets/a.bin'], budget)).reason).toBe('SIZE_MISMATCH');
    expect(budget.usedBytes).toBeLessThanOrEqual(GSP_LIMITS.inflateChunkBytes);
  });

  it('reports ENTRY_SET_MISMATCH for a local entry missing from the central directory', () => {
    const bytes = buildArchive(baseParts);
    const partial = metadata(bytes).filter((entry) => entry.name !== 'stack.json');
    const result = inflateEntries(
      bytes,
      partial,
      new Set(['manifest.json']),
      createInflateBudget(),
    );
    expect(failure(result).reason).toBe('ENTRY_SET_MISMATCH');
  });

  it('reports ENTRY_SET_MISMATCH for a central entry with no local entry', () => {
    const bytes = buildArchive(baseParts);
    const extra: ArchiveEntry = {
      name: 'assets/ghost.bin',
      compressedSize: 1,
      originalSize: 1,
      compression: 0,
    };
    const result = inflateEntries(
      bytes,
      [...metadata(bytes), extra],
      new Set(['manifest.json']),
      createInflateBudget(),
    );
    expect(failure(result).reason).toBe('ENTRY_SET_MISMATCH');
  });

  it('reports ENTRY_SET_MISMATCH when local and central compressed sizes differ', () => {
    const archive = buildArchive(baseParts);
    const lying = patchDeclaredSizes(archive, 0, { compressedSize: 999 }, 'central');
    expect(failure(inflate(lying, ['manifest.json'])).reason).toBe('ENTRY_SET_MISMATCH');
  });

  it('reports NOT_A_ZIP for a corrupt deflate stream', () => {
    const bytes = buildArchive(baseParts);
    const corrupt = bytes.slice();
    const view = new DataView(corrupt.buffer);
    const start = 30 + 'manifest.json'.length + view.getUint16(28, true);
    corrupt.fill(0xff, start, start + 4);
    expect(failure(inflate(corrupt, ['manifest.json'])).reason).toBe('NOT_A_ZIP');
  });
});
