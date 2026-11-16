import {
  CardSchema,
  ID_PATTERNS,
  StackSchema,
  err,
  generateId,
  ok,
  validateProject,
} from '@ghoststack/domain';
import type {
  Asset,
  Card,
  IdGenerator,
  ProjectBundle,
  Result,
  Stack,
  ValidationError,
} from '@ghoststack/domain';
import { sha256Checksum } from '../checksum';
import { GSP_LIMITS, SUPPORTED_FORMAT_VERSIONS } from '../limits';
import { ManifestSchema } from '../manifest';
import type { Manifest } from '../manifest';
import { MANIFEST_ENTRY, STACK_ENTRY, cardEntryName, scanEntries } from './entries';
import { createInflateBudget, inflateEntries } from './inflate';

export type ImportReason =
  | 'NOT_A_ZIP'
  | 'MANIFEST_MISSING'
  | 'MANIFEST_INVALID_JSON'
  | 'MANIFEST_INVALID_SCHEMA'
  | 'UNSUPPORTED_VERSION'
  | 'UNSAFE_ENTRY'
  | 'DUPLICATE_ENTRY'
  | 'ENTRY_SET_MISMATCH'
  | 'UNSUPPORTED_COMPRESSION'
  | 'LIMIT_EXCEEDED'
  | 'SIZE_MISMATCH'
  | 'RATIO_EXCEEDED'
  | 'ENTRY_INVALID_JSON'
  | 'ENTRY_INVALID_SCHEMA'
  | 'CHECKSUM_MISMATCH'
  | 'ASSET_ENTRY_MISSING'
  | 'ASSET_ENTRY_UNLISTED'
  | 'CARD_ENTRY_MISSING'
  | 'CARD_ENTRY_UNREFERENCED'
  | 'CARD_ENTRY_MISMATCH'
  | 'MANIFEST_STACK_MISMATCH'
  | 'PROJECT_INVALID'
  | 'STACK_ID_UNRESOLVED'
  | 'CRYPTO_UNAVAILABLE';

export interface ImportError {
  readonly code: 'PROJECT_IMPORT_FAILED';
  readonly reason: ImportReason;
  readonly message: string;
  readonly entry?: string;
  readonly assetId?: string;
  readonly limit?: 'archive-size' | 'entry-size' | 'total-size' | 'entry-count';
  readonly supportedVersions?: readonly number[];
  readonly archiveVersion?: number;
  readonly validationErrors?: readonly ValidationError[];
}

export interface ImportOptions {
  readonly existingStackIds?: ReadonlySet<string>;
  readonly newId?: IdGenerator;
}

const MAX_ID_ATTEMPTS = 10;
const CARD_PREFIX = 'cards/';

type StackFile = Omit<Stack, 'cards'>;
const StackFileSchema = StackSchema.omit({ cards: true });

function fail(
  reason: ImportReason,
  message: string,
  extra: Omit<ImportError, 'code' | 'reason' | 'message'> = {},
): Result<never, ImportError> {
  return err({ code: 'PROJECT_IMPORT_FAILED', reason, message, ...extra });
}

function forward(error: {
  readonly reason: ImportReason;
  readonly message: string;
  readonly entry?: string;
  readonly limit?: ImportError['limit'];
}): Result<never, ImportError> {
  const { reason, message, entry, limit } = error;
  return fail(reason, message, {
    ...(entry === undefined ? {} : { entry }),
    ...(limit === undefined ? {} : { limit }),
  });
}

type Parsed = { readonly ok: true; readonly value: unknown } | { readonly ok: false };

function parseJson(data: Uint8Array): Parsed {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(data);
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false };
  }
}

function peekVersion(value: unknown): Result<void, ImportError> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return ok(undefined);
  if (!Object.hasOwn(value, 'formatVersion')) return ok(undefined);
  const version = (value as Record<string, unknown>)['formatVersion'];
  if (version === 1) return ok(undefined);
  return fail('UNSUPPORTED_VERSION', 'The archive format version is not supported.', {
    supportedVersions: [...SUPPORTED_FORMAT_VERSIONS],
    ...(typeof version === 'number' ? { archiveVersion: version } : {}),
  });
}

