import { request } from 'node:http';
import { buildFixtureBundle } from '@ghoststack/domain/testing';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createBridgeCore } from './core';
import { createBridgeHttpServer } from './httpServer';
import type { RunningBridge } from './httpServer';

const AGENT = 'a'.repeat(48);
const EDITOR = 'e'.repeat(48);
const ORIGIN = 'https://app.example';

interface Reply {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  json: unknown;
}

function call(
  bridge: RunningBridge,
  method: string,
  path: string,
  options: { token?: string; origin?: string | null; body?: unknown; rawBody?: string } = {},
): Promise<Reply> {
  const origin = options.origin === undefined ? ORIGIN : options.origin;
  const payload =
    options.rawBody ?? (options.body === undefined ? undefined : JSON.stringify(options.body));
  return new Promise((resolve, reject) => {
    const req = request(
      {
        host: '127.0.0.1',
        port: bridge.port,
        method,
        path,
        headers: {
          host: `127.0.0.1:${bridge.port}`,
          'content-type': 'application/json',
          ...(options.token === undefined ? {} : { authorization: `Bearer ${options.token}` }),
          ...(origin === null ? {} : { origin }),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json: unknown = text;
          try {
            json = text === '' ? null : JSON.parse(text);
          } catch {
            // keep the raw text
          }
          resolve({ status: res.statusCode ?? 0, headers: res.headers, json });
        });
      },
    );
    req.on('error', reject);
    req.end(payload);
  });
}

const plan = (planId: string) => ({
  planVersion: 1,
  planId,
  requestSummary: 'agent request',
  commands: [{ command: 'ADD_CARD', title: 'Agent card' }],
});

let bridge: RunningBridge;
let core = createBridgeCore();
const bundle = buildFixtureBundle();

beforeAll(async () => {
  core = createBridgeCore();
  bridge = await createBridgeHttpServer({
    core,
    token: AGENT,
    editorToken: EDITOR,
    allowedOrigins: [ORIGIN],
  }).start();
});
afterAll(async () => {
  await bridge.close();
});

async function agent(): Promise<Client> {
  const client = new Client({ name: 'agent', version: '0' });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(bridge.url), {
      requestInit: { headers: { authorization: `Bearer ${AGENT}` } },
    }),
  );
  return client;
}

describe('configuration', () => {
  it('refuses a weak, missing-by-mistake or identical editor token', () => {
    const base = { core: createBridgeCore(), token: AGENT };
    expect(() => createBridgeHttpServer({ ...base, editorToken: 'short' })).toThrow(/editor token/);
    expect(() => createBridgeHttpServer({ ...base, editorToken: AGENT })).toThrow(/differ/);
  });

  it('keeps the editor surface off when no editor token is configured', async () => {
    const off = await createBridgeHttpServer({
      core: createBridgeCore(),
      token: AGENT,
      allowedOrigins: [ORIGIN],
    }).start();
    const reply = await call(off, 'GET', '/editor/proposals', { token: AGENT });
    expect(reply.status).toBe(404);
    await off.close();
  });
});

describe('token separation', () => {
  it('rejects the agent token on every editor route', async () => {
    for (const [method, path] of [
      ['PUT', '/editor/project'],
      ['GET', '/editor/proposals'],
      ['POST', '/editor/proposals/prp_1/decision'],
    ] as const) {
      const reply = await call(bridge, method, path, { token: AGENT, body: {} });
      expect(reply.status).toBe(401);
    }
  });

  it('rejects the editor token on the MCP endpoint', async () => {
    const reply = await call(bridge, 'POST', '/mcp', {
      token: EDITOR,
      origin: null,
      body: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    });
    expect(reply.status).toBe(401);
  });

  it('never echoes either token', async () => {
    const reply = await call(bridge, 'GET', '/editor/proposals', { token: 'x'.repeat(48) });
    expect(JSON.stringify(reply)).not.toContain(EDITOR);
    expect(JSON.stringify(reply)).not.toContain(AGENT);
  });
});

