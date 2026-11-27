import type { AIProviderAdapter } from '@ghoststack/shared-contracts';
import { err } from '@ghoststack/shared-contracts';
import { MESSAGES } from './errors';

/**
 * Adds `toJSON` and `toString` that name the adapter and nothing else. The adapter holds no property
 * that returns a key, so serializing or printing it cannot leak one.
 */
export function withSafeSerialization(adapter: AIProviderAdapter): AIProviderAdapter {
  const summary = { id: adapter.id, label: adapter.label, capabilities: adapter.capabilities };
  return Object.assign(adapter, {
    toJSON: () => summary,
    toString: () => `[AIProviderAdapter ${adapter.id}]`,
  });
}

/** An adapter for settings that failed validation. It sends nothing and says so on every call. */
export function invalidAdapter(id: string, label: string): AIProviderAdapter {
  const refuse = async () =>
    err({ code: 'PROVIDER_UNSUPPORTED_CAPABILITY' as const, message: MESSAGES.badConfig });
  return withSafeSerialization({
    id,
    label,
    capabilities: { structuredOutput: false, jsonMode: false, streaming: false, local: false },
    testConnection: refuse,
    generatePlan: refuse,
  });
}
