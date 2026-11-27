import {
  PROVIDER_KINDS,
  err,
  ok,
  type AIProviderAdapter,
  type AIProviderCapabilities,
  type GhostError,
  type ProviderConfig,
  type ProviderKind,
  type Result,
} from '@ghoststack/shared-contracts';
import { invalidAdapter } from './adapter-util';
import { resolveConfig } from './config';
import { createDemoProvider } from './demo';
import { createOllamaProvider } from './ollama';
import { createOpenAICompatibleProvider } from './openai';
import type { ProviderDeps } from './platform';

/** What the settings UI shows for a provider. It never carries a key. */
export interface ProviderDescription {
  kind: ProviderKind;
  id: string;
  label: string;
  locality: 'local' | 'remote';
  capabilities: AIProviderCapabilities;
  baseUrl?: string;
  model?: string;
}

const KIND_LABELS: Record<ProviderKind, string> = {
  demo: 'Demo (offline)',
  ollama: 'Ollama',
  'openai-compatible': 'OpenAI-compatible',
};

/**
 * Creates the one adapter the settings name. There is no fallback: a failing adapter returns its
 * failure to the caller. Invalid settings give an adapter that sends nothing and answers
 * `PROVIDER_UNSUPPORTED_CAPABILITY`. Creating an adapter never touches the network.
 */
export function createProvider(config: ProviderConfig, deps?: ProviderDeps): AIProviderAdapter {
  const resolved = resolveConfig(config);
  if (!resolved.ok) return invalidAdapter(String(config.kind), 'Provider');
  switch (resolved.value.kind) {
    case 'demo':
      return createDemoProvider();
    case 'ollama':
      return createOllamaProvider(config, deps);
    case 'openai-compatible':
      return createOpenAICompatibleProvider(config, deps);
  }
}

/** Validates settings and describes the provider they select, without creating a request. */
export function describeProvider(config: ProviderConfig): Result<ProviderDescription, GhostError> {
  const resolved = resolveConfig(config);
  if (!resolved.ok) return err(resolved.error);
  const c = resolved.value;
  const adapter = createProvider(config);
  const description: ProviderDescription = {
    kind: c.kind,
    id: adapter.id,
    label: adapter.label,
    locality: adapter.capabilities.local ? 'local' : 'remote',
    capabilities: adapter.capabilities,
  };
  if (c.baseUrl !== undefined) description.baseUrl = c.baseUrl;
  if (c.model !== undefined) description.model = c.model;
  return ok(description);
}

/** The kinds the package supports, in display order. */
export function listProviderKinds(): { kind: ProviderKind; label: string }[] {
  return PROVIDER_KINDS.map((kind) => ({ kind, label: KIND_LABELS[kind] }));
}
