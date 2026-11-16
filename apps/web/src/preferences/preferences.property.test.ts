import { ID_PATTERNS } from '@ghoststack/domain';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  createPreferencesStore,
  DEFAULT_PREFERENCES,
  type Preferences,
  type PreferencesStorage,
} from './preferences';

const KEYS = ['theme', 'panelSizes', 'panelVisibility', 'lastProjectId'] as const;
const storageKey = (key: keyof Preferences): string => `ghoststack.pref.${key}`;

const projectId = fc.uuid({ version: 4 }).map((uuid) => `stk_${uuid}`);

const validValues = {
  theme: fc.constant('spectral-workstation' as const),
  panelSizes: fc.record({
    navigator: fc.integer({ min: 160, max: 480 }),
    inspector: fc.integer({ min: 200, max: 520 }),
  }),
  panelVisibility: fc.record({
    navigator: fc.boolean(),
    toolbox: fc.boolean(),
    inspector: fc.boolean(),
  }),
  lastProjectId: fc.option(projectId, { nil: null }),
} satisfies { [K in keyof Preferences]: fc.Arbitrary<Preferences[K]> };

const validPreferences: fc.Arbitrary<Preferences> = fc.record(validValues);

// Raw strings: arbitrary text, arbitrary JSON, and JSON shaped like a preference with bad fields.
const rawString = fc.oneof(
  fc.string(),
  fc.json(),
  fc.jsonValue().map((value) => JSON.stringify(value)),
  fc
    .record({ navigator: fc.integer(), inspector: fc.integer(), toolbox: fc.anything() })
    .map((value) => JSON.stringify(value)),
);

function memoryStorage(initial: Record<string, string>): PreferencesStorage {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

function isValid<K extends keyof Preferences>(key: K, value: unknown): boolean {
  const v = value as Record<string, unknown> | string | null;
  switch (key) {
    case 'theme':
      return v === 'spectral-workstation';
    case 'lastProjectId':
      return v === null || (typeof v === 'string' && ID_PATTERNS.stk.test(v));
    case 'panelSizes': {
      const s = v as { navigator: number; inspector: number };
      return (
        Number.isInteger(s.navigator) &&
        s.navigator >= 160 &&
        s.navigator <= 480 &&
        Number.isInteger(s.inspector) &&
        s.inspector >= 200 &&
        s.inspector <= 520
      );
    }
    case 'panelVisibility': {
      const s = v as Record<string, unknown>;
      return (
        typeof s['navigator'] === 'boolean' &&
        typeof s['toolbox'] === 'boolean' &&
        typeof s['inspector'] === 'boolean'
      );
    }
  }
}

describe('Property 14: Preferences are always valid and never interrupt the app', () => {
  /**
   * **Validates: Requirements 7.4**
   */
  it('any raw string under any key yields a valid value and leaves other keys unchanged', () => {
    fc.assert(
      fc.property(fc.constantFrom(...KEYS), rawString, validPreferences, (key, raw, others) => {
        const seeded = memoryStorage({
          [storageKey('theme')]: others.theme,
          [storageKey('panelSizes')]: JSON.stringify(others.panelSizes),
          [storageKey('panelVisibility')]: JSON.stringify(others.panelVisibility),
          ...(others.lastProjectId === null
            ? {}
            : { [storageKey('lastProjectId')]: others.lastProjectId }),
        });
        seeded.setItem(storageKey(key), raw);
        const store = createPreferencesStore(seeded);

        const value = store.get(key);
        expect(isValid(key, value)).toBe(true);
        for (const other of KEYS) {
          if (other !== key) expect(store.get(other)).toEqual(others[other]);
        }
      }),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 7.5**
   */
  it('a set value is returned by a new store over the same storage', () => {
    fc.assert(
      fc.property(fc.constantFrom(...KEYS), validPreferences, (key, prefs) => {
        const storage = memoryStorage({});
        createPreferencesStore(storage).set(key, prefs[key]);
        expect(createPreferencesStore(storage).get(key)).toEqual(prefs[key]);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 7.6**
   */
  it('throwing storage never throws and keeps defaults or the in-session value', () => {
    const failure = (): never => {
      throw new Error('storage unavailable');
    };
    const throwing: PreferencesStorage = {
      getItem: failure,
      setItem: failure,
      removeItem: failure,
    };
    fc.assert(
      fc.property(fc.constantFrom(...KEYS), validPreferences, (key, prefs) => {
        const store = createPreferencesStore(throwing);
        expect(store.get(key)).toEqual(DEFAULT_PREFERENCES[key]);
        expect(() => store.set(key, prefs[key] as never)).not.toThrow();
        expect(store.get(key)).toEqual(prefs[key]);
      }),
      { numRuns: 100 },
    );
  });
});
