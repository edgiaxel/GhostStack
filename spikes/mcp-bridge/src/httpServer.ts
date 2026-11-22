import { createServer } from 'node:http';
import { validateProject } from '@ghoststack/domain';
import type { Stack } from '@ghoststack/domain';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { BridgeCore, ProposalStatus } from './core';
import {
  bearerToken,
  checkTokenStrength,
  isAllowedHost,
  isAllowedOrigin,
  tokensMatch,
} from './security';
import { createBridgeMcpServer } from './tools';

export const MAX_BODY_BYTES = 1_048_576;
export const MCP_PATH = '/mcp';
export const EDITOR_PREFIX = '/editor/';
const DECISIONS: readonly ProposalStatus[] = ['approved', 'rejected', 'applied', 'failed'];
const MAX_DETAIL_LENGTH = 200;

export interface BridgeHttpOptions {
  readonly core: BridgeCore;
  /** Secret for MCP clients (the agent). Works on /mcp only. Never logged or echoed. */
  readonly token: string;
  /**
   * Secret for the editor, held by the creator's browser and never given to an agent. Works on
   * /editor/* only, so an agent cannot approve its own proposals. Without it, /editor/* is off.
   */
  readonly editorToken?: string;
  /** Always loopback. A non-loopback host is refused. */
  readonly host?: '127.0.0.1' | '::1';
  readonly port?: number;
  /** Browser origins that may call the bridge, matched exactly. Empty means no browser access. */
  readonly allowedOrigins?: readonly string[];
}

export interface RunningBridge {
  readonly url: string;
  readonly port: number;
  close(): Promise<void>;
}

const send = (
  res: ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) => {
  res.writeHead(status, {
    'content-type': 'application/json',
    'cache-control': 'no-store',
    ...headers,
  });
  res.end(JSON.stringify(body));
};

const rpcError = (res: ServerResponse, status: number, code: number, message: string) =>
  send(res, status, { jsonrpc: '2.0', error: { code, message }, id: null });

async function readBody(req: IncomingMessage): Promise<{ ok: true; text: string } | { ok: false }> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) return { ok: false };
    chunks.push(chunk);
  }
  return { ok: true, text: Buffer.concat(chunks).toString('utf8') };
}

type JsonRead = { ok: true; value: unknown } | { ok: false; status: number; error: string };

async function readJson(req: IncomingMessage): Promise<JsonRead> {
  const body = await readBody(req);
  if (!body.ok) return { ok: false, status: 413, error: 'request too large' };
  try {
    return { ok: true, value: JSON.parse(body.text) as unknown };
  } catch {
    return { ok: false, status: 400, error: 'invalid JSON' };
  }
}

