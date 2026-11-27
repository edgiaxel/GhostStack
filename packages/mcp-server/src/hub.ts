import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { WebSocketServer } from 'ws';
import type { RawData, WebSocket } from 'ws';
import { err, ok } from '@ghoststack/shared-contracts';
import type { GhostError, Result } from '@ghoststack/shared-contracts';
import {
  BRIDGE_PROTOCOL_VERSION,
  CLOSE,
  ClientFrameSchema,
  MAX_FRAME_BYTES,
  MAX_HELLO_BYTES,
  formatPairingCode,
} from './protocol';
import type { BridgeMethod, ServerFrame } from './protocol';
/** What the tools need from the transport. Tests provide their own implementation. */
export interface Bridge {
  isPaired(): boolean;
  request(method: BridgeMethod, params: unknown): Promise<Result<unknown, GhostError>>;
}
export interface BridgeHubOptions {
  /** Extra exact origins to accept, for example `https://editor.example`. Loopback origins are always accepted. */
  allowedOrigins?: readonly string[];
  /** Fixed token for tests. Default: 128 random bits, new on every launch. */
  token?: string;
  /** 0 picks a free port. */
  port?: number;
  maxFrameBytes?: number;
  helloTimeoutMs?: number;
  requestTimeoutMs?: number;
}
export interface BridgeHub extends Bridge {
  readonly host: '127.0.0.1';
  readonly port: number;
  readonly token: string;
  readonly pairingCode: string;
  onPairingChange(listener: (paired: boolean) => void): () => void;
  close(): Promise<void>;
}
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);
const notPaired: GhostError = {
  code: 'MCP_CONNECTION_FAILED',
  message:
    'No editor tab is paired. Open the Stack in GhostStack, open the AI assistant and enter the pairing code printed by this server.',
};
const sha = (text: string): Buffer => createHash('sha256').update(text).digest();
export function tokensMatch(given: string, expected: string): boolean {
  return timingSafeEqual(sha(given), sha(expected));
}
/** `Host` must name this listener on loopback. Blocks DNS rebinding. */
export function hostAllowed(host: string | undefined, port: number): boolean {
  if (!host) return false;
  const m = /^(\[::1\]|[^:]+):(\d+)$/.exec(host);
  if (!m) return false;
  return LOOPBACK_HOSTS.has(m[1] as string) && Number(m[2]) === port;
}
export function originAllowed(origin: string | undefined, extra: readonly string[]): boolean {
  if (!origin) return false;
  if (extra.includes(origin)) return true;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.origin !== origin) return false;
  return (url.protocol === 'http:' || url.protocol === 'https:') && LOOPBACK_HOSTS.has(url.hostname);
}
interface Pending {
  resolve(r: Result<unknown, GhostError>): void;
  timer: ReturnType<typeof setTimeout>;
}
export async function createBridgeHub(options: BridgeHubOptions = {}): Promise<BridgeHub> {
  const token = options.token ?? randomBytes(16).toString('base64url');
  const maxFrame = options.maxFrameBytes ?? MAX_FRAME_BYTES;
  const helloTimeout = options.helloTimeoutMs ?? 5000;
  const requestTimeout = options.requestTimeoutMs ?? 15_000;
  const extraOrigins = options.allowedOrigins ?? [];
  const listeners = new Set<(paired: boolean) => void>();
  const pending = new Map<number, Pending>();
  let tab: WebSocket | undefined;
  let nextId = 1;
  let boundPort = 0;
  const wss = new WebSocketServer({
    host: '127.0.0.1',
    port: options.port ?? 0,
    maxPayload: maxFrame,
    verifyClient: (info, done) => {
      if (!hostAllowed(info.req.headers.host, boundPort)) return done(false, 403, 'Host not allowed');
      if (!originAllowed(info.origin || undefined, extraOrigins))
        return done(false, 403, 'Origin not allowed');
      done(true);
    },
  });
  await new Promise<void>((resolve, reject) => {
    wss.once('listening', resolve);
    wss.once('error', reject);
  });
  boundPort = (wss.address() as AddressInfo).port;
  const emit = (): void => listeners.forEach((l) => l(tab !== undefined));
  const send = (socket: WebSocket, frame: ServerFrame): void => {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(frame));
  };
  const failAll = (error: GhostError): void => {
    for (const [id, p] of pending) {
      clearTimeout(p.timer);
      p.resolve(err(error));
      pending.delete(id);
    }
  };
  const bytes = (data: RawData): number =>
    Array.isArray(data)
      ? data.reduce((n, b) => n + b.length, 0)
      : data instanceof ArrayBuffer
        ? data.byteLength
        : data.length;
  wss.on('connection', (socket: WebSocket) => {
    let authed = false;
    const timer = setTimeout(() => {
      if (!authed) socket.close(CLOSE.unauthorized, 'hello timeout');
    }, helloTimeout);
    socket.on('close', () => {
      clearTimeout(timer);
      if (tab === socket) {
        tab = undefined;
        failAll({ code: 'MCP_CONNECTION_FAILED', message: 'The editor tab disconnected.' });
        emit();
      }
    });
    socket.on('error', () => socket.terminate());
    const onMessage = (data: RawData, isBinary: boolean): void => {
      if (isBinary) return void socket.close(CLOSE.badFrame, 'text frames only');
      if (!authed && bytes(data) > MAX_HELLO_BYTES)
        return void socket.close(CLOSE.unauthorized, 'hello too large');
      let json: unknown;
      try {
        json = JSON.parse(data.toString());
      } catch {
        return void socket.close(CLOSE.badFrame, 'invalid frame');
      }
      const frame = ClientFrameSchema.safeParse(json);
      if (!frame.success) return void socket.close(CLOSE.badFrame, 'invalid frame');
      const f = frame.data;
      if (!authed) {
        if (f.t !== 'hello' || !tokensMatch(f.token, token))
          return void socket.close(CLOSE.unauthorized, 'bad token');
        if (tab && tab.readyState === tab.OPEN) return void socket.close(CLOSE.busy, 'another tab is paired');
        authed = true;
        clearTimeout(timer);
        tab = socket;
        send(socket, { t: 'welcome', protocol: BRIDGE_PROTOCOL_VERSION });
        emit();
        return;
      }
      if (f.t !== 'res') return void socket.close(CLOSE.badFrame, 'unexpected frame');
      const p = pending.get(f.id);
      if (!p) return;
      pending.delete(f.id);
      clearTimeout(p.timer);
      p.resolve(f.ok ? ok(f.result) : err(f.error));
    };
    socket.on('message', (data, isBinary) => {
      try {
        onMessage(data, isBinary);
      } catch {
        socket.terminate();
      }
    });
  });
  const hub: BridgeHub = {
    host: '127.0.0.1',
    port: boundPort,
    token,
    pairingCode: formatPairingCode(boundPort, token),
    isPaired: () => tab !== undefined && tab.readyState === tab.OPEN,
    request(method, params) {
      const socket = tab;
      if (!socket || socket.readyState !== socket.OPEN) return Promise.resolve(err(notPaired));
      const id = nextId++;
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          resolve(
            err({
              code: 'MCP_CONNECTION_FAILED',
              message: 'The editor tab did not answer in time. Check that the tab is open and not paused.',
            }),
          );
        }, requestTimeout);
        pending.set(id, { resolve, timer });
        send(socket, { t: 'req', id, method, params });
      });
    },
    onPairingChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async close() {
      failAll({ code: 'MCP_CONNECTION_FAILED', message: 'The bridge is shutting down.' });
      for (const c of wss.clients) c.close(1001, 'shutdown');
      await new Promise<void>((resolve) => wss.close(() => resolve()));
    },
  };
  return hub;
}
