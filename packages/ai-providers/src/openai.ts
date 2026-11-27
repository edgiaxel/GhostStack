import type { AIProviderAdapter, PlanRequest, ProviderConfig } from '@ghoststack/shared-contracts';
import { ok } from '@ghoststack/shared-contracts';
import { invalidAdapter, withSafeSerialization } from './adapter-util';
import { runChatPlan, type ChatMessage, type ChatWire } from './chat';
import { MESSAGES, fail } from './errors';
import { boundModels, connectedDetail, runConnectionTest } from './connection';
import { joinUrl, resolveConfig } from './config';
import { resolveDeps, type ProviderDeps } from './platform';
import { PLAN_JSON_SCHEMA } from './prompt';
import { DEFAULT_GENERATE_TIMEOUT_MS } from './transport';

export interface OpenAICompatibleOptions {
  /** Ask for JSON Schema output. Default: only for `api.openai.com`. */
  structuredOutput?: boolean;
  /** Ask for JSON-object output when schema output is off. Default true. */
  jsonMode?: boolean;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Hosted endpoints known to honor `response_format: json_schema`. Without the schema, models answer in
 * JSON mode and often flatten `command` to a string (seen with OpenRouter in the M3.6 live run).
 */
export const STRUCTURED_OUTPUT_HOSTS = ['https://api.openai.com', 'https://openrouter.ai/api'] as const;

/** `choices[0].message.content`, or `undefined` when absent or cut off (`finish_reason: length`). */
export function readOpenAIContent(envelope: unknown): string | undefined {
  if (!isObject(envelope) || !Array.isArray(envelope['choices'])) return undefined;
  const choice: unknown = envelope['choices'][0];
  if (!isObject(choice)) return undefined;
  if (choice['finish_reason'] === 'length') return undefined;
  const message = choice['message'];
  const content = isObject(message) ? message['content'] : undefined;
  return typeof content === 'string' && content.length > 0 ? content : undefined;
}

export function createOpenAICompatibleProvider(
  config: ProviderConfig,
  deps?: ProviderDeps,
  options: OpenAICompatibleOptions = {},
): AIProviderAdapter {
  const resolved = resolveConfig({ ...config, kind: 'openai-compatible' });
  if (!resolved.ok) return invalidAdapter('openai-compatible', 'OpenAI-compatible');
  const c = resolved.value;
  const baseUrl = c.baseUrl!;
  const hosted = STRUCTURED_OUTPUT_HOSTS.some((h) => baseUrl.startsWith(h));
  const structuredOutput = options.structuredOutput ?? hosted;
  const jsonMode = options.jsonMode ?? true;
  const d = resolveDeps(deps);
  const headers: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json' };
  if (c.apiKey) headers['authorization'] = `Bearer ${c.apiKey}`;
  const getHeaders: Record<string, string> = { accept: 'application/json' };
  if (c.apiKey) getHeaders['authorization'] = `Bearer ${c.apiKey}`;

  const adapter: AIProviderAdapter = {
    id: 'openai-compatible',
    label: c.loopback ? 'OpenAI-compatible (this computer)' : 'OpenAI-compatible (remote)',
    capabilities: { structuredOutput, jsonMode, streaming: false, local: c.loopback },
    async testConnection(signal) {
      return runConnectionTest(
        d,
        {
          url: joinUrl(baseUrl, 'models'),
          headers: getHeaders,
          networkMessage: MESSAGES.network,
          readModels: (envelope) => {
            const list = isObject(envelope) ? envelope['data'] : undefined;
            if (!Array.isArray(list)) return undefined;
            return boundModels(list.map((m: unknown) => (isObject(m) ? m['id'] : undefined)));
          },
          describe: (models) => {
            const base = connectedDetail(models?.length);
            const missing = models !== undefined && c.model !== undefined && !models.includes(c.model);
            const detail = missing ? `${base} The model "${c.model}" was not listed.` : base;
            return ok(
              models === undefined ? { ok: true as const, detail } : { ok: true as const, detail, models },
            );
          },
        },
        c.timeoutMs,
        signal,
      );
    },
    async generatePlan(request: PlanRequest) {
      if (c.model === undefined) return fail('PROVIDER_UNSUPPORTED_CAPABILITY', 'Choose a model first.');
      const model = c.model;
      const wire: ChatWire = {
        url: joinUrl(baseUrl, 'chat/completions'),
        headers,
        networkMessage: MESSAGES.network,
        buildBody: (messages: ChatMessage[]) => {
          const body: Record<string, unknown> = { model, messages, temperature: 0 };
          if (structuredOutput) {
            body['response_format'] = {
              type: 'json_schema',
              json_schema: { name: 'ghoststack_plan', strict: false, schema: PLAN_JSON_SCHEMA },
            };
          } else if (jsonMode) body['response_format'] = { type: 'json_object' };
          return body;
        },
        readContent: readOpenAIContent,
      };
      return runChatPlan({
        deps: d,
        wire,
        request,
        timeoutMs: c.timeoutMs ?? DEFAULT_GENERATE_TIMEOUT_MS,
        providerId: 'openai-compatible',
        model,
      });
    },
  };
  return withSafeSerialization(adapter);
}
