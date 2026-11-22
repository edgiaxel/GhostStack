import { aiPlanJsonSchema, parsePlanText } from '@ghoststack/ai-core';
import type { AIIssue, AIProviderAdapter, ProjectContext } from '@ghoststack/ai-core';
import { err, ok } from '@ghoststack/domain';
import type { Result } from '@ghoststack/domain';
import { isRecord, requestJson, sleep } from './http';
import type { HttpReply } from './http';
import { SYSTEM_PROMPT, userMessage } from './prompt';

export interface OpenAICompatibleConfig {
  readonly id: string;
  /** For example `https://openrouter.ai/api/v1`. No trailing slash. */
  readonly baseUrl: string;
  readonly model: string;
  /** Held in memory only. Sent as a Bearer token and never logged or placed in an error. */
  readonly apiKey?: string;
  readonly local: boolean;
  readonly structuredOutput?: 'json-schema' | 'json-mode' | 'none';
  readonly timeoutMs?: number;
  readonly maxTokens?: number;
  /** Path used by `testConnection`. Providers differ, so it is configurable. */
  readonly connectionPath?: string;
  /** A 429 is retried only when this is above 0, at most this many times, and never longer than maxWaitMs. */
  readonly retry429?: { readonly max: number; readonly maxWaitMs: number };
  readonly fetch?: typeof fetch;
  readonly sleep?: (ms: number) => Promise<void>;
}

const truncated = (): AIIssue => ({
  code: 'INVALID_AI_PLAN',
  message: 'The provider response was cut off before the plan was complete.',
  path: [],
});

/** Reads `choices[0].message.content` defensively: the reply is untrusted. */
function contentOf(body: unknown): Result<string, AIIssue> {
  const choice =
    isRecord(body) && Array.isArray(body['choices'])
      ? (body['choices'] as unknown[])[0]
      : undefined;
  if (!isRecord(choice)) {
    return err({ code: 'INVALID_AI_PLAN', message: 'The provider returned no choices.', path: [] });
  }
  if (choice['finish_reason'] === 'length') return err(truncated());
  const message = choice['message'];
  const content = isRecord(message) ? message['content'] : undefined;
  if (typeof content !== 'string' || content.length === 0) {
    return err({ code: 'INVALID_AI_PLAN', message: 'The provider returned no text.', path: [] });
  }
  return ok(content);
}

export function createOpenAICompatibleAdapter(config: OpenAICompatibleConfig): AIProviderAdapter {
  const timeoutMs = config.timeoutMs ?? 60_000;
  const mode = config.structuredOutput ?? 'json-schema';
  const pause = config.sleep ?? sleep;
  const headers = (): Record<string, string> => ({
    'content-type': 'application/json',
    ...(config.apiKey === undefined || config.apiKey === ''
      ? {}
      : { authorization: `Bearer ${config.apiKey}` }),
  });

  const body = (context: ProjectContext, prompt: string): string =>
    JSON.stringify({
      model: config.model,
      temperature: 0,
      ...(config.maxTokens === undefined ? {} : { max_tokens: config.maxTokens }),
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage(context, prompt) },
      ],
      ...(mode === 'json-schema'
        ? {
            response_format: {
              type: 'json_schema',
              json_schema: { name: 'ai_plan', strict: true, schema: aiPlanJsonSchema() },
            },
          }
        : mode === 'json-mode'
          ? { response_format: { type: 'json_object' } }
          : {}),
    });

  return {
    id: config.id,
    capabilities: {
      structuredOutput: mode,
      local: config.local,
      requiresCredential: config.apiKey !== undefined,
    },

    async testConnection(options) {
      const reply = await requestJson(
        `${config.baseUrl}${config.connectionPath ?? '/models'}`,
        { method: 'GET', headers: headers() },
        { timeoutMs, ...(config.fetch ? { fetch: config.fetch } : {}), signal: options?.signal },
      );
      return reply.ok ? ok({ model: config.model }) : reply;
    },

    async generatePlan(context, prompt, options) {
      const maxRetries = config.retry429?.max ?? 0;
      let attempt = 0;
      for (;;) {
        const reply: Result<HttpReply, AIIssue> = await requestJson(
          `${config.baseUrl}/chat/completions`,
          { method: 'POST', headers: headers(), body: body(context, prompt) },
          { timeoutMs, ...(config.fetch ? { fetch: config.fetch } : {}), signal: options?.signal },
        );
        if (reply.ok) {
          const content = contentOf(reply.value.body);
          return content.ok ? parsePlanText(content.value) : content;
        }
        const waitMs = reply.error.retryAfterMs;
        const retryable =
          reply.error.code === 'PROVIDER_RATE_LIMIT' &&
          attempt < maxRetries &&
          waitMs !== undefined &&
          waitMs <= (config.retry429?.maxWaitMs ?? 0);
        if (!retryable) return reply;
        attempt += 1;
        await pause(waitMs);
      }
    },
  };
}