export function createBridgeHttpServer(options: BridgeHttpOptions) {
  const problem = checkTokenStrength(options.token);
  if (problem !== undefined) {
    throw new Error(
      `The bridge token is ${problem}. Provide at least 32 characters, for example from "openssl rand -hex 32".`,
    );
  }
  if (options.editorToken !== undefined) {
    const editorProblem = checkTokenStrength(options.editorToken);
    if (editorProblem !== undefined) {
      throw new Error(`The editor token is ${editorProblem}. Provide at least 32 characters.`);
    }
    if (options.editorToken === options.token) {
      throw new Error('The editor token must differ from the agent token.');
    }
  }
  const allowedOrigins = options.allowedOrigins ?? [];
  const host = options.host ?? '127.0.0.1';
  let boundPort = 0;

  async function handleEditor(
    req: IncomingMessage,
    res: ServerResponse,
    path: string,
    cors: Record<string, string>,
  ): Promise<void> {
    const route = path.slice(EDITOR_PREFIX.length);

    if (route === 'project') {
      if (req.method !== 'PUT')
        return send(res, 405, { error: 'method not allowed' }, { ...cors, allow: 'PUT' });
      const body = await readJson(req);
      if (!body.ok) return send(res, body.status, { error: body.error }, cors);
      const stack = (body.value as { stack?: unknown } | null)?.stack;
      const { errors } = validateProject(stack);
      if (errors.length > 0) {
        return send(
          res,
          422,
          {
            error: 'invalid project',
            problems: errors.map((e) => ({ code: e.code, path: e.path })),
          },
          cors,
        );
      }
      // Only the stack is published. Asset bytes stay in the editor, so bridge checkpoints are stack-only.
      const { revision } = options.core.publishProject({ stack: stack as Stack, assets: {} });
      return send(res, 200, { revision }, cors);
    }

    if (route === 'proposals') {
      if (req.method !== 'GET')
        return send(res, 405, { error: 'method not allowed' }, { ...cors, allow: 'GET' });
      return send(res, 200, { proposals: options.core.listProposals() }, cors);
    }

    const decision = /^proposals\/([A-Za-z0-9_-]{1,64})\/decision$/.exec(route);
    if (decision !== null) {
      if (req.method !== 'POST')
        return send(res, 405, { error: 'method not allowed' }, { ...cors, allow: 'POST' });
      const body = await readJson(req);
      if (!body.ok) return send(res, body.status, { error: body.error }, cors);
      const input = body.value as { status?: unknown; detail?: unknown } | null;
      const status = DECISIONS.find((candidate) => candidate === input?.status);
      const detail =
        typeof input?.detail === 'string' ? input.detail.slice(0, MAX_DETAIL_LENGTH) : undefined;
      if (status === undefined || status === 'pending') {
        return send(
          res,
          400,
          { error: 'status must be approved, rejected, applied or failed' },
          cors,
        );
      }
      const proposalId = decision[1] as string;
      if (options.core.getProposal(proposalId) === undefined) {
        return send(res, 404, { error: 'no such proposal' }, cors);
      }
      const decided = options.core.decideProposal(proposalId, status, detail);
      return decided.ok
        ? send(res, 200, { proposal: decided.value }, cors)
        : send(res, 409, { error: decided.error.message }, cors);
    }

    return send(res, 404, { error: 'not found' }, cors);
  }

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (!isAllowedHost(req.headers.host, boundPort)) {
      return send(res, 403, { error: 'host not allowed' });
    }

    const origin = req.headers.origin;
    const cors: Record<string, string> = {};
    if (origin !== undefined) {
      if (!isAllowedOrigin(origin, allowedOrigins))
        return send(res, 403, { error: 'origin not allowed' });
      cors['access-control-allow-origin'] = origin;
      cors['vary'] = 'Origin';
    }

    if (req.method === 'OPTIONS') {
      if (origin === undefined) return send(res, 403, { error: 'preflight needs an origin' });
      res.writeHead(204, {
        ...cors,
        'access-control-allow-methods': 'GET, POST, PUT, OPTIONS',
        'access-control-allow-headers': 'authorization, content-type, mcp-protocol-version',
        'access-control-max-age': '600',
      });
      return void res.end();
    }

    const provided = bearerToken(req.headers.authorization);
    const path = (req.url ?? '').split('?')[0] ?? '';
    const unauthorized = () =>
      send(res, 401, { error: 'unauthorized' }, { ...cors, 'www-authenticate': 'Bearer' });

    if (path.startsWith(EDITOR_PREFIX)) {
      // The editor surface is for the creator's browser only: it needs its own token AND an allowed origin.
      if (options.editorToken === undefined) return send(res, 404, { error: 'not found' }, cors);
      if (origin === undefined) return send(res, 403, { error: 'origin required' });
      if (provided === undefined || !tokensMatch(provided, options.editorToken))
        return unauthorized();
      return handleEditor(req, res, path, cors);
    }

    if (provided === undefined || !tokensMatch(provided, options.token)) return unauthorized();
    if (path !== MCP_PATH) return send(res, 404, { error: 'not found' }, cors);
    if (req.method !== 'POST')
      return send(res, 405, { error: 'method not allowed' }, { ...cors, allow: 'POST' });

    const body = await readBody(req);
    if (!body.ok) return send(res, 413, { error: 'request too large' }, cors);
    let parsed: unknown;
    try {
      parsed = JSON.parse(body.text);
    } catch {
      return rpcError(res, 400, -32700, 'Parse error');
    }

    // Stateless: one server and transport per request, so no session state can leak across clients.
    const mcp = createBridgeMcpServer(options.core, origin ?? 'mcp-client');
    // No sessionIdGenerator means stateless mode, and JSON responses avoid streaming for simple clients.
    const transport = new StreamableHTTPServerTransport({ enableJsonResponse: true });
    res.on('close', () => {
      void transport.close();
      void mcp.close();
    });
    for (const [name, value] of Object.entries(cors)) res.setHeader(name, value);
    await mcp.connect(transport);
    await transport.handleRequest(req, res, parsed);
  }

  const server: Server = createServer((req, res) => {
    handle(req, res).catch(() => {
      if (!res.headersSent) rpcError(res, 500, -32603, 'Internal error');
      else res.end();
    });
  });

  return {
    start(): Promise<RunningBridge> {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(options.port ?? 0, host, () => {
          boundPort = (server.address() as AddressInfo).port;
          const display = host === '::1' ? '[::1]' : host;
          resolve({
            url: `http://${display}:${boundPort}${MCP_PATH}`,
            port: boundPort,
            close: () =>
              new Promise<void>((done) => {
                server.closeAllConnections();
                server.close(() => done());
              }),
          });
        });
      });
    },
  };
}
