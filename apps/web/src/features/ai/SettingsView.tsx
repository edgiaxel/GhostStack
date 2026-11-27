import { useState } from 'react';
import type { ReactNode } from 'react';
import { describeProvider } from '@ghoststack/ai-providers';
import type { PersistedProviderSettings, ProviderKind } from '@ghoststack/shared-contracts';
import { Button, Field, Select } from '../../components';
import { ProviderBadge } from './ProviderBadge';
import { presentError } from './errors';
import { providerStore, useProviderState } from './store';
import type { ProviderStore } from './store';
const KIND_OPTIONS = [
  { value: 'demo', label: 'Demo (offline, rule-based)' },
  { value: 'ollama', label: 'Ollama (local models)' },
  { value: 'openai-compatible', label: 'OpenAI-compatible (remote or local server)' },
];
const DEFAULT_URL: Record<ProviderKind, string> = {
  demo: '',
  ollama: 'http://127.0.0.1:11434',
  'openai-compatible': 'https://api.openai.com/v1',
};
interface FormErrors {
  baseUrl?: string;
  model?: string;
  apiKey?: string;
}
function validate(
  kind: ProviderKind,
  baseUrl: string,
  model: string,
  hasKey: boolean,
  keyInput: string,
): FormErrors {
  const errors: FormErrors = {};
  if (kind === 'demo') return errors;
  const probe = describeProvider({
    kind,
    ...(baseUrl.trim() ? { baseUrl: baseUrl.trim() } : {}),
    ...(model.trim() ? { model: model.trim() } : {}),
  });
  if (!probe.ok) {
    const needsHttps = kind === 'openai-compatible' && /^http:/i.test(baseUrl.trim());
    if (baseUrl.trim() && !describeProvider({ kind, baseUrl: baseUrl.trim() }).ok) {
      errors.baseUrl = needsHttps
        ? 'Use https for a remote address. A key must not travel in clear text. Plain http works for localhost only.'
        : 'Enter a full address that starts with http:// or https://.';
    }
    if (model.trim() && !describeProvider({ kind, model: model.trim() }).ok) {
      errors.model = 'Use letters, digits and . _ : / - only.';
    }
  }
  if (!model.trim()) errors.model = 'Enter the model name to use.';
  if (kind === 'openai-compatible' && !hasKey && keyInput === '') {
    errors.apiKey = 'Enter an API key. It stays in memory and is not saved.';
  }
  return errors;
}
export function SettingsView({ store = providerStore }: { store?: ProviderStore }): ReactNode {
  const state = useProviderState(store);
  const saved = state.settings;
  const [kind, setKind] = useState<ProviderKind>(saved?.kind ?? 'demo');
  const [baseUrl, setBaseUrl] = useState(saved?.baseUrl ?? '');
  const [model, setModel] = useState(saved?.model ?? '');
  const [keyInput, setKeyInput] = useState('');
  const [touched, setTouched] = useState(false);
  const errors = validate(kind, baseUrl, model, state.hasKey, keyInput);
  const invalid = Object.keys(errors).length > 0;
  const shown = touched ? errors : {};
  const preview = describeProvider({
    kind,
    ...(baseUrl.trim() ? { baseUrl: baseUrl.trim() } : {}),
  });
  const remote = kind !== 'demo' && preview.ok && preview.value.locality === 'remote';
  const apply = (): boolean => {
    setTouched(true);
    if (invalid) return false;
    const next: PersistedProviderSettings = { kind };
    if (kind !== 'demo') {
      if (baseUrl.trim()) next.baseUrl = baseUrl.trim();
      next.model = model.trim();
    }
    store.saveSettings(next, keyInput);
    setKeyInput('');
    return true;
  };
  const error = state.error ? presentError(state.error, store.redact) : undefined;
  return (
    <form
      className="gs-ai-stack"
      aria-label="Provider settings"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
    >
      <Select
        label="Provider"
        value={kind}
        options={KIND_OPTIONS}
        onChange={(v) => {
          const k = v as ProviderKind;
          setKind(k);
          setBaseUrl('');
          if (k === 'demo') setModel('');
        }}
        hint={
          kind === 'demo'
            ? 'Builds plans from fixed rules on this computer. No network.'
            : kind === 'ollama'
              ? 'Runs on your computer. Start Ollama with OLLAMA_ORIGINS set so this page may call it.'
              : 'Your request and a summary of the project go to this server after you confirm.'
        }
      />
      {kind !== 'demo' ? (
        <>
          <Field
            label="Base URL"
            value={baseUrl}
            placeholder={DEFAULT_URL[kind]}
            onChange={setBaseUrl}
            error={shown.baseUrl}
            hint="Leave empty for the default address."
            autoComplete="off"
            spellCheck={false}
          />
          <Field
            label="Model"
            value={model}
            onChange={setModel}
            error={shown.model}
            autoComplete="off"
            spellCheck={false}
          />
        </>
      ) : null}
      {kind === 'openai-compatible' ? (
        <>
          <Field
            label="API key"
            type="password"
            value={keyInput}
            onChange={setKeyInput}
            error={shown.apiKey}
            autoComplete="off"
            spellCheck={false}
            hint={
              state.hasKey
                ? 'A key is held in memory. Enter a new one to replace it.'
                : 'Held in memory for this tab only. Never saved or exported.'
            }
          />
          {state.hasKey ? (
            <div className="gs-ai-actions">
              <Button onClick={() => store.clearKey()}>Clear key from memory</Button>
            </div>
          ) : null}
        </>
      ) : null}
      {remote ? (
        <p className="gs-ai-muted">
          This address is remote. You will be asked to confirm before anything is sent.
        </p>
      ) : null}
      <div className="gs-ai-actions">
        <Button type="submit" variant="primary">
          Save settings
        </Button>
        <Button
          loading={state.connection === 'testing'}
          onClick={() => {
            if (apply()) void store.testConnection();
          }}
        >
          Test connection
        </Button>
        {state.connection === 'testing' ? (
          <Button onClick={() => store.cancelTest()}>Cancel test</Button>
        ) : null}
      </div>
      {state.persistFailed ? (
        <p className="gs-error" role="alert">
          The browser did not store these settings. They apply until you close this tab.
        </p>
      ) : null}
      <div className="gs-ai-stack" role="status" aria-live="polite" data-testid="ai-connection">
        {saved ? (
          <div className="gs-ai-row">
            <ProviderBadge state={state} />
          </div>
        ) : (
          <p className="gs-ai-muted">Nothing is saved yet. Save the settings to use the assistant.</p>
        )}
        {saved && state.connection !== 'untested' ? (
          <p className={state.connection === 'error' ? 'gs-error' : 'gs-ai-muted'}>
            {error ? `${error.title}. ${error.message ?? ''}` : state.detail}
          </p>
        ) : null}
      </div>
      {error ? <p className="gs-ai-muted">{error.next}</p> : null}
      {state.models.length > 0 ? (
        <p className="gs-ai-muted">Models found: {state.models.slice(0, 12).join(', ')}</p>
      ) : null}
    </form>
  );
}
