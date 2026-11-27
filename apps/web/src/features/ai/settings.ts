import { PROVIDER_KINDS } from '@ghoststack/shared-contracts';
import type { PersistedProviderSettings, ProviderKind } from '@ghoststack/shared-contracts';
/**
 * Non-secret provider settings are interface preferences (docs/UI_CONTRACT.md section 8): they live
 * in localStorage under the `gs.ai.` prefix. The API key has no field here and is never written.
 */
export const SETTINGS_STORAGE_KEY = 'gs.ai.settings';
const isKind = (v: unknown): v is ProviderKind =>
  typeof v === 'string' && (PROVIDER_KINDS as readonly string[]).includes(v);
const text = (v: unknown, max: number): string | undefined =>
  typeof v === 'string' && v.trim().length > 0 && v.length <= max ? v.trim() : undefined;
/** Keeps only the known non-secret fields, so a tampered or old value cannot carry anything else. */
export function sanitizeSettings(input: unknown): PersistedProviderSettings | undefined {
  if (typeof input !== 'object' || input === null) return undefined;
  const o = input as Record<string, unknown>;
  if (!isKind(o['kind'])) return undefined;
  const out: PersistedProviderSettings = { kind: o['kind'] };
  const baseUrl = text(o['baseUrl'], 2048);
  const model = text(o['model'], 128);
  if (out.kind !== 'demo') {
    if (baseUrl) out.baseUrl = baseUrl;
    if (model) out.model = model;
  }
  const timeout = o['timeoutMs'];
  if (typeof timeout === 'number' && Number.isInteger(timeout) && timeout >= 1000 && timeout <= 600_000) {
    out.timeoutMs = timeout;
  }
  return out;
}
export function parseStoredSettings(raw: string | null): PersistedProviderSettings | undefined {
  if (!raw) return undefined;
  try {
    return sanitizeSettings(JSON.parse(raw));
  } catch {
    return undefined;
  }
}
export function readSettings(
  storage: Pick<Storage, 'getItem'> | undefined,
): PersistedProviderSettings | undefined {
  try {
    return parseStoredSettings(storage?.getItem(SETTINGS_STORAGE_KEY) ?? null);
  } catch {
    return undefined;
  }
}
/** Returns false when the browser refuses the write (private mode, quota). The caller shows that. */
export function writeSettings(
  storage: Pick<Storage, 'setItem'> | undefined,
  settings: PersistedProviderSettings,
): boolean {
  const clean = sanitizeSettings(settings);
  if (!clean || !storage) return false;
  try {
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(clean));
    return true;
  } catch {
    return false;
  }
}
const safeStorage = (): Storage | undefined => {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
};
export const browserStorage = safeStorage;
