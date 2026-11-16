import { ID_PATTERNS, assetPathViolation, err, ok } from '@ghoststack/domain';
import type { Result } from '@ghoststack/domain';
import { unzipSync } from 'fflate';
import { GSP_LIMITS } from '../limits';

export interface ArchiveEntry {
  readonly name: string;
  readonly compressedSize: number;
  readonly originalSize: number;
  readonly compression: number;
}

export type EntryRuleReason =
  | 'NOT_A_ZIP'
  | 'MANIFEST_MISSING'
  | 'ENTRY_SET_MISMATCH'
  | 'UNSAFE_ENTRY'
  | 'DUPLICATE_ENTRY'
  | 'UNSUPPORTED_COMPRESSION'
  | 'LIMIT_EXCEEDED'
  | 'RATIO_EXCEEDED';

export interface EntryRuleError {
  readonly reason: EntryRuleReason;
  readonly message: string;
  readonly entry?: string;
  readonly limit?: 'entry-size' | 'total-size' | 'entry-count';
}

export const MANIFEST_ENTRY = 'manifest.json';
export const STACK_ENTRY = 'stack.json';

const STORED = 0;
const DEFLATED = 8;

/** Reads the central directory only. The always-false filter keeps fflate from inflating anything. */
export function readEntryMetadata(
  bytes: Uint8Array,
): Result<readonly ArchiveEntry[], EntryRuleError> {
  const entries: ArchiveEntry[] = [];
  try {
    unzipSync(bytes, {
      filter: (info) => {
        entries.push({
          name: info.name,
          compressedSize: info.size,
          originalSize: info.originalSize,
          compression: info.compression,
        });
        return false;
      },
    });
  } catch {
    return err({ reason: 'NOT_A_ZIP', message: 'The file is not a readable ZIP archive.' });
  }
  return ok(entries);
}

const CARD_PREFIX = 'cards/';
const CARD_SUFFIX = '.json';

export function cardEntryName(cardId: string): string {
  return `${CARD_PREFIX}${cardId}${CARD_SUFFIX}`;
}

function isCardEntryName(name: string): boolean {
  return (
    name.startsWith(CARD_PREFIX) &&
    name.endsWith(CARD_SUFFIX) &&
    ID_PATTERNS.crd.test(name.slice(CARD_PREFIX.length, -CARD_SUFFIX.length))
  );
}

function isAllowedName(name: string): boolean {
  if (name === MANIFEST_ENTRY || name === STACK_ENTRY) return true;
  return (
    isCardEntryName(name) || (name.startsWith('assets/') && assetPathViolation(name) === undefined)
  );
}

/** Applies the entry rules to declared metadata. Nothing is inflated here. */
export function checkEntryRules(
  entries: readonly ArchiveEntry[],
): Result<readonly ArchiveEntry[], EntryRuleError> {
  if (entries.length > GSP_LIMITS.maxEntries) {
    return err({
      reason: 'LIMIT_EXCEEDED',
      message: 'The archive has too many entries.',
      limit: 'entry-count',
    });
  }

  const names = new Set<string>();
  for (const entry of entries) {
    if (!isAllowedName(entry.name)) {
      return err({
        reason: 'UNSAFE_ENTRY',
        message: 'The archive has an entry with a name that is not allowed.',
        entry: entry.name,
      });
    }
    if (names.has(entry.name)) {
      return err({
        reason: 'DUPLICATE_ENTRY',
        message: 'The archive has two entries with the same name.',
        entry: entry.name,
      });
    }
    names.add(entry.name);
  }

  for (const entry of entries) {
    if (entry.compression !== STORED && entry.compression !== DEFLATED) {
      return err({
        reason: 'UNSUPPORTED_COMPRESSION',
        message: 'The archive uses a compression method that is not supported.',
        entry: entry.name,
      });
    }
  }

  let total = 0;
  for (const entry of entries) {
    if (entry.originalSize > GSP_LIMITS.maxEntryBytes) {
      return err({
        reason: 'LIMIT_EXCEEDED',
        message: 'An entry is larger than the entry size limit.',
        entry: entry.name,
        limit: 'entry-size',
      });
    }
    total += entry.originalSize;
  }
  if (total > GSP_LIMITS.maxTotalBytes) {
    return err({
      reason: 'LIMIT_EXCEEDED',
      message: 'The entries are larger than the total size limit.',
      limit: 'total-size',
    });
  }

  for (const entry of entries) {
    if (
      entry.originalSize >= GSP_LIMITS.ratioMinEntryBytes &&
      entry.originalSize / Math.max(entry.compressedSize, 1) > GSP_LIMITS.maxRatio
    ) {
      return err({
        reason: 'RATIO_EXCEEDED',
        message: 'An entry expands by more than the allowed compression ratio.',
        entry: entry.name,
      });
    }
  }

  if (!names.has(MANIFEST_ENTRY)) {
    return err({
      reason: 'MANIFEST_MISSING',
      message: 'The archive has no manifest.json.',
      entry: MANIFEST_ENTRY,
    });
  }
  if (!names.has(STACK_ENTRY)) {
    return err({
      reason: 'ENTRY_SET_MISMATCH',
      message: 'The archive has no stack.json.',
      entry: STACK_ENTRY,
    });
  }
  return ok(entries);
}

/** Metadata scan followed by the entry rules. */
export function scanEntries(bytes: Uint8Array): Result<readonly ArchiveEntry[], EntryRuleError> {
  const scanned = readEntryMetadata(bytes);
  return scanned.ok ? checkEntryRules(scanned.value) : scanned;
}
