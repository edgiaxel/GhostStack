import { aiPlanJsonSchema, parsePlanText } from '@ghoststack/ai-core';
import type { AIIssue, AIProviderAdapter } from '@ghoststack/ai-core';
import { err, ok } from '@ghoststack/domain';
import { isRecord, requestJson } from './http';
import { SYSTEM_PROMPT, userMessage } from './prompt';

export interface OllamaConfig {
  /** Defaults to the local daemon. */
  readonly baseUrl?: string;
  readonly model: string;
  /** Local models are slow, so the default is generous. */
  readonly timeoutMs?: number;
  readonly fetch?: typeof fetch;
}

const DEFAULT_BASE_URL = 'http://127.0.0.1:11434';

/** Native Ollama chat API with a JSON-schema `format`. Always local: it never talks to another host. */
export function createOllamaAdapter(config: OllamaConfig): AIProviderAdapter {
  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  const timeoutMs = config.timeoutMs ?? 300_000;
  const http = (signal?: AbortSignal) => ({
    timeoutMs,
    ...(config.fetch ? { fetch: config.fetch } : {}),
    signal,
  });
  const missingModel = (): AIIssue => ({
    code: 'PROVIDER_UNAVAILABLE',
    message: 'The model is not installed in Ollama.',
    path: [],
  });

  return {
    id: 'ollama',
    capabilities: { structuredOutput: 'json-schema', local: true, requiresCredential: false },

    async testConnection(options) {
      const reply = await requestJson(
        `${baseUrl}/api/tags`,
        { method: 'GET' },
        http(options?.signal),
      );
      if (!reply.ok) return reply;
      const models = isRecord(reply.value.body) ? reply.value.body['models'] : undefined;
      const names = Array.isArray(models)
        ? models.flatMap((m) => (isRecord(m) && typeof m['name'] === 'string' ? [m['name']] : []))
        : [];
      return names.includes(config.model) ? ok({ model: config.model }) : err(missingModel());
    },

    async generatePlan(context, prompt, options) {
      const reply = await requestJson(
        `${baseUrl}/api/chat`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            model: config.model,
            stream: false,
            format: aiPlanJsonSchema(),
            options: { temperature: 0 },
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: userMessage(context, prompt) },
            ],
          }),
        },
        http(options?.signal),
      );
      if (!reply.ok) return reply;
      const message = isRecord(reply.value.body) ? reply.value.body['message'] : undefined;
      const content = isRecord(message) ? message['content'] : undefined;
      if (typeof content !== 'string' || content.length === 0) {
        return err({
          code: 'INVALID_AI_PLAN',
          message: 'The provider returned no text.',
          path: [],
        });
      }
      return parsePlanText(content);
    },
  };
}
