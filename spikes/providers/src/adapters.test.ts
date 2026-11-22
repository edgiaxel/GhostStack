import { buildProjectContext, requestPlan } from '@ghoststack/ai-core';
import { buildFixtureBundle } from '@ghoststack/domain/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createOllamaAdapter } from './ollama';
import { createOpenAICompatibleAdapter } from './openaiCompatible';
import { closedPort, completion, sendJson, startMockServer } from './mockServer.test-util';
import type { MockServer } from './mockServer.test-util';

// Not key-shaped on purpose: the secret scan would flag a realistic literal.
const FAKE_KEY = ['test', 'credential', 'value', '12345'].join('-');
const context = buildProjectContext(buildFixtureBundle().stack);

const goodPlan = {
  planVersion: 1,
  planId: 'plan-1',
  requestSummary: 'Add a card',
  commands: [{ command: 'ADD_CARD', title: 'From the model' }],
};

let server: MockServer;
beforeAll(async () => {
  server = await startMockServer((_req, res) =>
    sendJson(res, 200, completion(JSON.stringify(goodPlan))),
  );
});
afterAll(async () => {
  await server.close();
});
beforeEach(() => {
  server.requests.length = 0;
  server.setHandler((_req, res) => sendJson(res, 200, completion(JSON.stringify(goodPlan))));
});

const openai = (overrides: Partial<Parameters<typeof createOpenAICompatibleAdapter>[0]> = {}) =>
  createOpenAICompatibleAdapter({
    id: 'mock-hosted',
    baseUrl: server.baseUrl,
    model: 'mock-model',
    apiKey: FAKE_KEY,
    local: false,
    timeoutMs: 2000,
    ...overrides,
  });

