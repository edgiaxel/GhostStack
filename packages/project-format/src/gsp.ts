import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { z } from 'zod';
import {
  AssetSchema,
  CardSchema,
  FORMAT_VERSION,
  StackSchema,
  err,
  ok,
  type Card,
  type ErrorCode,
  type Result,
  type Stack,
} from '@ghoststack/shared-contracts';
import { validateStack } from '@ghoststack/domain';
import { sha256Hex } from './sha256';

export const GSP_LIMITS = {
  maxEntries: 5000,
  maxEntryBytes: 64 * 1024 * 1024,
  maxTotalBytes: 256 * 1024 * 1024,
  maxJsonBytes: 8 * 1024 * 1024,
} as const;

const StackFileSchema = StackSchema.omit({ cards: true });

const ManifestSchema = z.object({
  formatVersion: z.number().int(),
  stackId: z.string().min(1),
  title: z.string(),
  cards: z.array(z.object({ cardId: z.string().min(1), path: z.string().min(1) })),
  assets: z.array(AssetSchema.extend({ path: z.string().min(1) })),
});
type Manifest = z.infer<typeof ManifestSchema>;

class FormatError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const fail = (code: ErrorCode, message: string): never => {
  throw new FormatError(code, message);
};

/** Rejects absolute paths, backslashes, `.`/`..`/empty segments, drive letters and control chars. */
export function checkEntryName(name: string, code: ErrorCode): void {
  const bad =
    name.length === 0 ||
    name.startsWith('/') ||
    name.includes('\\') ||
    name.includes(':') ||
    // eslint-disable-next-line no-control-regex
    /[\u0000-\u001f]/.test(name) ||
    name
      .replace(/\/$/, '')
      .split('/')
      .some((s) => s === '' || s === '.' || s === '..');
  if (bad) fail(code, `Unsafe archive entry name: ${JSON.stringify(name)}`);
}

const cardPath = (cardId: string): string => `cards/${cardId}.json`;
const assetPath = (relativePath: string): string => `assets/${relativePath}`;

const toJson = (v: unknown): Uint8Array => strToU8(JSON.stringify(v));

function parseJson<S extends z.ZodType>(
  files: Record<string, Uint8Array>,
  name: string,
  schema: S,
  code: ErrorCode,
): z.infer<S> {
  const raw = files[name];
  if (!raw) return fail(code, `Archive is missing ${name}`);
  let json: unknown;
  try {
    json = JSON.parse(strFromU8(raw));
  } catch {
    return fail(code, `${name} is not valid JSON`);
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(code, `${name} is invalid: ${issue?.path.join('.') ?? ''} ${issue?.message ?? ''}`);
  }
  return parsed.data;
}

function guard<T>(code: ErrorCode, fallback: string, fn: () => T): Result<T> {
  try {
    return ok(fn());
  } catch (e) {
    if (e instanceof FormatError) return err({ code: e.code, message: e.message });
    return err({ code, message: `${fallback}: ${e instanceof Error ? e.message : String(e)}` });
  }
}

/**
 * Serialises a Stack and its asset bytes into a `.gsp` ZIP archive.
 * Every asset in `stack.assetRegistry` must be supplied in `assets` (keyed by assetId)
 * and match its registered byteSize and checksum, otherwise ASSET_MISSING /
 * PROJECT_EXPORT_FAILED is returned. The result is re-imported before returning.
 */
