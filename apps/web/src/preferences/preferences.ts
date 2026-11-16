import { ID_PATTERNS } from '@ghoststack/domain';
import { z } from 'zod';

export interface Preferences {
  theme: 'spectral-workstation';
  panelSizes: { navigator: number; inspector: number };
  panelVisibility: { navigator: boolean; toolbox: boolean; inspector: boolean };
  lastProjectId: string | null;
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'spectral-workstation',
  panelSizes: { navigator: 240, inspector: 320 },
  panelVisibility: { navigator: true, toolbox: true, inspector: true },
  lastProjectId: null,
};

export interface PreferencesStore {
  get<K extends keyof Preferences>(key: K): Preferences[K];
  set<K extends keyof Preferences>(key: K, value: Preferences[K]): void;
  subscribe(listener: () => void): () => void;
}

export type PreferencesStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const KEY_PREFIX = 'ghoststack.pref.';

const schemas = {
  theme: z.literal('spectral-workstation'),
  panelSizes: z.strictObject({
    navigator: z.number().int().min(160).max(480),
    inspector: z.number().int().min(200).max(520),
  }),
  panelVisibility: z.strictObject({
    navigator: z.boolean(),
    toolbox: z.boolean(),
    inspector: z.boolean(),
  }),
  lastProjectId: z.string().regex(ID_PATTERNS.stk).nullable(),
} satisfies { [K in keyof Preferences]: z.ZodType<Preferences[K]> };

function storageKey(key: keyof Preferences): string {
  return `${KEY_PREFIX}${key}`;
}

function cloneDefault<K extends keyof Preferences>(key: K): Preferences[K] {
  return structuredClone(DEFAULT_PREFERENCES[key]);
}

function parseValue<K extends keyof Preferences>(
  key: K,
  value: unknown,
): Preferences[K] | undefined {
  const result = schemas[key].safeParse(value);
  return result.success ? (result.data as Preferences[K]) : undefined;
}

// Stored form: theme and lastProjectId are plain strings, the rest are JSON. Absent lastProjectId means null.
function decode<K extends keyof Preferences>(key: K, raw: string | null): Preferences[K] {
  if (raw === null) return cloneDefault(key);
  try {
    const candidate =
      key === 'theme' || key === 'lastProjectId' ? raw : (JSON.parse(raw) as unknown);
    return parseValue(key, candidate) ?? cloneDefault(key);
  } catch {
    return cloneDefault(key);
  }
}

function encode(value: unknown): string | null {
  if (value === null) return null;
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export function createPreferencesStore(storage: PreferencesStorage | null): PreferencesStore {
  // Each key is read on its own so a corrupt value resets only that key.
  const read = <K extends keyof Preferences>(key: K): Preferences[K] => {
    try {
      return decode(key, storage?.getItem(storageKey(key)) ?? null);
    } catch {
      return cloneDefault(key);
    }
  };
  const values: Preferences = {
    theme: read('theme'),
    panelSizes: read('panelSizes'),
    panelVisibility: read('panelVisibility'),
    lastProjectId: read('lastProjectId'),
  };
  const listeners = new Set<() => void>();

  return {
    get(key) {
      return structuredClone(values[key]);
    },
    set(key, value) {
      const valid = parseValue(key, value);
      if (valid === undefined) return;
      values[key] = structuredClone(valid);
      try {
        const encoded = encode(valid);
        if (encoded === null) storage?.removeItem(storageKey(key));
        else storage?.setItem(storageKey(key), encoded);
      } catch {
        // Quota or access errors keep the value in memory for this session.
      }
      for (const listener of [...listeners]) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function safeLocalStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
