import type { AIProviderAdapter, PlanRequest, ProviderConfig } from '@ghoststack/shared-contracts';
import { err, ok } from '@ghoststack/shared-contracts';
import { invalidAdapter, withSafeSerialization } from './adapter-util';
import { runChatPlan, type ChatMessage, type ChatWire } from './chat';
import { MESSAGES, fail } from './errors';
import { boundModels, connectedDetail, runConnectionTest } from './connection';
import { joinUrl, resolveConfig } from './config';
import { resolveDeps, type ProviderDeps } from './platform';
import { PLAN_JSON_SCHEMA } from './prompt';
import { DEFAULT_GENERATE_TIMEOUT_MS } from './transport';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** `message.content`, or `undefined` when absent or cut off (`done_reason: length`). */
export function readOllamaContent(envelope: unknown): string | undefined {
  if (!isObject(envelope)) return undefined;
  if (envelope['done_reason'] === 'length') return undefined;
  const message = envelope['message'];
  const content = isObject(message) ? message['content'] : undefined;
  return typeof content === 'string' && content.length > 0 ? content : undefined;
}

export function createOllamaProvider(config: ProviderConfig, deps?: ProviderDeps): AIProviderAdapter {
  const resolved = resolveConfig({ ...config, kind: 'ollama' });
  if (!resolved.ok) return invalidAdapter('ollama', 'Ollama');
  const c = resolved.value;
  const baseUrl = c.baseUrl!;
  const d = resolveDeps(deps);
  const headers = { 'content-type': 'application/json', accept: 'application/json' };

  const adapter: AIProviderAdapter = {
    id: 'ollama',
    label: c.loopback ? 'Ollama (local)' : 'Ollama (remote host)',
    capabilities: { structuredOutput: true, jsonMode: true, streaming: false, local: c.loopback },
    async testConnection(signal) {
      const model = c.model;
      return runConnectionTest(
        d,
        {
          url: joinUrl(baseUrl, 'api/tags'),
          headers: { accept: 'application/json' },
          networkMessage: MESSAGES.networkOllama,
          readModels: (envelope) => {
            const list = isObject(envelope) ? envelope['models'] : undefined;
            if (!Array.isArray(list)) return undefined;
            return boundModels(list.map((m: unknown) => (isObject(m) ? m['name'] : undefined)));
          },
          describe: (models) => {
            if (models === undefined) return fail('PROVIDER_UNAVAILABLE', MESSAGES.badEnvelope);
            if (model !== undefined && !models.some((n) => n === model || n === `${model}:latest`)) {
              return err({
                code: 'PROVIDER_UNSUPPORTED_CAPABILITY' as const,
                message: `The model "${model}" is not pulled. Run "ollama pull ${model}" and test again.`,
              });
            }
            return ok({ ok: true as const, detail: connectedDetail(models.length), models });
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
        url: joinUrl(baseUrl, 'api/chat'),
        headers,
        networkMessage: MESSAGES.networkOllama,
        buildBody: (messages: ChatMessage[]) => ({
          model,
          messages,
          stream: false,
          format: PLAN_JSON_SCHEMA,
          options: { temperature: 0 },
        }),
        readContent: readOllamaContent,
      };
      return runChatPlan({
        deps: d,
        wire,
        request,
        timeoutMs: c.timeoutMs ?? DEFAULT_GENERATE_TIMEOUT_MS,
        providerId: 'ollama',
        model,
      });
    },
  };
  return withSafeSerialization(adapter);
}
