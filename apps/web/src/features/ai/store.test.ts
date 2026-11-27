import { describe, expect, it } from 'vitest';
import { err, ok } from '@ghoststack/shared-contracts';
import type { ProviderConfig } from '@ghoststack/shared-contracts';
import { SETTINGS_STORAGE_KEY } from './settings';
import { createProviderStore } from './store';
import { scriptedAdapter } from './testing';
function memory() {
  const data = new Map<string, string>();
  return {
    data,
    storage: {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    },
  };
}
describe('provider store', () => {
  it('starts not configured and loads saved settings', () => {
    const m = memory();
    expect(createProviderStore({ storage: () => m.storage }).getState()).toMatchObject({
      connection: 'not-configured',
      settings: undefined,
    });
    m.data.set(SETTINGS_STORAGE_KEY, JSON.stringify({ kind: 'ollama', model: 'llama3' }));
    const s = createProviderStore({ storage: () => m.storage }).getState();
    expect(s).toMatchObject({ connection: 'untested', settings: { kind: 'ollama', model: 'llama3' } });
    expect(s.description).toMatchObject({ locality: 'local' });
  });
  it('keeps the key in memory only', () => {
    const m = memory();
    const store = createProviderStore({ storage: () => m.storage });
    store.saveSettings(
      { kind: 'openai-compatible', baseUrl: 'https://api.example.test/v1', model: 'm' },
      'sk-live-ABC',
    );
    expect(store.getState().hasKey).toBe(true);
    expect(JSON.stringify([...m.data])).not.toContain('sk-live-ABC');
    expect(JSON.stringify(store.getState())).not.toContain('sk-live-ABC');
    expect(store.redact('error sk-live-ABC end')).toBe('error [key removed] end');
    expect(createProviderStore({ storage: () => m.storage }).getState().hasKey).toBe(false);
    store.clearKey();
    expect(store.getState().hasKey).toBe(false);
    expect(store.redact('sk-live-ABC')).toBe('sk-live-ABC');
  });
  it('hands the key only to the adapter it creates', () => {
    const seen: ProviderConfig[] = [];
    const store = createProviderStore({
      storage: () => memory().storage,
      createProvider: (c) => {
        seen.push(c);
        return scriptedAdapter(() => err({ code: 'INVALID_AI_PLAN', message: 'x' }));
      },
    });
    store.saveSettings(
      { kind: 'openai-compatible', baseUrl: 'https://api.example.test/v1', model: 'm' },
      'sk-1',
    );
    store.getAdapter();
    expect(seen[0]?.apiKey).toBe('sk-1');
  });
  it('drops a key when switching to a provider that takes none', () => {
    const store = createProviderStore({ storage: () => memory().storage });
    store.saveSettings(
      { kind: 'openai-compatible', baseUrl: 'https://api.example.test/v1', model: 'm' },
      'sk-1',
    );
    store.saveSettings({ kind: 'ollama', model: 'llama3' });
    expect(store.getState().hasKey).toBe(false);
  });
  it('reports a ready connection with models, and an error with its normalized message', async () => {
    let answer: 'ok' | 'bad' = 'ok';
    const adapter = scriptedAdapter(() => ok(null as never));
    adapter.testConnection = async () =>
      answer === 'ok'
        ? ok({ ok: true as const, detail: 'Connected, 2 models', models: ['a', 'b'] })
        : err({ code: 'PROVIDER_UNAVAILABLE' as const, message: 'The provider could not be reached.' });
    const store = createProviderStore({ storage: () => memory().storage, createProvider: () => adapter });
    store.saveSettings({ kind: 'demo' });
    const pending = store.testConnection();
    expect(store.getState().connection).toBe('testing');
    await pending;
    expect(store.getState()).toMatchObject({
      connection: 'ready',
      detail: 'Connected, 2 models',
      models: ['a', 'b'],
    });
    answer = 'bad';
    await store.testConnection();
    expect(store.getState()).toMatchObject({ connection: 'error', error: { code: 'PROVIDER_UNAVAILABLE' } });
  });
  it('ignores a test result that arrives after the settings changed', async () => {
    let release: () => void = () => undefined;
    const adapter = scriptedAdapter(() => ok(null as never));
    adapter.testConnection = () =>
      new Promise((resolve) => (release = () => resolve(ok({ ok: true as const, detail: 'old' }))));
    const store = createProviderStore({ storage: () => memory().storage, createProvider: () => adapter });
    store.saveSettings({ kind: 'demo' });
    const pending = store.testConnection();
    store.saveSettings({ kind: 'ollama', model: 'm' });
    release();
    await pending;
    expect(store.getState().connection).toBe('untested');
  });
  it('turns a thrown adapter into an error state and can cancel a test', async () => {
    const adapter = scriptedAdapter(() => ok(null as never));
    adapter.testConnection = async () => {
      throw new Error('boom');
    };
    const store = createProviderStore({ storage: () => memory().storage, createProvider: () => adapter });
    store.saveSettings({ kind: 'demo' });
    await store.testConnection();
    expect(store.getState().connection).toBe('error');
    adapter.testConnection = () => new Promise(() => undefined);
    void store.testConnection();
    store.cancelTest();
    expect(store.getState().connection).toBe('untested');
  });
  it('records consent per provider in memory', () => {
    const store = createProviderStore({ storage: () => memory().storage });
    store.saveSettings({ kind: 'openai-compatible', baseUrl: 'https://a.example.test/v1', model: 'm' }, 'k');
    expect(store.hasConsent()).toBe(false);
    store.grantConsent();
    expect(store.hasConsent()).toBe(true);
    store.saveSettings({ kind: 'openai-compatible', baseUrl: 'https://b.example.test/v1', model: 'm' });
    expect(store.hasConsent()).toBe(false);
  });
  it('reports a browser that refuses to store settings', () => {
    const store = createProviderStore({
      storage: () => ({
        getItem: () => null,
        setItem: () => {
          throw new Error('denied');
        },
      }),
    });
    store.saveSettings({ kind: 'demo' });
    expect(store.getState()).toMatchObject({ persistFailed: true, settings: { kind: 'demo' } });
  });
});