describe('OpenAI-compatible adapter against a mock server', () => {
  it('returns a validated plan and sends the key only as a Bearer header', async () => {
    const result = await openai().generatePlan(context, 'add a card');
    expect(result.ok && result.value.commands[0]?.command).toBe('ADD_CARD');
    const sent = server.requests[0];
    expect(sent?.headers.authorization).toBe(`Bearer ${FAKE_KEY}`);
    expect(sent?.body).not.toContain(FAKE_KEY);
    const body = JSON.parse(sent?.body ?? '{}') as {
      response_format?: { type?: string };
      temperature?: number;
    };
    expect(body.response_format?.type).toBe('json_schema');
    expect(body.temperature).toBe(0);
  });

  it('accepts JSON wrapped in a code fence', async () => {
    server.setHandler((_r, res) =>
      sendJson(res, 200, completion('```json\n' + JSON.stringify(goodPlan) + '\n```')),
    );
    expect((await openai().generatePlan(context, 'x')).ok).toBe(true);
  });

  it.each([
    ['prose instead of JSON', completion('Sure, here you go!')],
    ['truncated JSON', completion('{"planVersion":1,"planId":"p"')],
    ['a valid JSON value of the wrong shape', completion('{"hello":"world"}')],
    [
      'a command outside the allowed set',
      completion(JSON.stringify({ ...goodPlan, commands: [{ command: 'RUN_SHELL' }] })),
    ],
    ['null content', completion(null)],
    ['empty content', completion('')],
    ['no choices', { choices: [] }],
    ['no choices field', { id: 'x' }],
    ['an array body', []],
    ['cut off by the token limit', completion(JSON.stringify(goodPlan), 'length')],
  ])('maps %s to INVALID_AI_PLAN', async (_name, body) => {
    server.setHandler((_r, res) => sendJson(res, 200, body));
    const result = await openai().generatePlan(context, 'x');
    expect(!result.ok && result.error.code).toBe('INVALID_AI_PLAN');
  });

  it('maps a non-JSON body to INVALID_AI_PLAN', async () => {
    server.setHandler((_r, res) => sendJson(res, 200, '<html>gateway error</html>'));
    const result = await openai().generatePlan(context, 'x');
    expect(!result.ok && result.error.code).toBe('INVALID_AI_PLAN');
  });

  it.each([
    [401, 'PROVIDER_AUTH_FAILED'],
    [403, 'PROVIDER_AUTH_FAILED'],
    [400, 'PROVIDER_UNSUPPORTED_CAPABILITY'],
    [422, 'PROVIDER_UNSUPPORTED_CAPABILITY'],
    [500, 'PROVIDER_UNAVAILABLE'],
    [503, 'PROVIDER_UNAVAILABLE'],
  ])('maps HTTP %i to %s', async (status, code) => {
    server.setHandler((_r, res) =>
      sendJson(res, status, { error: { message: `secret ${FAKE_KEY}` } }),
    );
    const result = await openai().generatePlan(context, 'x');
    expect(!result.ok && result.error.code).toBe(code);
    // The error body is never copied into the result.
    expect(JSON.stringify(result)).not.toContain(FAKE_KEY);
  });

  it('reports a rate limit with Retry-After and does not retry by default', async () => {
    server.setHandler((_r, res) => sendJson(res, 429, { error: {} }, { 'retry-after': '7' }));
    const result = await openai().generatePlan(context, 'x');
    expect(!result.ok && result.error.code).toBe('PROVIDER_RATE_LIMIT');
    expect(!result.ok && result.error.retryAfterMs).toBe(7000);
    expect(server.requests).toHaveLength(1);
  });

  it('retries a 429 once when configured, waiting for Retry-After', async () => {
    let calls = 0;
    server.setHandler((_r, res) => {
      calls += 1;
      if (calls === 1) sendJson(res, 429, {}, { 'retry-after': '2' });
      else sendJson(res, 200, completion(JSON.stringify(goodPlan)));
    });
    const waits: number[] = [];
    const result = await openai({
      retry429: { max: 1, maxWaitMs: 5000 },
      sleep: (ms) => {
        waits.push(ms);
        return Promise.resolve();
      },
    }).generatePlan(context, 'x');
    expect(result.ok).toBe(true);
    expect(waits).toEqual([2000]);
    expect(server.requests).toHaveLength(2);
  });

  it('stops after the allowed retries and when the wait is too long', async () => {
    server.setHandler((_r, res) => sendJson(res, 429, {}, { 'retry-after': '1' }));
    const twice = await openai({
      retry429: { max: 1, maxWaitMs: 5000 },
      sleep: () => Promise.resolve(),
    }).generatePlan(context, 'x');
    expect(!twice.ok && twice.error.code).toBe('PROVIDER_RATE_LIMIT');
    expect(server.requests).toHaveLength(2);

    server.requests.length = 0;
    server.setHandler((_r, res) => sendJson(res, 429, {}, { 'retry-after': '3600' }));
    const long = await openai({ retry429: { max: 1, maxWaitMs: 5000 } }).generatePlan(context, 'x');
    expect(!long.ok && long.error.code).toBe('PROVIDER_RATE_LIMIT');
    expect(server.requests).toHaveLength(1);
  });

  it('times out when the server never answers', async () => {
    server.setHandler(() => undefined);
    const result = await openai({ timeoutMs: 100 }).generatePlan(context, 'x');
    expect(!result.ok && result.error.code).toBe('PROVIDER_TIMEOUT');
  });

  it('honors an external abort signal', async () => {
    server.setHandler(() => undefined);
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 50);
    const result = await openai({ timeoutMs: 5000 }).generatePlan(context, 'x', {
      signal: controller.signal,
    });
    expect(!result.ok && result.error.code).toBe('PROVIDER_UNAVAILABLE');
  });

  it('reports an unreachable endpoint without leaking the key', async () => {
    const result = await openai({ baseUrl: await closedPort() }).generatePlan(context, 'x');
    expect(!result.ok && result.error.code).toBe('PROVIDER_UNAVAILABLE');
    expect(JSON.stringify(result)).not.toContain(FAKE_KEY);
  });

  it('rejects an oversized response', async () => {
    server.setHandler((_r, res) => sendJson(res, 200, 'x'.repeat(2_100_000)));
    const result = await openai().generatePlan(context, 'x');
    expect(!result.ok && result.error.code).toBe('PROVIDER_UNAVAILABLE');
  });

  it('omits the Authorization header when no key is configured', async () => {
    await openai({ apiKey: '' }).generatePlan(context, 'x');
    expect(server.requests[0]?.headers.authorization).toBeUndefined();
  });

  it('supports json-mode and none without a schema in the request', async () => {
    await openai({ structuredOutput: 'json-mode' }).generatePlan(context, 'x');
    await openai({ structuredOutput: 'none' }).generatePlan(context, 'x');
    const [a, b] = server.requests.map((r) => JSON.parse(r.body) as { response_format?: unknown });
    expect(a?.response_format).toEqual({ type: 'json_object' });
    expect(b?.response_format).toBeUndefined();
  });

  it('tests the connection and reports failures', async () => {
    expect((await openai().testConnection()).ok).toBe(true);
    server.setHandler((_r, res) => sendJson(res, 401, {}));
    const bad = await openai().testConnection();
    expect(!bad.ok && bad.error.code).toBe('PROVIDER_AUTH_FAILED');
  });
});

