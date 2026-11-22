import { request } from 'node:http';
import { buildFixtureBundle } from '@ghoststack/domain/testing';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createBridgeCore } from './core';
import { MAX_BODY_BYTES, createBridgeHttpServer } from './httpServer';
import type { RunningBridge } from './httpServer';
import { TOOL_NAMES } from './tools';

const TOKEN = 'k'.repeat(48);
const APP_ORIGIN = 'https://app.example';

interface Reply {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

function raw(
  bridge: RunningBridge,
  options: { method?: string; path?: string; headers?: Record<string, string>; body?: string },
): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        host: '127.0.0.1',
        port: bridge.port,
        method: options.method ?? 'POST',
        path: options.path ?? '/mcp',
        headers: {
          host: `127.0.0.1:${bridge.port}`,
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          ...options.headers,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () =>
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          }),
        );
      },
    );
    req.on('error', reject);
    req.end(options.body);
  });
}

const auth = { authorization: `Bearer ${TOKEN}` };
const listTools = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' });

let bridge: RunningBridge;
const core = createBridgeCore();
beforeAll(async () => {
  core.publishProject(buildFixtureBundle());
  bridge = await createBridgeHttpServer({
    core,
    token: TOKEN,
    allowedOrigins: [APP_ORIGIN],
  }).start();
});
afterAll(async () => {
  await bridge.close();
});

describe('binding', () => {
  it('listens on loopback only', () => {
    expect(bridge.url.startsWith('http://127.0.0.1:')).toBe(true);
  });

  it('refuses to start with a weak or missing token', () => {
    expect(() => createBridgeHttpServer({ core, token: '' })).toThrow(/missing/);
    expect(() => createBridgeHttpServer({ core, token: 'short' })).toThrow(/too-short/);
  });
});

describe('authentication', () => {
  it.each([
    ['no Authorization header', {}],
    ['a wrong token', { authorization: `Bearer ${'z'.repeat(48)}` }],
    ['a non-Bearer scheme', { authorization: `Basic ${TOKEN}` }],
  ])('returns 401 for %s and never echoes the token', async (_name, headers) => {
    const reply = await raw(bridge, { headers, body: listTools });
    expect(reply.status).toBe(401);
    expect(reply.body).not.toContain(TOKEN);
    expect(JSON.stringify(reply.headers)).not.toContain(TOKEN);
  });

  it('rejects the token passed in the query string', async () => {
    const reply = await raw(bridge, { path: `/mcp?token=${TOKEN}`, body: listTools });
    expect(reply.status).toBe(401);
  });
});

describe('host and origin checks', () => {
  it('rejects a foreign Host header even with a valid token (DNS rebinding)', async () => {
    const reply = await raw(bridge, {
      headers: { ...auth, host: `evil.example:${bridge.port}` },
      body: listTools,
    });
    expect(reply.status).toBe(403);
  });

  it('rejects an unlisted browser origin before looking at the token', async () => {
    const reply = await raw(bridge, {
      headers: { ...auth, origin: 'https://evil.example' },
      body: listTools,
    });
    expect(reply.status).toBe(403);
    expect(reply.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('rejects the "null" origin', async () => {
    const reply = await raw(bridge, { headers: { ...auth, origin: 'null' }, body: listTools });
    expect(reply.status).toBe(403);
  });

  it('answers a preflight for an allowed origin with that exact origin, never a wildcard', async () => {
    const reply = await raw(bridge, { method: 'OPTIONS', headers: { origin: APP_ORIGIN } });
    expect(reply.status).toBe(204);
    expect(reply.headers['access-control-allow-origin']).toBe(APP_ORIGIN);
    expect(reply.headers['access-control-allow-origin']).not.toBe('*');
    expect(String(reply.headers['access-control-allow-headers'])).toContain('authorization');
  });

  it('refuses a preflight for an unlisted origin or with no origin', async () => {
    expect(
      (await raw(bridge, { method: 'OPTIONS', headers: { origin: 'https://evil.example' } }))
        .status,
    ).toBe(403);
    expect((await raw(bridge, { method: 'OPTIONS' })).status).toBe(403);
  });

  it('adds the CORS header only for an allowed origin on a real call', async () => {
    const allowed = await raw(bridge, {
      headers: { ...auth, origin: APP_ORIGIN },
      body: listTools,
    });
    expect(allowed.status).toBe(200);
    expect(allowed.headers['access-control-allow-origin']).toBe(APP_ORIGIN);
    const none = await raw(bridge, { headers: auth, body: listTools });
    expect(none.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('routing and body handling', () => {
  it('rejects other methods and paths with a valid token', async () => {
    expect((await raw(bridge, { method: 'GET', headers: auth })).status).toBe(405);
    expect((await raw(bridge, { method: 'DELETE', headers: auth })).status).toBe(405);
    expect((await raw(bridge, { path: '/other', headers: auth, body: listTools })).status).toBe(
      404,
    );
  });

  it('rejects invalid JSON and oversized bodies', async () => {
    expect((await raw(bridge, { headers: auth, body: '{not json' })).status).toBe(400);
    const big = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'x',
      params: { pad: 'x'.repeat(MAX_BODY_BYTES) },
    });
    expect((await raw(bridge, { headers: auth, body: big })).status).toBe(413);
  });
});

describe('MCP over HTTP with the SDK client', () => {
  const connect = async (token = TOKEN) => {
    const client = new Client({ name: 'http-test', version: '0' });
    const transport = new StreamableHTTPClientTransport(new URL(bridge.url), {
      requestInit: { headers: { authorization: `Bearer ${token}` } },
    });
    await client.connect(transport);
    return client;
  };

  it('discovers the six tools and reads the project', async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([...TOOL_NAMES].sort());
    const result = await client.callTool({ name: 'get_stack_summary', arguments: {} });
    const text = ((result.content as { text: string }[])[0] as { text: string }).text;
    expect((JSON.parse(text) as { title: string }).title).toBe('Fixture stack');
    await client.close();
  });

  it('queues a proposal without changing the project', async () => {
    const client = await connect();
    const before = core.readProject();
    const result = await client.callTool({
      name: 'propose_stack_patch',
      arguments: {
        plan: {
          planVersion: 1,
          planId: 'http-plan',
          requestSummary: 'over http',
          commands: [{ command: 'ADD_CARD', title: 'Via HTTP' }],
        },
      },
    });
    expect(result.isError).toBeFalsy();
    expect(core.listProposals('pending').some((p) => p.plan.planId === 'http-plan')).toBe(true);
    const after = core.readProject();
    expect(after.ok && before.ok && after.value.bundle).toEqual(before.ok && before.value.bundle);
    await client.close();
  });

  it('fails to connect with a wrong token', async () => {
    await expect(connect('w'.repeat(48))).rejects.toThrow();
  });
});