function sameAsset(a: Asset, b: Asset): boolean {
  return (
    a.assetId === b.assetId &&
    a.relativePath === b.relativePath &&
    a.mimeType === b.mimeType &&
    a.byteSize === b.byteSize &&
    a.checksum === b.checksum
  );
}

function manifestMatchesStack(manifest: Manifest, stack: Stack): boolean {
  if (manifest.stackId !== stack.stackId) return false;
  const registry = stack.assetRegistry;
  const ids = new Set(manifest.assets.map((asset) => asset.assetId));
  if (ids.size !== manifest.assets.length) return false;
  if (Object.keys(registry).length !== ids.size) return false;
  return manifest.assets.every((asset) => {
    if (!Object.hasOwn(registry, asset.assetId)) return false;
    const registered = registry[asset.assetId];
    return registered !== undefined && sameAsset(asset, registered);
  });
}

function resolveStackId(stackId: string, options: ImportOptions): string | undefined {
  const existing = options.existingStackIds;
  if (existing === undefined || !existing.has(stackId)) return stackId;
  const newId = options.newId ?? generateId;
  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt += 1) {
    const candidate = newId('stk');
    if (ID_PATTERNS.stk.test(candidate) && !existing.has(candidate)) return candidate;
  }
  return undefined;
}

async function run(
  bytes: Uint8Array,
  options: ImportOptions,
): Promise<Result<ProjectBundle, ImportError>> {
  if (!(bytes instanceof Uint8Array) || bytes.length === 0) {
    return fail('NOT_A_ZIP', 'The file is not a readable ZIP archive.');
  }
  if (bytes.length > GSP_LIMITS.maxArchiveBytes) {
    return fail('LIMIT_EXCEEDED', 'The archive is larger than the archive size limit.', {
      limit: 'archive-size',
    });
  }

  const scanned = scanEntries(bytes);
  if (!scanned.ok) return forward(scanned.error);
  const entries = scanned.value;
  const names = new Set(entries.map((entry) => entry.name));
  const budget = createInflateBudget();

  const manifestRead = inflateEntries(bytes, entries, new Set([MANIFEST_ENTRY]), budget);
  if (!manifestRead.ok) return forward(manifestRead.error);
  const manifestJson = parseJson(manifestRead.value.get(MANIFEST_ENTRY) ?? new Uint8Array(0));
  if (!manifestJson.ok) {
    return fail('MANIFEST_INVALID_JSON', 'manifest.json is not valid UTF-8 JSON.', {
      entry: MANIFEST_ENTRY,
    });
  }
  const version = peekVersion(manifestJson.value);
  if (!version.ok) return version;
  const manifestParsed = ManifestSchema.safeParse(manifestJson.value);
  if (!manifestParsed.success) {
    return fail('MANIFEST_INVALID_SCHEMA', 'manifest.json does not match the manifest schema.', {
      entry: MANIFEST_ENTRY,
    });
  }
  const manifest = manifestParsed.data;

  const cardNames = [...names].filter((name) => name.startsWith(CARD_PREFIX)).sort();
  const contentRead = inflateEntries(bytes, entries, new Set([STACK_ENTRY, ...cardNames]), budget);
  if (!contentRead.ok) return forward(contentRead.error);

  const stackJson = parseJson(contentRead.value.get(STACK_ENTRY) ?? new Uint8Array(0));
  if (!stackJson.ok) {
    return fail('ENTRY_INVALID_JSON', 'stack.json is not valid UTF-8 JSON.', {
      entry: STACK_ENTRY,
    });
  }
  const stackParsed = StackFileSchema.safeParse(stackJson.value);
  if (!stackParsed.success) {
    return fail('ENTRY_INVALID_SCHEMA', 'stack.json does not match the stack schema.', {
      entry: STACK_ENTRY,
    });
  }
  const stackFile: StackFile = stackParsed.data;

  const cardFiles = new Map<string, Card>();
  for (const name of cardNames) {
    const json = parseJson(contentRead.value.get(name) ?? new Uint8Array(0));
    if (!json.ok) {
      return fail('ENTRY_INVALID_JSON', 'A card entry is not valid UTF-8 JSON.', { entry: name });
    }
    const card = CardSchema.safeParse(json.value);
    if (!card.success) {
      return fail('ENTRY_INVALID_SCHEMA', 'A card entry does not match the card schema.', {
        entry: name,
      });
    }
    cardFiles.set(name, card.data);
  }

  const listedPaths = new Set(manifest.assets.map((asset) => asset.relativePath));
  for (const asset of manifest.assets) {
    if (!names.has(asset.relativePath)) {
      return fail('ASSET_ENTRY_MISSING', 'A manifest asset has no entry in the archive.', {
        assetId: asset.assetId,
        entry: asset.relativePath,
      });
    }
  }
  for (const name of [...names].sort()) {
    if (name.startsWith('assets/') && !listedPaths.has(name)) {
      return fail('ASSET_ENTRY_UNLISTED', 'An asset entry is not listed in the manifest.', {
        entry: name,
      });
    }
  }
  for (const [name, card] of cardFiles) {
    if (name !== cardEntryName(card.cardId)) {
      return fail('CARD_ENTRY_MISMATCH', 'A card entry name differs from the card ID inside it.', {
        entry: name,
      });
    }
  }
  const ordered = new Set(stackFile.cardOrder);
  for (const cardId of stackFile.cardOrder) {
    if (!names.has(cardEntryName(cardId))) {
      return fail('CARD_ENTRY_MISSING', 'A card in cardOrder has no entry in the archive.', {
        entry: cardEntryName(cardId),
      });
    }
  }
  for (const name of cardNames) {
    const card = cardFiles.get(name);
    if (card === undefined || !ordered.has(card.cardId)) {
      return fail('CARD_ENTRY_UNREFERENCED', 'A card entry is not listed in cardOrder.', {
        entry: name,
      });
    }
  }

  const assetRead = inflateEntries(
    bytes,
    entries,
    new Set(manifest.assets.map((asset) => asset.relativePath)),
    budget,
  );
  if (!assetRead.ok) return forward(assetRead.error);
  const assets: [string, Uint8Array][] = [];
  for (const asset of manifest.assets) {
    const data = assetRead.value.get(asset.relativePath);
    if (data === undefined || data.length !== asset.byteSize) {
      return fail('SIZE_MISMATCH', 'An asset size differs from the manifest.', {
        assetId: asset.assetId,
        entry: asset.relativePath,
      });
    }
    const checksum = await sha256Checksum(data);
    if (!checksum.ok) return fail('CRYPTO_UNAVAILABLE', checksum.error.message);
    if (checksum.value !== asset.checksum) {
      return fail('CHECKSUM_MISMATCH', 'An asset checksum differs from the manifest.', {
        assetId: asset.assetId,
        entry: asset.relativePath,
      });
    }
    assets.push([asset.assetId, data]);
  }

  const stack: Stack = {
    ...stackFile,
    cards: Object.fromEntries([...cardFiles.values()].map((card) => [card.cardId, card])),
  };
  if (!manifestMatchesStack(manifest, stack)) {
    return fail('MANIFEST_STACK_MISMATCH', 'The manifest does not match stack.json.', {
      entry: MANIFEST_ENTRY,
    });
  }
  const validation = validateProject(stack);
  if (validation.errors.length > 0) {
    return fail('PROJECT_INVALID', 'The project in the archive is not valid.', {
      validationErrors: validation.errors,
    });
  }

  const stackId = resolveStackId(stack.stackId, options);
  if (stackId === undefined) {
    return fail('STACK_ID_UNRESOLVED', 'No unused stack ID could be generated.');
  }
  return ok({ stack: { ...stack, stackId }, assets: Object.fromEntries(assets) });
}

/** Total: every failure is a `PROJECT_IMPORT_FAILED` result, never an exception. */
export async function importProject(
  bytes: Uint8Array,
  options: ImportOptions = {},
): Promise<Result<ProjectBundle, ImportError>> {
  try {
    return await run(bytes, options);
  } catch {
    return fail('NOT_A_ZIP', 'The archive could not be imported.');
  }
}
