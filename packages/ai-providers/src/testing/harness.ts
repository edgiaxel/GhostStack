import type { AIProviderAdapter, AIPlan, ProviderConfig } from '@ghoststack/shared-contracts';
import { planForRequest } from '../demo';
import { createOllamaProvider } from '../ollama';
import { createOpenAICompatibleProvider } from '../openai';
import type { ProviderDeps } from '../platform';
import { loopbackOnlyFetch } from './mock-server';
import { makeContext } from './fixtures';

/** A real plan from the rule-based demo engine. HTTP mock servers return it as model output. */
export function realPlan(prompt = 'Make a quiz about space'): AIPlan {
  const result = planForRequest({ context: makeContext(), prompt });
  if (!result.ok) throw new Error('fixture plan failed');
  const { providerMeta: _meta, ...plan } = result.value;
  void _meta;
  return plan;
}

export type HttpKind = 'openai-compatible' | 'ollama';

export interface Wire {
  kind: HttpKind;
  chatPath: string;
  probePath: string;
  /** Provider answer envelope that carries `content`. */
  chatBody(content: string, extra?: Record<string, unknown>): string;
  probeBody(models: string[]): string;
  create(config: ProviderConfig, deps?: ProviderDeps): AIProviderAdapter;
}

export const WIRES: Wire[] = [
  {
    kind: 'openai-compatible',
    chatPath: '/chat/completions',
    probePath: '/models',
    chatBody: (content, extra = {}) =>
      JSON.stringify({
        choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop', ...extra }],
      }),
    probeBody: (models) => JSON.stringify({ data: models.map((id) => ({ id })) }),
    create: (config, deps) => createOpenAICompatibleProvider(config, deps),
  },
  {
    kind: 'ollama',
    chatPath: '/api/chat',
    probePath: '/api/tags',
    chatBody: (content, extra = {}) =>
      JSON.stringify({ message: { role: 'assistant', content }, done: true, ...extra }),
    probeBody: (models) => JSON.stringify({ models: models.map((name) => ({ name })) }),
    create: (config, deps) => createOllamaProvider(config, deps),
  },
];

export const FAST_DEPS: ProviderDeps = { fetch: loopbackOnlyFetch(), retryDelayMs: 0 };
