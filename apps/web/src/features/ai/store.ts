import { useSyncExternalStore } from 'react';
import { createProvider as createAdapter, describeProvider } from '@ghoststack/ai-providers';
import type { ProviderDescription } from '@ghoststack/ai-providers';
import type {
  AIProviderAdapter,
  GhostError,
  PersistedProviderSettings,
  ProviderConfig,
} from '@ghoststack/shared-contracts';
import { browserStorage, readSettings, sanitizeSettings, writeSettings } from './settings';
export type ConnectionState = 'not-configured' | 'untested' | 'testing' | 'ready' | 'error';
export interface ProviderState {
  /** Undefined until the creator saves settings. */
  settings: PersistedProviderSettings | undefined;
  /** True while a key is held in memory. The key itself is never part of the state. */
  hasKey: boolean;
  connection: ConnectionState;
  /** Result text of the last test: success text, or the normalized error message. */
  detail: string;
  error: GhostError | undefined;
  models: string[];
  description: ProviderDescription | undefined;
  /** Set when the browser refused to store the settings. */
  persistFailed: boolean;
}
export interface ProviderStoreDeps {
  storage?: (() => Pick<Storage, 'getItem' | 'setItem'> | undefined) | undefined;
  createProvider?: (config: ProviderConfig) => AIProviderAdapter;
}
export interface ProviderStore {
  getState(): ProviderState;
  subscribe(listener: () => void): () => void;
  /** Saves non-secret settings. A key passed here stays in memory only. */
  saveSettings(settings: PersistedProviderSettings, apiKey?: string): void;
  clearKey(): void;
  testConnection(): Promise<void>;
  cancelTest(): void;
  /** A fresh adapter for the saved settings, or undefined while nothing is configured. */
  getAdapter(): AIProviderAdapter | undefined;
  /** Per-session consent for sending project data to a remote provider. Memory only. */
  hasConsent(): boolean;
  grantConsent(): void;
  /** Replaces every occurrence of the held key in `text`. */
  redact(text: string): string;
}
const IDLE_DETAIL: Record<ConnectionState, string> = {
  'not-configured': 'Choose a provider in the settings.',
  untested: 'Not tested yet.',
  testing: 'Testing the connection.',
  ready: 'Connected.',
  error: 'The connection failed.',
};
export function createProviderStore(deps: ProviderStoreDeps = {}): ProviderStore {
  const makeAdapter = deps.createProvider ?? createAdapter;
  const storage = deps.storage ?? browserStorage;
  const listeners = new Set<() => void>();
  let key: string | undefined;
  let consented = new Set<string>();
  let testRun = 0;
  let testAbort: AbortController | undefined;
  const config = (s: PersistedProviderSettings): ProviderConfig => ({
    ...s,
    ...(key ? { apiKey: key } : {}),
  });
  const describe = (s: PersistedProviderSettings | undefined): ProviderDescription | undefined => {
    if (!s) return undefined;
    const d = describeProvider(config(s));
    return d.ok ? d.value : undefined;
  };
  const initial = ((): PersistedProviderSettings | undefined => {
    try {
      return readSettings(storage());
    } catch {
      return undefined;
    }
  })();
  const build = (
    settings: PersistedProviderSettings | undefined,
    patch: Partial<ProviderState> = {},
  ): ProviderState => ({
    settings,
    hasKey: key !== undefined,
    connection: settings ? 'untested' : 'not-configured',
    detail: IDLE_DETAIL[settings ? 'untested' : 'not-configured'],
    error: undefined,
    models: [],
    description: describe(settings),
    persistFailed: false,
    ...patch,
  });
  let state = build(initial);
  const set = (next: ProviderState): void => {
    state = next;
    listeners.forEach((l) => l());
  };
  const consentKey = (): string => {
    const d = state.description;
    return d ? `${d.id}|${d.baseUrl ?? ''}` : '';
  };
  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    saveSettings(settings, apiKey) {
      const clean = sanitizeSettings(settings);
      if (!clean) return;
      testRun += 1;
      testAbort?.abort();
      if (apiKey !== undefined && apiKey !== '') key = apiKey;
      if (clean.kind === 'demo' || clean.kind === 'ollama') key = undefined;
      const stored = writeSettings(storage(), clean);
      set(build(clean, { persistFailed: !stored }));
    },
    clearKey() {
      key = undefined;
      testRun += 1;
      testAbort?.abort();
      set(build(state.settings, { persistFailed: state.persistFailed }));
    },
    async testConnection() {
      const settings = state.settings;
      if (!settings) return;
      const adapter = makeAdapter(config(settings));
      const run = ++testRun;
      testAbort?.abort();
      const abort = new AbortController();
      testAbort = abort;
      set({ ...state, connection: 'testing', detail: IDLE_DETAIL.testing, error: undefined, models: [] });
      let result: Awaited<ReturnType<AIProviderAdapter['testConnection']>>;
      try {
        result = await adapter.testConnection(abort.signal);
      } catch {
        result = {
          ok: false,
          error: { code: 'PROVIDER_UNAVAILABLE', message: 'The provider could not be reached.' },
        };
      }
      if (run !== testRun) return;
      testAbort = undefined;
      if (result.ok) {
        set({
          ...state,
          connection: 'ready',
          detail: result.value.detail,
          error: undefined,
          models: result.value.models ?? [],
        });
      } else {
        set({
          ...state,
          connection: 'error',
          detail: result.error.message,
          error: result.error,
          models: [],
        });
      }
    },
    cancelTest() {
      if (state.connection !== 'testing') return;
      testRun += 1;
      testAbort?.abort();
      testAbort = undefined;
      set({ ...state, connection: 'untested', detail: 'The test was cancelled.', error: undefined });
    },
    getAdapter() {
      return state.settings ? makeAdapter(config(state.settings)) : undefined;
    },
    hasConsent: () => consented.has(consentKey()),
    grantConsent() {
      consented = new Set(consented).add(consentKey());
    },
    redact(text) {
      return key && key.length > 0 ? text.split(key).join('[key removed]') : text;
    },
  };
}
export const providerStore: ProviderStore = createProviderStore();
export function useProviderState(store: ProviderStore = providerStore): ProviderState {
  return useSyncExternalStore(store.subscribe, store.getState);
}
