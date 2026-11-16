import { zipSync } from 'fflate';
import type { ZipOptions } from 'fflate';
import { describe, expect, it } from 'vitest';
import { FIXED_ZIP_TIME, GSP_LIMITS } from './limits';

const MIB = 1_048_576;

describe('GSP_LIMITS', () => {
  it('holds the values approved in T-020', () => {
    expect(GSP_LIMITS).toMatchObject({
      maxArchiveBytes: 50 * MIB,
      maxEntryBytes: 25 * MIB,
      maxTotalBytes: 100 * MIB,
      maxEntries: 1000,
      maxRatio: 100,
      ratioMinEntryBytes: MIB,
    });
  });
});

describe('FIXED_ZIP_TIME', () => {
  it('is 1980-01-01 00:00:00 in local time', () => {
    expect([
      FIXED_ZIP_TIME.getFullYear(),
      FIXED_ZIP_TIME.getMonth(),
      FIXED_ZIP_TIME.getDate(),
      FIXED_ZIP_TIME.getHours(),
      FIXED_ZIP_TIME.getMinutes(),
      FIXED_ZIP_TIME.getSeconds(),
    ]).toEqual([1980, 0, 1, 0, 0, 0]);
  });

  it('is accepted by zipSync and writes DOS time 00:00:00 on 1980-01-01', () => {
    const entry: [Uint8Array, ZipOptions] = [new Uint8Array([1, 2, 3]), { mtime: FIXED_ZIP_TIME }];
    const files = { 'a.txt': entry };
    const archive = zipSync(files);
    const header = new DataView(archive.buffer, archive.byteOffset);
    expect(header.getUint32(0, true)).toBe(0x04034b50);
    expect(header.getUint16(10, true)).toBe(0);
    expect(header.getUint16(12, true)).toBe(0x0021);
    expect(Array.from(zipSync(files))).toEqual(Array.from(archive));
  });
});
