import { zipSync } from 'fflate';
import type { Zippable } from 'fflate';
import { FIXED_ZIP_TIME } from '../limits';

// Test-only helpers. Not exported from the package entry.

const LOCAL_SIGNATURE = 0x04034b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const EOCD_SIGNATURE = 0x06054b50;
const LOCAL_HEADER_BYTES = 30;
const CENTRAL_HEADER_BYTES = 46;
const EOCD_BYTES = 22;

export interface ArchivePart {
  readonly name: string;
  readonly data: Uint8Array;
  /** 0 stores the entry; 1 to 9 deflates it. Defaults to 6. */
  readonly level?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
}

export interface EntryHeaders {
  readonly name: string;
  readonly localOffset: number;
  readonly centralOffset: number;
  readonly method: number;
  readonly local: { readonly compressedSize: number; readonly uncompressedSize: number };
  readonly central: { readonly compressedSize: number; readonly uncompressedSize: number };
}

export type HeaderTarget = 'local' | 'central' | 'both';

const textEncoder = new TextEncoder();

function view(archive: Uint8Array): DataView {
  return new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
}

function toZippable(parts: readonly ArchivePart[]): Zippable {
  const files: Zippable = {};
  for (const part of parts) {
    files[part.name] = [part.data, { level: part.level ?? 6, mtime: FIXED_ZIP_TIME }];
  }
  return files;
}

/** Writes arbitrary entry names and bytes. Names must be unique; use `buildArchiveWithDuplicateName` otherwise. */
export function buildArchive(parts: readonly ArchivePart[]): Uint8Array {
  const names = new Set(parts.map((part) => part.name));
  if (names.size !== parts.length) {
    throw new Error('buildArchive requires unique names; use buildArchiveWithDuplicateName');
  }
  return zipSync(toZippable(parts));
}

/** Reads local and central header fields for every entry, in central directory order. */
export function readEntryHeaders(archive: Uint8Array): EntryHeaders[] {
  const data = view(archive);
  const eocd = archive.byteLength - EOCD_BYTES;
  if (eocd < 0 || data.getUint32(eocd, true) !== EOCD_SIGNATURE) {
    throw new Error('End of central directory not found at the expected offset');
  }
  const count = data.getUint16(eocd + 10, true);
  const decoder = new TextDecoder();
  const entries: EntryHeaders[] = [];
  let offset = data.getUint32(eocd + 16, true);
  for (let index = 0; index < count; index += 1) {
    if (data.getUint32(offset, true) !== CENTRAL_SIGNATURE) {
      throw new Error(`Central header ${index} has a bad signature`);
    }
    const nameLength = data.getUint16(offset + 28, true);
    const extraLength = data.getUint16(offset + 30, true);
    const commentLength = data.getUint16(offset + 32, true);
    const localOffset = data.getUint32(offset + 42, true);
    if (data.getUint32(localOffset, true) !== LOCAL_SIGNATURE) {
      throw new Error(`Local header ${index} has a bad signature`);
    }
    entries.push({
      name: decoder.decode(
        archive.subarray(offset + CENTRAL_HEADER_BYTES, offset + CENTRAL_HEADER_BYTES + nameLength),
      ),
      localOffset,
      centralOffset: offset,
      method: data.getUint16(offset + 10, true),
      local: {
        compressedSize: data.getUint32(localOffset + 18, true),
        uncompressedSize: data.getUint32(localOffset + 22, true),
      },
      central: {
        compressedSize: data.getUint32(offset + 20, true),
        uncompressedSize: data.getUint32(offset + 24, true),
      },
    });
    offset += CENTRAL_HEADER_BYTES + nameLength + extraLength + commentLength;
  }
  return entries;
}

function entryAt(archive: Uint8Array, index: number): EntryHeaders {
  const entry = readEntryHeaders(archive)[index];
  if (entry === undefined) {
    throw new Error(`No entry at index ${index}`);
  }
  return entry;
}

/** Returns a copy with the declared sizes of one entry replaced in the chosen header(s). */
export function patchDeclaredSizes(
  archive: Uint8Array,
  index: number,
  sizes: { readonly compressedSize?: number; readonly uncompressedSize?: number },
  target: HeaderTarget = 'both',
): Uint8Array {
  const entry = entryAt(archive, index);
  const copy = archive.slice();
  const data = view(copy);
  const headers: [number, number, number][] = [];
  if (target !== 'central') {
    headers.push([entry.localOffset, 18, 22]);
  }
  if (target !== 'local') {
    headers.push([entry.centralOffset, 20, 24]);
  }
  for (const [base, compressedAt, uncompressedAt] of headers) {
    if (sizes.compressedSize !== undefined) {
      data.setUint32(base + compressedAt, sizes.compressedSize, true);
    }
    if (sizes.uncompressedSize !== undefined) {
      data.setUint32(base + uncompressedAt, sizes.uncompressedSize, true);
    }
  }
  return copy;
}

/** Returns a copy cut to the first `length` bytes. */
export function truncateArchive(archive: Uint8Array, length: number): Uint8Array {
  if (length < 0 || length > archive.byteLength) {
    throw new RangeError(`Cannot truncate ${archive.byteLength} bytes to ${length}`);
  }
  return archive.slice(0, length);
}

/** Returns a copy with the byte at `offset` XOR-ed with `mask`. */
export function flipByte(archive: Uint8Array, offset: number, mask = 0xff): Uint8Array {
  if (offset < 0 || offset >= archive.byteLength) {
    throw new RangeError(`Offset ${offset} is outside ${archive.byteLength} bytes`);
  }
  const copy = archive.slice();
  copy[offset] = (copy[offset] ?? 0) ^ mask;
  return copy;
}

/** Returns a copy with one entry name replaced, in local and central headers. The UTF-8 length must not change. */
export function renameEntry(archive: Uint8Array, index: number, name: string): Uint8Array {
  const entry = entryAt(archive, index);
  const bytes = textEncoder.encode(name);
  const nameLength = textEncoder.encode(entry.name).byteLength;
  if (bytes.byteLength !== nameLength) {
    throw new Error('renameEntry requires a name with the same UTF-8 byte length');
  }
  const copy = archive.slice();
  copy.set(bytes, entry.localOffset + LOCAL_HEADER_BYTES);
  copy.set(bytes, entry.centralOffset + CENTRAL_HEADER_BYTES);
  return copy;
}

/** Builds an archive in which `first` and `second` share a name; every other part is kept in order. */
export function buildArchiveWithDuplicateName(
  first: Omit<ArchivePart, 'name'>,
  second: Omit<ArchivePart, 'name'>,
  name: string,
  others: readonly ArchivePart[] = [],
): Uint8Array {
  const length = textEncoder.encode(name).byteLength;
  if (length === 0) {
    throw new Error('Duplicate name must not be empty');
  }
  const placeholder = (name === 'x'.repeat(length) ? 'y' : 'x').repeat(length);
  const archive = buildArchive([{ ...first, name }, { ...second, name: placeholder }, ...others]);
  return renameEntry(archive, 1, name);
}

/**
 * One entry of `size` zero bytes. DEFLATE shrinks zeros to a few KiB, so the archive stays small
 * while the real size exceeds a cap and the ratio rule applies.
 */
export function buildZeroFilledArchive(
  name: string,
  size: number,
  level: ArchivePart['level'] = 6,
): Uint8Array {
  return buildArchive([{ name, data: new Uint8Array(size), level }]);
}
