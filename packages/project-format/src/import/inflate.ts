import { err, ok } from '@ghoststack/domain';
import type { Result } from '@ghoststack/domain';
import { Unzip, UnzipInflate, UnzipPassThrough } from 'fflate';
import { GSP_LIMITS } from '../limits';
import type { ArchiveEntry } from './entries';

export type InflateReason = 'NOT_A_ZIP' | 'ENTRY_SET_MISMATCH' | 'LIMIT_EXCEEDED' | 'SIZE_MISMATCH';

export interface InflateError {
  readonly reason: InflateReason;
  readonly message: string;
  readonly entry?: string;
  readonly limit?: 'entry-size' | 'total-size';
}

/** Running total of inflated bytes, shared by every `inflateEntries` call of one import. */
export interface InflateBudget {
  readonly maxTotalBytes: number;
  usedBytes: number;
}

export function createInflateBudget(
  maxTotalBytes: number = GSP_LIMITS.maxTotalBytes,
): InflateBudget {
  return { maxTotalBytes, usedBytes: 0 };
}

function concat(chunks: readonly Uint8Array[], length: number): Uint8Array {
  const out = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/**
 * Inflates the `wanted` entries by streaming 16 KiB slices and counting real output.
 * `entries` is the validated central directory; local headers must agree with it.
 */
export function inflateEntries(
  bytes: Uint8Array,
  entries: readonly ArchiveEntry[],
  wanted: ReadonlySet<string>,
  budget: InflateBudget,
): Result<ReadonlyMap<string, Uint8Array>, InflateError> {
  const declared = new Map(entries.map((entry) => [entry.name, entry]));
  const seen = new Set<string>();
  const results = new Map<string, Uint8Array>();
  const state: { failure?: InflateError } = {};

  const unzip = new Unzip();
  unzip.register(UnzipInflate);
  unzip.register(UnzipPassThrough);

  unzip.onfile = (file) => {
    if (state.failure !== undefined) return;
    const meta = declared.get(file.name);
    if (
      meta === undefined ||
      seen.has(file.name) ||
      (file.size !== undefined && file.size !== meta.compressedSize)
    ) {
      state.failure = {
        reason: 'ENTRY_SET_MISMATCH',
        message: 'A local entry does not match the central directory.',
        entry: file.name,
      };
      return;
    }
    seen.add(file.name);
    if (!wanted.has(file.name)) return;

    const chunks: Uint8Array[] = [];
    let count = 0;
    file.ondata = (error, data, final) => {
      if (state.failure !== undefined) return;
      if (error !== null) {
        state.failure = {
          reason: 'NOT_A_ZIP',
          message: 'An entry could not be inflated.',
          entry: file.name,
        };
        return;
      }
      count += data.length;
      budget.usedBytes += data.length;
      if (count > GSP_LIMITS.maxEntryBytes) {
        state.failure = {
          reason: 'LIMIT_EXCEEDED',
          message: 'An entry is larger than the entry size limit.',
          entry: file.name,
          limit: 'entry-size',
        };
      } else if (budget.usedBytes > budget.maxTotalBytes) {
        state.failure = {
          reason: 'LIMIT_EXCEEDED',
          message: 'The entries are larger than the total size limit.',
          entry: file.name,
          limit: 'total-size',
        };
      } else if (count > meta.originalSize || (final && count !== meta.originalSize)) {
        state.failure = {
          reason: 'SIZE_MISMATCH',
          message: 'An entry size differs from its declared size.',
          entry: file.name,
        };
      }
      if (state.failure !== undefined) {
        file.terminate();
        return;
      }
      chunks.push(data);
      if (final) results.set(file.name, concat(chunks, count));
    };
    file.start();
  };

  try {
    const chunkBytes = GSP_LIMITS.inflateChunkBytes;
    if (bytes.length === 0) unzip.push(bytes, true);
    for (
      let offset = 0;
      offset < bytes.length && state.failure === undefined;
      offset += chunkBytes
    ) {
      const end = Math.min(offset + chunkBytes, bytes.length);
      unzip.push(bytes.subarray(offset, end), end === bytes.length);
    }
  } catch {
    state.failure ??= { reason: 'NOT_A_ZIP', message: 'The archive could not be read.' };
  }
  if (state.failure !== undefined) return err(state.failure);

  for (const name of declared.keys()) {
    if (!seen.has(name)) {
      return err({
        reason: 'ENTRY_SET_MISMATCH',
        message: 'A central directory entry has no local entry.',
        entry: name,
      });
    }
  }
  for (const name of wanted) {
    if (!results.has(name)) {
      return err({
        reason: 'SIZE_MISMATCH',
        message: 'An entry ended before its data was complete.',
        entry: name,
      });
    }
  }
  return ok(results);
}
