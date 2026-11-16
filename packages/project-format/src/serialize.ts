import { err, ok, validateProject } from '@ghoststack/domain';
import type { ProjectBundle, Result, Stack, ValidationError } from '@ghoststack/domain';
import { zipSync } from 'fflate';
import type { Zippable } from 'fflate';
import { canonicalJson } from './canonicalJson';
import { sha256Checksum } from './checksum';
import { cardEntryName, MANIFEST_ENTRY, STACK_ENTRY } from './import/entries';
import { importProject } from './import/importProject';
import type { ImportError } from './import/importProject';
import { FIXED_ZIP_TIME, GSP_LIMITS } from './limits';
import type { Manifest } from './manifest';

export type ExportReason =
  | 'VALIDATION_FAILED'
  | 'ASSET_BYTES_MISSING'
  | 'ASSET_INCONSISTENT'
  | 'LIMIT_EXCEEDED'
  | 'CRYPTO_UNAVAILABLE'
  | 'REOPEN_FAILED';

export interface ExportError {
  readonly code: 'PROJECT_EXPORT_FAILED';
  readonly reason: ExportReason;
  readonly message: string;
  readonly assetId?: string;
  readonly validationErrors?: readonly ValidationError[];
  readonly importErrors?: readonly ImportError[];
}

const PRODUCER = 'ghoststack-web';
const encoder = new TextEncoder();

function fail(
  reason: ExportReason,
  message: string,
  extra: Omit<ExportError, 'code' | 'reason' | 'message'> = {},
): Result<never, ExportError> {
  return err({ code: 'PROJECT_EXPORT_FAILED', reason, message, ...extra });
}

const byCodeUnit = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

async function run(bundle: ProjectBundle): Promise<Result<Uint8Array, ExportError>> {
  const { stack, assets } = bundle;
  const validation = validateProject(stack);
  if (validation.errors.length > 0) {
    return fail('VALIDATION_FAILED', 'The project is not valid and cannot be exported.', {
      validationErrors: validation.errors,
    });
  }
  const registered = Object.values(stack.assetRegistry).sort((a, b) =>
    byCodeUnit(a.assetId, b.assetId),
  );
  for (const asset of registered) {
    const data = Object.hasOwn(assets, asset.assetId) ? assets[asset.assetId] : undefined;
    if (data === undefined) {
      return fail('ASSET_BYTES_MISSING', 'A registered asset has no bytes.', {
        assetId: asset.assetId,
      });
    }
    if (data.length !== asset.byteSize) {
      return fail('ASSET_INCONSISTENT', 'Asset bytes differ in size from the registry.', {
        assetId: asset.assetId,
      });
    }
    const checksum = await sha256Checksum(data);
    if (!checksum.ok) return fail('CRYPTO_UNAVAILABLE', checksum.error.message);
    if (checksum.value !== asset.checksum) {
      return fail('ASSET_INCONSISTENT', 'Asset bytes differ in checksum from the registry.', {
        assetId: asset.assetId,
      });
    }
  }

  const cardIds = Object.keys(stack.cards).sort(byCodeUnit);
  const stackFile = Object.fromEntries(Object.entries(stack).filter(([key]) => key !== 'cards'));
  const manifest: Manifest = {
    formatVersion: 1,
    producer: PRODUCER,
    stackId: stack.stackId,
    assets: registered.map((asset) => ({
      assetId: asset.assetId,
      relativePath: asset.relativePath,
      mimeType: asset.mimeType,
      byteSize: asset.byteSize,
      checksum: asset.checksum,
    })),
  };
  const jsonEntries: [string, Uint8Array][] = [
    [MANIFEST_ENTRY, encoder.encode(canonicalJson(manifest))],
    [STACK_ENTRY, encoder.encode(canonicalJson(stackFile))],
    ...cardIds.map((id): [string, Uint8Array] => [
      cardEntryName(id),
      encoder.encode(canonicalJson(stack.cards[id])),
    ]),
  ];
  const assetEntries = [...registered]
    .sort((a, b) => byCodeUnit(a.relativePath, b.relativePath))
    .map((asset): [string, Uint8Array] => [asset.relativePath, assets[asset.assetId]!]);

  const allEntries = [...jsonEntries, ...assetEntries];
  const total = allEntries.reduce((sum, [, data]) => sum + data.length, 0);
  if (
    allEntries.length > GSP_LIMITS.maxEntries ||
    allEntries.some(([, data]) => data.length > GSP_LIMITS.maxEntryBytes) ||
    total > GSP_LIMITS.maxTotalBytes
  ) {
    return fail('LIMIT_EXCEEDED', 'The project is too large to export.');
  }

  const files: Zippable = {};
  for (const [name, data] of jsonEntries) files[name] = [data, { level: 6, mtime: FIXED_ZIP_TIME }];
  for (const [name, data] of assetEntries)
    files[name] = [data, { level: 0, mtime: FIXED_ZIP_TIME }];
  const archive = zipSync(files);
  if (archive.length > GSP_LIMITS.maxArchiveBytes) {
    return fail('LIMIT_EXCEEDED', 'The exported archive is larger than the archive size limit.');
  }

  const reopened = await importProject(archive, { existingStackIds: new Set() });
  if (!reopened.ok) {
    return fail('REOPEN_FAILED', 'The exported archive could not be read back.', {
      importErrors: [reopened.error],
    });
  }
  if (!sameProject(stack, reopened.value.stack) || !sameAssets(bundle, reopened.value.assets)) {
    return fail('REOPEN_FAILED', 'The exported archive does not match the project.');
  }
  return ok(archive);
}

function sameProject(input: Stack, output: Stack): boolean {
  return canonicalJson(input) === canonicalJson(output);
}

function sameAssets(input: ProjectBundle, output: ProjectBundle['assets']): boolean {
  const ids = Object.keys(input.stack.assetRegistry);
  if (Object.keys(output).length !== ids.length) return false;
  return ids.every((id) => {
    const expected = input.assets[id];
    const actual = Object.hasOwn(output, id) ? output[id] : undefined;
    return expected !== undefined && actual !== undefined && sameBytes(expected, actual);
  });
}

/** Total: every failure is a `PROJECT_EXPORT_FAILED` result and no archive is returned. */
export async function serializeProject(
  bundle: ProjectBundle,
): Promise<Result<Uint8Array, ExportError>> {
  try {
    return await run(bundle);
  } catch {
    return fail('REOPEN_FAILED', 'The project could not be exported.');
  }
}
