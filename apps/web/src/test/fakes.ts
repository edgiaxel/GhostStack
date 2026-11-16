import { createMemoryStorage } from '@ghoststack/storage';
import type { Services } from '../app/services';
import { createPreferencesStore } from '../preferences/preferences';
import type { PreferencesStorage } from '../preferences/preferences';

export function createFakeKeyValueStorage(
  initial: Record<string, string> = {},
): PreferencesStorage {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

export function createTestServices(overrides: Partial<Services> = {}): Services {
  let counter = 0;
  return {
    storage: createMemoryStorage(),
    preferences: createPreferencesStore(createFakeKeyValueStorage()),
    clock: () => '2026-01-01T00:00:00.000Z',
    newId: (prefix) => `${prefix}_test-${String(++counter)}`,
    ...overrides,
  };
}
