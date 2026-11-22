import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { BridgeCore } from './core';
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

export interface BridgeHttpOptions {
  readonly core: BridgeCore;
  /** Shared secret. Read from the environment by the caller. It is never logged or echoed. */
  readonly token: string;
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

export function createBridgeHttpServer(options: BridgeHttpOptions) {
  const problem = checkTokenStrength(options.token);
  if (problem !== undefined) {
    throw new Error(
      `The bridge token is ${problem}. Provide at least 32 characters, for example from "openssl rand -hex 32".`,
    );
  }
  const allowedOrigins = options.allowedOrigins ?? [];
  const host = options.host ?? '127.0.0.1';
  let boundPort = 0;

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
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'authorization, content-type, mcp-protocol-version',
        'access-control-max-age': '600',
      });
      return void res.end();
    }

    const provided = bearerToken(req.headers.authorization);
    if (provided === undefined || !tokensMatch(provided, options.token)) {
      return send(res, 401, { error: 'unauthorized' }, { ...cors, 'www-authenticate': 'Bearer' });
    }

    const path = (req.url ?? '').split('?')[0];
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