describe('editor surface needs a browser origin', () => {
  it('rejects a request with no Origin even with the right token', async () => {
    expect(
      (await call(bridge, 'GET', '/editor/proposals', { token: EDITOR, origin: null })).status,
    ).toBe(403);
  });

  it('rejects an unlisted origin', async () => {
    const reply = await call(bridge, 'GET', '/editor/proposals', {
      token: EDITOR,
      origin: 'https://evil.example',
    });
    expect(reply.status).toBe(403);
    expect(reply.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('answers a preflight for PUT from the allowed origin with that exact origin', async () => {
    const reply = await call(bridge, 'OPTIONS', '/editor/project', {});
    expect(reply.status).toBe(204);
    expect(reply.headers['access-control-allow-origin']).toBe(ORIGIN);
    expect(String(reply.headers['access-control-allow-methods'])).toContain('PUT');
  });
});

describe('publishing the project', () => {
  it('rejects an invalid project with codes only and publishes nothing', async () => {
    const broken = { ...bundle.stack, entryCardId: 'marker-value-should-not-appear' };
    const reply = await call(bridge, 'PUT', '/editor/project', {
      token: EDITOR,
      body: { stack: broken },
    });
    expect(reply.status).toBe(422);
    expect(JSON.stringify(reply.json)).not.toContain('marker-value-should-not-appear');
    expect(core.readProject().ok).toBe(false);
  });

  it('rejects malformed JSON and the wrong method', async () => {
    expect(
      (await call(bridge, 'PUT', '/editor/project', { token: EDITOR, rawBody: '{nope' })).status,
    ).toBe(400);
    expect((await call(bridge, 'GET', '/editor/project', { token: EDITOR })).status).toBe(405);
  });

  it('publishes a valid stack, and the agent then sees it through MCP', async () => {
    const reply = await call(bridge, 'PUT', '/editor/project', {
      token: EDITOR,
      body: { stack: bundle.stack },
    });
    expect(reply.status).toBe(200);
    expect(reply.headers['access-control-allow-origin']).toBe(ORIGIN);
    const client = await agent();
    const result = await client.callTool({ name: 'get_stack_summary', arguments: {} });
    const text = ((result.content as { text: string }[])[0] as { text: string }).text;
    expect((JSON.parse(text) as { title: string }).title).toBe(bundle.stack.title);
    await client.close();
  });
});

describe('proposal round trip', () => {
  it('lets an agent propose, the editor decide, and no one else approve', async () => {
    await call(bridge, 'PUT', '/editor/project', { token: EDITOR, body: { stack: bundle.stack } });
    const client = await agent();
    const proposed = await client.callTool({
      name: 'propose_stack_patch',
      arguments: { plan: plan('round-trip') },
    });
    expect(proposed.isError).toBeFalsy();

    const listed = await call(bridge, 'GET', '/editor/proposals', { token: EDITOR });
    const [proposal] = (
      listed.json as { proposals: { proposalId: string; status: string; source: string }[] }
    ).proposals.filter((p) => p.status === 'pending');
    expect(proposal?.source).toBe('mcp-client');
    const id = proposal?.proposalId ?? '';

    // The agent token cannot decide, and the proposal stays pending.
    const forged = await call(bridge, 'POST', `/editor/proposals/${id}/decision`, {
      token: AGENT,
      body: { status: 'approved' },
    });
    expect(forged.status).toBe(401);
    expect(core.getProposal(id)?.status).toBe('pending');

    const approved = await call(bridge, 'POST', `/editor/proposals/${id}/decision`, {
      token: EDITOR,
      body: { status: 'approved' },
    });
    expect(approved.status).toBe(200);
    const applied = await call(bridge, 'POST', `/editor/proposals/${id}/decision`, {
      token: EDITOR,
      body: { status: 'applied', detail: 'x'.repeat(500) },
    });
    expect(applied.status).toBe(200);
    expect(core.getProposal(id)?.detail?.length).toBe(200);
    await client.close();
  });

  it('rejects bad decisions: unknown id, unknown status, pending, repeated transitions', async () => {
    const decide = (id: string, body: unknown) =>
      call(bridge, 'POST', `/editor/proposals/${id}/decision`, { token: EDITOR, body });
    expect((await decide('prp_missing', { status: 'approved' })).status).toBe(404);
    const client = await agent();
    await client.callTool({
      name: 'propose_stack_patch',
      arguments: { plan: plan('bad-decisions') },
    });
    const id =
      core.listProposals('pending').find((p) => p.plan.planId === 'bad-decisions')?.proposalId ??
      '';
    expect((await decide(id, { status: 'pending' })).status).toBe(400);
    expect((await decide(id, { status: 'bogus' })).status).toBe(400);
    expect((await decide(id, { status: 'applied' })).status).toBe(409);
    expect((await decide(id, { status: 'rejected' })).status).toBe(200);
    expect((await decide(id, { status: 'approved' })).status).toBe(409);
    await client.close();
  });

  it('does not match decision routes with odd identifiers', async () => {
    const reply = await call(bridge, 'POST', '/editor/proposals/../../mcp/decision', {
      token: EDITOR,
      body: { status: 'approved' },
    });
    expect([404, 405]).toContain(reply.status);
  });
});