describe('Ollama adapter against a mock server', () => {
  const ollama = (overrides: Partial<Parameters<typeof createOllamaAdapter>[0]> = {}) =>
    createOllamaAdapter({
      baseUrl: server.baseUrl,
      model: 'gemma3:4b',
      timeoutMs: 2000,
      ...overrides,
    });

  it('returns a validated plan and asks for a JSON schema format', async () => {
    server.setHandler((_r, res) =>
      sendJson(res, 200, { message: { role: 'assistant', content: JSON.stringify(goodPlan) } }),
    );
    const result = await ollama().generatePlan(context, 'add a card');
    expect(result.ok).toBe(true);
    const sent = JSON.parse(server.requests[0]?.body ?? '{}') as {
      format?: { type?: string };
      stream?: boolean;
    };
    expect(sent.stream).toBe(false);
    expect(sent.format?.type).toBe('object');
    expect(server.requests[0]?.headers.authorization).toBeUndefined();
  });

  it('maps a malformed reply to INVALID_AI_PLAN', async () => {
    server.setHandler((_r, res) => sendJson(res, 200, { message: { content: 'not json' } }));
    const result = await ollama().generatePlan(context, 'x');
    expect(!result.ok && result.error.code).toBe('INVALID_AI_PLAN');
  });

  it('reports a missing model from the tag list', async () => {
    server.setHandler((_r, res) => sendJson(res, 200, { models: [{ name: 'llama3:8b' }] }));
    const missing = await ollama().testConnection();
    expect(!missing.ok && missing.error.message).toContain('not installed');
    server.setHandler((_r, res) => sendJson(res, 200, { models: [{ name: 'gemma3:4b' }] }));
    expect((await ollama().testConnection()).ok).toBe(true);
  });

  it('reports a daemon that is not running', async () => {
    const result = await ollama({ baseUrl: await closedPort() }).testConnection();
    expect(!result.ok && result.error.code).toBe('PROVIDER_UNAVAILABLE');
  });
});

describe('privacy and fallback', () => {
  it('does not call a hosted provider when the local provider is down', async () => {
    const remote = await startMockServer((_r, res) =>
      sendJson(res, 200, completion(JSON.stringify(goodPlan))),
    );
    const local = createOllamaAdapter({
      baseUrl: await closedPort(),
      model: 'gemma3:4b',
      timeoutMs: 500,
    });
    const hosted = createOpenAICompatibleAdapter({
      id: 'hosted',
      baseUrl: remote.baseUrl,
      model: 'm',
      apiKey: FAKE_KEY,
      local: false,
    });
    const result = await requestPlan(local, context, 'x', { allowRemote: true });
    expect(result.ok).toBe(false);
    expect(remote.requests).toHaveLength(0);
    // The hosted adapter is refused unless the creator allowed it, and then it is called exactly once.
    const refused = await requestPlan(hosted, context, 'x', { allowRemote: false });
    expect(!refused.ok && refused.error.code).toBe('REMOTE_PROVIDER_NOT_ALLOWED');
    expect(remote.requests).toHaveLength(0);
    await requestPlan(hosted, context, 'x', { allowRemote: true });
    expect(remote.requests).toHaveLength(1);
    await remote.close();
  });

  it('marks the Ollama adapter as local and the hosted one as remote', () => {
    expect(createOllamaAdapter({ model: 'm' }).capabilities.local).toBe(true);
    expect(openai().capabilities.local).toBe(false);
    expect(openai().capabilities.requiresCredential).toBe(true);
  });
});
