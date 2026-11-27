import { err, ok } from '@ghoststack/shared-contracts';
import type { GhostError, Result } from '@ghoststack/shared-contracts';
import type { BridgeHandlers } from './handlers';
import {
  BRIDGE_PROTOCOL_VERSION,
  CLOSE_CODES,
  MAX_FRAME_BYTES,
  isBridgeMethod,
  parsePairingCode,
} from './protocol';
export type BridgeState = 'connecting' | 'connected' | 'closed' | 'failed';
export interface BridgeStatus {
  state: BridgeState;
  /** Plain sentence for the pairing panel. Never contains the token. */
  detail: string;
}
/** The part of `WebSocket` the client uses. `ws` sockets satisfy it too (tests). */
export interface SocketLike {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev: { code: number }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
}
export interface ConnectBridgeOptions {
  /** Text printed by the MCP server: `gs-mcp:<port>:<token>`. */
  pairingCode: string;
  handlers: BridgeHandlers;
  onStatus?(status: BridgeStatus): void;
  /** Default: `new WebSocket(url)`. */
  createSocket?(url: string): SocketLike;
  /** Time to wait for the server's welcome. */
  welcomeTimeoutMs?: number;
}
export interface BridgeConnection {
  getStatus(): BridgeStatus;
  /** Closes the socket. The agent loses access at once. */
  disconnect(): void;
}
function closeDetail(code: number, wasConnected: boolean): string {
  switch (code) {
    case CLOSE_CODES.unauthorized:
      return 'The pairing code was not accepted. Copy the current code from the server output.';
    case CLOSE_CODES.forbidden:
      return 'The server refused this page. Start it with --allow-origin for this address.';
    case CLOSE_CODES.busy:
      return 'Another tab is already paired with this server. Disconnect it first.';
    case CLOSE_CODES.badFrame:
      return 'The server rejected a message from the editor. Disconnected.';
    default:
      return wasConnected
        ? 'The agent connection closed.'
        : 'Could not reach the MCP server. Check that it is running, the code is current and the server allows this address.';
  }
}
/**
 * Pairs this tab with a running MCP server. The tab is the client: it dials `127.0.0.1` and answers
 * the server's requests through `handlers`. Returns an error value for a malformed code.
 */
export function connectBridge(options: ConnectBridgeOptions): Result<BridgeConnection, GhostError> {
  const parsed = parsePairingCode(options.pairingCode);
  if (!parsed) {
    return err({
      code: 'MCP_CONNECTION_FAILED',
      message: 'The pairing code looks like gs-mcp:<port>:<token>. Copy it from the server output.',
    });
  }
  const url = `ws://127.0.0.1:${parsed.port}/`;
  const create =
    options.createSocket ?? ((u: string): SocketLike => new WebSocket(u) as unknown as SocketLike);
  let status: BridgeStatus = { state: 'connecting', detail: 'Connecting to the MCP server.' };
  let finished = false;
  const set = (next: BridgeStatus): void => {
    status = next;
    options.onStatus?.(next);
  };
  let socket: SocketLike;
  try {
    socket = create(url);
  } catch {
    return err({ code: 'MCP_CONNECTION_FAILED', message: 'The browser could not open the connection.' });
  }
  const welcomeTimer = setTimeout(() => {
    if (status.state === 'connecting') {
      set({ state: 'failed', detail: 'The server did not answer. Check the pairing code.' });
      finish(1000);
    }
  }, options.welcomeTimeoutMs ?? 8000);
  function finish(code?: number): void {
    if (finished) return;
    finished = true;
    clearTimeout(welcomeTimer);
    socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null;
    try {
      socket.close(code ?? 1000, 'done');
    } catch {
      /* already closed */
    }
  }
  const reply = (frame: unknown): void => {
    const text = JSON.stringify(frame);
    if (text.length > MAX_FRAME_BYTES) return;
    if (!finished) socket.send(text);
  };
  socket.onopen = () => {
    socket.send(JSON.stringify({ t: 'hello', token: parsed.token, protocol: BRIDGE_PROTOCOL_VERSION }));
  };
  socket.onmessage = (ev) => {
    if (typeof ev.data !== 'string' || ev.data.length > MAX_FRAME_BYTES) return;
    let frame: unknown;
    try {
      frame = JSON.parse(ev.data);
    } catch {
      return;
    }
    if (typeof frame !== 'object' || frame === null) return;
    const f = frame as Record<string, unknown>;
    if (f['t'] === 'welcome' && f['protocol'] === BRIDGE_PROTOCOL_VERSION) {
      clearTimeout(welcomeTimer);
      set({ state: 'connected', detail: 'An agent can read this Stack and propose changes.' });
      return;
    }
    if (f['t'] === 'bye') {
      set({ state: 'closed', detail: 'The server ended the connection.' });
      finish();
      return;
    }
    if (f['t'] !== 'req' || status.state !== 'connected') return;
    const id = f['id'];
    if (typeof id !== 'number' || !Number.isInteger(id) || id < 0) return;
    if (!isBridgeMethod(f['method'])) {
      reply({
        t: 'res',
        id,
        ok: false,
        error: { code: 'MCP_CONNECTION_FAILED', message: 'Unknown request.' },
      });
      return;
    }
    void options.handlers.handle(f['method'], f['params']).then((r) => {
      if (r.ok) {
        const text = JSON.stringify({ t: 'res', id, ok: true, result: r.value });
        if (text.length > MAX_FRAME_BYTES) {
          reply({
            t: 'res',
            id,
            ok: false,
            error: { code: 'MCP_CONNECTION_FAILED', message: 'The answer is too large to send.' },
          });
        } else if (!finished) socket.send(text);
      } else {
        reply({
          t: 'res',
          id,
          ok: false,
          error: { code: r.error.code, message: r.error.message.slice(0, 2000) },
        });
      }
    });
  };
  socket.onclose = (ev) => {
    const was = status.state === 'connected';
    if (finished) return;
    finished = true;
    clearTimeout(welcomeTimer);
    set({ state: was ? 'closed' : 'failed', detail: closeDetail(ev.code, was) });
  };
  socket.onerror = () => {
    /* `onclose` follows and carries the code. */
  };
  return ok({
    getStatus: () => status,
    disconnect() {
      if (finished) return;
      finish();
      set({ state: 'closed', detail: 'Disconnected. The agent can no longer reach this Stack.' });
    },
  });
}