export function exportGsp(stack: Stack, assets: Record<string, Uint8Array> = {}): Result<Uint8Array> {
  const built = guard('PROJECT_EXPORT_FAILED', 'Export failed', () => {
    const valid = StackSchema.safeParse(stack);
    if (!valid.success) fail('PROJECT_EXPORT_FAILED', `Stack is invalid: ${valid.error.message}`);
    checkReferences(stack, 'PROJECT_EXPORT_FAILED');
    const integrity = validateStack(stack);
    if (!integrity.ok) fail('PROJECT_EXPORT_FAILED', `Stack is inconsistent: ${integrity.error.message}`);
    const { cards, ...stackFile } = stack;
    const files: Zippable = {};
    const manifest: Manifest = {
      formatVersion: FORMAT_VERSION,
      stackId: stack.stackId,
      title: stack.title,
      cards: stack.cardOrder.map((cardId) => ({ cardId, path: cardPath(cardId) })),
      assets: [],
    };
    for (const cardId of stack.cardOrder) {
      checkEntryName(cardPath(cardId), 'PROJECT_EXPORT_FAILED');
      files[cardPath(cardId)] = toJson(cards[cardId]);
    }
    for (const asset of Object.values(stack.assetRegistry)) {
      const bytes = assets[asset.assetId];
      if (!bytes) fail('ASSET_MISSING', `No bytes supplied for asset ${asset.assetId}`);
      checkEntryName(assetPath(asset.relativePath), 'PROJECT_EXPORT_FAILED');
      if (bytes!.length !== asset.byteSize || sha256Hex(bytes!) !== asset.checksum) {
        fail('PROJECT_EXPORT_FAILED', `Asset ${asset.assetId} does not match its registered size/checksum`);
      }
      manifest.assets.push({ ...asset, path: assetPath(asset.relativePath) });
      files[assetPath(asset.relativePath)] = [bytes!, { level: 0 }];
    }
    files['manifest.json'] = toJson(manifest);
    files['stack.json'] = toJson(stackFile);
    return zipSync(files, { level: 6, mtime: new Date(Date.UTC(1980, 0, 1)) });
  });
  if (!built.ok) return built;
  const check = importGsp(built.value);
  if (!check.ok) {
    return err({
      code: 'PROJECT_EXPORT_FAILED',
      message: `Exported archive failed verification: ${check.error.message}`,
    });
  }
  return built;
}

function checkReferences(
  stack: Omit<Stack, 'cards'> & { cards: Record<string, Card> },
  code: ErrorCode,
): void {
  const ids = new Set(stack.cardOrder);
  if (ids.size !== stack.cardOrder.length) fail(code, 'cardOrder contains duplicate card ids');
  if (!ids.has(stack.entryCardId)) fail(code, 'entryCardId is not in cardOrder');
  const keys = Object.keys(stack.cards);
  if (keys.length !== ids.size) fail(code, 'cards and cardOrder disagree');
  for (const id of ids) {
    const card = stack.cards[id];
    if (!card) fail(code, `cardOrder references missing card ${id}`);
    if (card!.cardId !== id) fail(code, `Card key ${id} does not match its cardId`);
  }
}

/**
 * Parses and fully validates a `.gsp` archive. All-or-nothing: any failure returns an
 * error and no Stack. A registered asset whose file is absent, or an unregistered file
 * present in the archive, yields ASSET_MISSING / PROJECT_IMPORT_FAILED respectively
 * (no warnings channel; a partial import is never returned).
 */
