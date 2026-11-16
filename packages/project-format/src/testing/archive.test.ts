import { unzipSync } from 'fflate';
import type { UnzipFileInfo } from 'fflate';
import { describe, expect, it } from 'vitest';
import { GSP_LIMITS } from '../limits';
import {
  buildArchive,
  buildArchiveWithDuplicateName,
  buildZeroFilledArchive,
  flipByte,
  patchDeclaredSizes,
  readEntryHeaders,
  renameEntry,
  truncateArchive,
} from './archive';

const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);

function scan(archive: Uint8Array): UnzipFileInfo[] {
  const infos: UnzipFileInfo[] = [];
  unzipSync(archive, {
    filter: (info) => {
      infos.push(info);
      return false;
    },
  });
  return infos;
}

describe('buildArchive', () => {
  it('writes the given names, including unsafe ones, and respects stored and deflated levels', () => {
    const names = ['../evil.json', '/abs', 'a\\b', 'nul\u0000.json', 'dir/'];
    const archive = buildArchive([
      ...names.map((name) => ({ name, data: new Uint8Array(0) })),
      { name: 'stored.txt', data: bytes('hello hello hello'), level: 0 },
      { name: 'deflated.txt', data: new Uint8Array(4096), level: 6 },
    ]);
    const infos = scan(archive);
    expect(infos.map((info) => info.name)).toEqual([...names, 'stored.txt', 'deflated.txt']);
    expect(infos.find((info) => info.name === 'stored.txt')?.compression).toBe(0);
    expect(infos.find((info) => info.name === 'deflated.txt')?.compression).toBe(8);
  });

  it('rejects repeated names', () => {
    const part = { name: 'a.json', data: bytes('{}') };
    expect(() => buildArchive([part, part])).toThrow(/unique/);
  });
});

describe('patchDeclaredSizes', () => {
  const base = buildArchive([{ name: 'a.txt', data: bytes('abcdefghij'), level: 0 }]);

  it('changes only the local header', () => {
    const [entry] = readEntryHeaders(patchDeclaredSizes(base, 0, { uncompressedSize: 3 }, 'local'));
    expect(entry?.local.uncompressedSize).toBe(3);
    expect(entry?.central.uncompressedSize).toBe(10);
  });

  it('changes only the central header, which unzipSync reports', () => {
    const patched = patchDeclaredSizes(
      base,
      0,
      { uncompressedSize: 3, compressedSize: 4 },
      'central',
    );
    const [entry] = readEntryHeaders(patched);
    expect(entry?.local).toEqual({ compressedSize: 10, uncompressedSize: 10 });
    expect(entry?.central).toEqual({ compressedSize: 4, uncompressedSize: 3 });
    expect(scan(patched)[0]).toMatchObject({ size: 4, originalSize: 3 });
  });

  it('changes both headers by default and leaves the input untouched', () => {
    const patched = patchDeclaredSizes(base, 0, { uncompressedSize: GSP_LIMITS.maxEntryBytes + 1 });
    const [entry] = readEntryHeaders(patched);
    expect(entry?.local.uncompressedSize).toBe(GSP_LIMITS.maxEntryBytes + 1);
    expect(entry?.central.uncompressedSize).toBe(GSP_LIMITS.maxEntryBytes + 1);
    expect(readEntryHeaders(base)[0]?.central.uncompressedSize).toBe(10);
  });

  it('rejects an entry index that does not exist', () => {
    expect(() => patchDeclaredSizes(base, 1, { uncompressedSize: 1 })).toThrow(/No entry/);
  });
});

describe('truncateArchive', () => {
  it('drops the end of central directory so the archive no longer parses', () => {
    const archive = buildArchive([{ name: 'a.txt', data: bytes('abc') }]);
    const cut = truncateArchive(archive, archive.byteLength - 10);
    expect(cut.byteLength).toBe(archive.byteLength - 10);
    expect(() => unzipSync(cut)).toThrow();
  });

  it('rejects a length beyond the archive', () => {
    expect(() => truncateArchive(new Uint8Array(4), 5)).toThrow(RangeError);
  });
});

describe('flipByte', () => {
  it('changes exactly one byte and keeps the input', () => {
    const archive = buildArchive([{ name: 'a.txt', data: bytes('abc'), level: 0 }]);
    const flipped = flipByte(archive, 0, 0x01);
    expect(flipped[0]).toBe((archive[0] ?? 0) ^ 0x01);
    expect(flipped.slice(1)).toEqual(archive.slice(1));
    expect(flipped).not.toBe(archive);
  });

  it('corrupts the signature so the archive no longer parses', () => {
    const archive = buildArchive([{ name: 'a.txt', data: bytes('abc') }]);
    const eocd = archive.byteLength - 22;
    expect(() => unzipSync(flipByte(archive, eocd))).toThrow();
  });

  it('rejects an offset outside the archive', () => {
    expect(() => flipByte(new Uint8Array(2), 2)).toThrow(RangeError);
  });
});

describe('renameEntry and buildArchiveWithDuplicateName', () => {
  it('renames in both headers when the byte length matches', () => {
    const archive = buildArchive([{ name: 'a.txt', data: bytes('abc') }]);
    expect(scan(renameEntry(archive, 0, 'b.txt')).map((info) => info.name)).toEqual(['b.txt']);
    expect(readEntryHeaders(renameEntry(archive, 0, 'b.txt'))[0]?.name).toBe('b.txt');
  });

  it('rejects a name with a different byte length', () => {
    const archive = buildArchive([{ name: 'a.txt', data: bytes('abc') }]);
    expect(() => renameEntry(archive, 0, 'longer.txt')).toThrow(/byte length/);
  });

  it('writes two entries with the same name and different content', () => {
    const archive = buildArchiveWithDuplicateName(
      { data: bytes('first') },
      { data: bytes('second') },
      'stack.json',
      [{ name: 'manifest.json', data: bytes('{}') }],
    );
    expect(scan(archive).map((info) => info.name)).toEqual([
      'stack.json',
      'stack.json',
      'manifest.json',
    ]);
    expect(readEntryHeaders(archive).map((entry) => entry.name)).toEqual([
      'stack.json',
      'stack.json',
      'manifest.json',
    ]);
  });

  it('picks a placeholder that differs from the duplicate name', () => {
    const archive = buildArchiveWithDuplicateName({ data: bytes('1') }, { data: bytes('2') }, 'xx');
    expect(scan(archive).map((info) => info.name)).toEqual(['xx', 'xx']);
  });
});

describe('buildZeroFilledArchive', () => {
  it('declares a real size above the per-entry cap in a small archive', () => {
    const size = GSP_LIMITS.maxEntryBytes + 1;
    const archive = buildZeroFilledArchive('assets/big.bin', size);
    const [info] = scan(archive);
    expect(info).toMatchObject({ name: 'assets/big.bin', originalSize: size, compression: 8 });
    expect(archive.byteLength).toBeLessThan(1_048_576);
    expect(info?.originalSize ?? 0).toBeGreaterThan(GSP_LIMITS.maxRatio * (info?.size ?? 0));
  });

  it('can lie about the declared size while the real size stays above the cap', () => {
    const archive = patchDeclaredSizes(
      buildZeroFilledArchive('big.bin', GSP_LIMITS.maxEntryBytes + 1),
      0,
      {
        uncompressedSize: 10,
      },
    );
    expect(scan(archive)[0]?.originalSize).toBe(10);
  });
});
