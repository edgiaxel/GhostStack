import { describe, expect, it, vi } from 'vitest';
import {
  createPreferencesStore,
  DEFAULT_PREFERENCES,
  safeLocalStorage,
  type PreferencesStorage,
} from './preferences';

const STK = 'stk_123e4567-e89b-42d3-a456-426614174000';

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const storage: PreferencesStorage = {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
  return { data, storage };
}

describe('createPreferencesStore', () => {
  it('returns defaults for empty storage', () => {
    const store = createPreferencesStore(fakeStorage().storage);
    for (const key of Object.keys(DEFAULT_PREFERENCES) as (keyof typeof DEFAULT_PREFERENCES)[]) {
      expect(store.get(key)).toEqual(DEFAULT_PREFERENCES[key]);
    }
  });

  it('resets only the malformed key', () => {
    const { storage } = fakeStorage({
      'ghoststack.pref.panelSizes': '{not json',
      'ghoststack.pref.lastProjectId': STK,
      'ghoststack.pref.panelVisibility': JSON.stringify({
        navigator: false,
        toolbox: true,
        inspector: true,
      }),
    });
    const store = createPreferencesStore(storage);
    expect(store.get('panelSizes')).toEqual(DEFAULT_PREFERENCES.panelSizes);
    expect(store.get('lastProjectId')).toBe(STK);
    expect(store.get('panelVisibility').navigator).toBe(false);
  });

  it.each([
    ['theme', 'dark'],
    ['panelSizes', JSON.stringify({ navigator: 100, inspector: 300 })],
    ['panelSizes', JSON.stringify({ navigator: 200.5, inspector: 300 })],
    ['panelVisibility', JSON.stringify({ navigator: 1, toolbox: true, inspector: true })],
    ['lastProjectId', 'not-an-id'],
  ])('falls back to default for invalid %s value', (key, raw) => {
    const store = createPreferencesStore(fakeStorage({ [`ghoststack.pref.${key}`]: raw }).storage);
    expect(store.get(key as keyof typeof DEFAULT_PREFERENCES)).toEqual(
      DEFAULT_PREFERENCES[key as keyof typeof DEFAULT_PREFERENCES],
    );
  });

  it('round trips each valid value through a second store', () => {
    const { storage } = fakeStorage();
    const first = createPreferencesStore(storage);
    first.set('theme', 'spectral-workstation');
    first.set('panelSizes', { navigator: 300, inspector: 400 });
    first.set('panelVisibility', { navigator: false, toolbox: false, inspector: true });
    first.set('lastProjectId', STK);
    const second = createPreferencesStore(storage);
    expect(second.get('panelSizes')).toEqual({ navigator: 300, inspector: 400 });
    expect(second.get('panelVisibility')).toEqual({
      navigator: false,
      toolbox: false,
      inspector: true,
    });
    expect(second.get('lastProjectId')).toBe(STK);
    expect(second.get('theme')).toBe('spectral-workstation');
  });

  it('removes the key when lastProjectId is cleared', () => {
    const { storage, data } = fakeStorage();
    const store = createPreferencesStore(storage);
    store.set('lastProjectId', STK);
    store.set('lastProjectId', null);
    expect(data.has('ghoststack.pref.lastProjectId')).toBe(false);
    expect(createPreferencesStore(storage).get('lastProjectId')).toBeNull();
  });

  it('writes only the four ghoststack.pref keys', () => {
    const { storage, data } = fakeStorage();
    const store = createPreferencesStore(storage);
    store.set('theme', 'spectral-workstation');
    store.set('panelSizes', { navigator: 200, inspector: 250 });
    store.set('panelVisibility', { navigator: true, toolbox: false, inspector: true });
    store.set('lastProjectId', STK);
    expect([...data.keys()].sort()).toEqual([
      'ghoststack.pref.lastProjectId',
      'ghoststack.pref.panelSizes',
      'ghoststack.pref.panelVisibility',
      'ghoststack.pref.theme',
    ]);
  });

  it('ignores invalid values passed to set', () => {
    const { storage, data } = fakeStorage();
    const store = createPreferencesStore(storage);
    store.set('panelSizes', { navigator: 9999, inspector: 300 });
    expect(store.get('panelSizes')).toEqual(DEFAULT_PREFERENCES.panelSizes);
    expect(data.size).toBe(0);
  });

  it('works in memory with null storage', () => {
    const store = createPreferencesStore(null);
    expect(store.get('lastProjectId')).toBeNull();
    store.set('lastProjectId', STK);
    expect(store.get('lastProjectId')).toBe(STK);
  });

  it('returns defaults and keeps values in memory when storage throws', () => {
    const boom = () => {
      throw new Error('denied');
    };
    const store = createPreferencesStore({ getItem: boom, setItem: boom, removeItem: boom });
    expect(store.get('panelSizes')).toEqual(DEFAULT_PREFERENCES.panelSizes);
    expect(() => store.set('panelSizes', { navigator: 300, inspector: 300 })).not.toThrow();
    expect(store.get('panelSizes')).toEqual({ navigator: 300, inspector: 300 });
    expect(() => store.set('lastProjectId', null)).not.toThrow();
  });

  it('keeps the value in memory on a quota error', () => {
    const { storage } = fakeStorage();
    storage.setItem = () => {
      throw new DOMException('full', 'QuotaExceededError');
    };
    const store = createPreferencesStore(storage);
    expect(() => store.set('lastProjectId', STK)).not.toThrow();
    expect(store.get('lastProjectId')).toBe(STK);
  });

  it('does not let callers mutate stored state', () => {
    const store = createPreferencesStore(null);
    store.get('panelSizes').navigator = 1;
    expect(store.get('panelSizes').navigator).toBe(DEFAULT_PREFERENCES.panelSizes.navigator);
  });

  it('notifies subscribers until unsubscribed', () => {
    const store = createPreferencesStore(null);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.set('lastProjectId', STK);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    store.set('lastProjectId', null);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('safeLocalStorage', () => {
  it('returns null when access throws', () => {
    vi.spyOn(globalThis, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(safeLocalStorage()).toBeNull();
    vi.restoreAllMocks();
  });

  it('returns the storage object otherwise', () => {
    expect(safeLocalStorage()).toBe(globalThis.localStorage);
  });
});