export function importGsp(bytes: Uint8Array): Result<{ stack: Stack; assets: Record<string, Uint8Array> }> {
  return guard('PROJECT_IMPORT_FAILED', 'Import failed', () => {
    const code: ErrorCode = 'PROJECT_IMPORT_FAILED';
    const seen = new Set<string>();
    let total = 0;
    let violation: string | undefined;
    let raw: Record<string, Uint8Array>;
    try {
      raw = unzipSync(bytes, {
        filter: (f) => {
          if (violation) return false;
          if (seen.has(f.name)) violation = `Duplicate entry ${f.name}`;
          else if (seen.size >= GSP_LIMITS.maxEntries) violation = 'Too many archive entries';
          else if (f.originalSize > GSP_LIMITS.maxEntryBytes) violation = `Entry too large: ${f.name}`;
          else if ((total += f.originalSize) > GSP_LIMITS.maxTotalBytes) {
            violation = 'Archive too large when extracted';
          } else {
            try {
              checkEntryName(f.name, code);
            } catch (e) {
              violation = (e as Error).message;
            }
          }
          seen.add(f.name);
          return !violation && !f.name.endsWith('/');
        },
      });
    } catch {
      return fail(code, 'Not a valid .gsp (ZIP) archive');
    }
    if (violation) fail(code, violation);

    const files: Record<string, Uint8Array> = {};
    let actual = 0;
    for (const [name, data] of Object.entries(raw)) {
      actual += data.length;
      if (data.length > GSP_LIMITS.maxEntryBytes || actual > GSP_LIMITS.maxTotalBytes) {
        fail(code, 'Archive too large when extracted');
      }
      files[name] = data;
    }
    for (const n of ['manifest.json', 'stack.json']) {
      if ((files[n]?.length ?? 0) > GSP_LIMITS.maxJsonBytes) fail(code, `${n} is too large`);
    }

    const rawManifest = files['manifest.json'];
    if (!rawManifest) fail(code, 'Archive is missing manifest.json');
    let version: unknown;
    try {
      version = (JSON.parse(strFromU8(rawManifest!)) as { formatVersion?: unknown }).formatVersion;
    } catch {
      return fail(code, 'manifest.json is not valid JSON');
    }
    if (version !== FORMAT_VERSION) {
      fail(code, `Unsupported formatVersion ${String(version)} (supported: ${FORMAT_VERSION})`);
    }
    const manifest = parseJson(files, 'manifest.json', ManifestSchema, code);
    const stackFile = parseJson(files, 'stack.json', StackFileSchema, code);
    if (stackFile.stackId !== manifest.stackId) fail(code, 'stack.json and manifest stackId differ');

    const used = new Set(['manifest.json', 'stack.json']);
    const cards: Record<string, Card> = {};
    for (const ref of manifest.cards) {
      if (ref.path !== cardPath(ref.cardId)) fail(code, `Unexpected card path ${ref.path}`);
      if (cards[ref.cardId]) fail(code, `Duplicate card ${ref.cardId} in manifest`);
      used.add(ref.path);
      const card = parseJson(files, ref.path, CardSchema, code);
      if (card.cardId !== ref.cardId) fail(code, `${ref.path} cardId mismatch`);
      cards[ref.cardId] = card;
    }
    if (manifest.cards.map((c) => c.cardId).join('\n') !== stackFile.cardOrder.join('\n')) {
      fail(code, 'Manifest card list does not match stack cardOrder');
    }
    const stack: Stack = { ...stackFile, cards };
    checkReferences(stack, code);
    const integrity = validateStack(stack);
    if (!integrity.ok) fail(code, `Project is inconsistent: ${integrity.error.message}`);

    const assets: Record<string, Uint8Array> = {};
    const registered = Object.keys(stack.assetRegistry);
    if (manifest.assets.length !== registered.length) fail(code, 'Manifest and stack assets disagree');
    for (const entry of manifest.assets) {
      const { path, ...asset } = entry;
      const reg = stack.assetRegistry[asset.assetId];
      if (!reg || JSON.stringify(sortKeys(reg)) !== JSON.stringify(sortKeys(asset))) {
        fail(code, `Manifest asset ${asset.assetId} does not match stack.json`);
      }
      if (path !== assetPath(asset.relativePath)) fail(code, `Unexpected asset path ${path}`);
      const data = files[path];
      if (!data) fail('ASSET_MISSING', `Archive is missing asset file ${path}`);
      if (data!.length !== asset.byteSize) fail(code, `Asset ${asset.assetId} byteSize mismatch`);
      if (sha256Hex(data!) !== asset.checksum) fail(code, `Asset ${asset.assetId} checksum mismatch`);
      used.add(path);
      assets[asset.assetId] = data!;
    }
    for (const card of Object.values(cards)) {
      for (const el of card.elements) {
        if (el.assetId && !stack.assetRegistry[el.assetId]) {
          fail(code, `Element ${el.elementId} references unregistered asset ${el.assetId}`);
        }
      }
    }
    for (const name of Object.keys(files)) {
      if (!used.has(name)) fail(code, `Unexpected file in archive: ${name}`);
    }
    return { stack, assets };
  });
}

function sortKeys<T extends Record<string, unknown>>(o: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)));
}
