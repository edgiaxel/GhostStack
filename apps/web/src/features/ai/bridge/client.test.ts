import { afterEach, describe, expect, it, vi } from 'vitest';
import { ok } from '@ghoststack/shared-contracts';
import { connectBridge } from './client';
import type { BridgeStatus, SocketLike } from './client';
import type { BridgeHandlers } from './handlers';
import { MAX_FRAME_BYTES } from './protocol';
const CODE = 'gs-mcp:41234:abcdefghijklmnopqrstuv';
/** Scripted stand-in for the browser WebSocket: the real transport runs in integration and e2e tests. */
class FakeSocket implements SocketLike {
  sent: string[] = [];
  closedWith: number | undefined;
  onopen: SocketLike['onopen'] = null;
  onmessage: SocketLike['onmessage'] = null;
  onclose: SocketLike['onclose'] = null;
  onerror: SocketLike['onerror'] = null;
  constructor(readonly url: string) {}
  send(data: string): void {
    this.sent.push(data);
  }
  close(code?: number): void {
    this.closedWith = code;
  }
  serverSays(frame: unknown): void {
    this.onmessage?.({ data: typeof frame === 'string' ? frame : JSON.stringify(frame) });
  }
}
function setup(handlers?: Partial<BridgeHandlers>) {
  let socket!: FakeSocket;
  const statuses: BridgeStatus[] = [];
  const handle = vi.fn(handlers?.handle ?? (() => Promise.resolve(ok({ fine: true }))));
  const r = connectBridge({
    pairingCode: CODE,
    handlers: { handle },
    onStatus: (s) => statuses.push(s),
    createSocket: (url) => (socket = new FakeSocket(url)),
    welcomeTimeoutMs: 50,
  });
  if (!r.ok) throw new Error(r.error.message);
  return { conn: r.value, socket, statuses, handle };
}
const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
afterEach(() => vi.useRealTimers());
describe('connectBridge', () => {
  it('rejects a malformed pairing code without opening a socket', () => {
    let opened = false;
    for (const code of [
      '',
      'gs-mcp:80:abc',
      'gs-mcp:41234:short',
      'ws://127.0.0.1:1/x',
      'gs-mcp:99999:abcdefghijklmnopqrstuv',
    ]) {
      const r = connectBridge({
        pairingCode: code,
        handlers: { handle: () => Promise.resolve(ok(null)) },
        createSocket: () => {
          opened = true;
          return new FakeSocket('x');
        },
      });
      expect(r).toMatchObject({ ok: false, error: { code: 'MCP_CONNECTION_FAILED' } });
    }
    expect(opened).toBe(false);
  });
  it('dials loopback only, sends hello with the token, then connects on welcome', () => {
    const { socket, statuses, conn } = setup();
    expect(socket.url).toBe('ws://127.0.0.1:41234/');
    socket.onopen?.({});
    expect(JSON.parse(socket.sent[0] as string)).toEqual({
      t: 'hello',
      token: 'abcdefghijklmnopqrstuv',
      protocol: 1,
    });
    expect(conn.getStatus().state).toBe('connecting');
    socket.serverSays({ t: 'welcome', protocol: 1 });
    expect(conn.getStatus().state).toBe('connected');
    expect(statuses.at(-1)?.detail).not.toContain('abcdefghijklmnopqrstuv');
  });
  it('answers a request through the handlers and ignores requests before welcome', async () => {
    const { socket, handle } = setup();
    socket.onopen?.({});
    socket.serverSays({ t: 'req', id: 1, method: 'stack.summary', params: {} });
    await settle();
    expect(handle).not.toHaveBeenCalled();
    socket.serverSays({ t: 'welcome', protocol: 1 });
    socket.serverSays({ t: 'req', id: 2, method: 'stack.summary', params: {} });
    await settle();
    expect(handle).toHaveBeenCalledWith('stack.summary', {});
    expect(JSON.parse(socket.sent.at(-1) as string)).toEqual({
      t: 'res',
      id: 2,
      ok: true,
      result: { fine: true },
    });
  });
  it('relays a handler error with its code', async () => {
    const { socket } = setup({
      handle: () => Promise.resolve({ ok: false, error: { code: 'INVALID_AI_PLAN', message: 'bad plan' } }),
    });
    socket.serverSays({ t: 'welcome', protocol: 1 });
    socket.serverSays({ t: 'req', id: 3, method: 'proposal.submit', params: {} });
    await settle();
    expect(JSON.parse(socket.sent.at(-1) as string)).toEqual({
      t: 'res',
      id: 3,
      ok: false,
      error: { code: 'INVALID_AI_PLAN', message: 'bad plan' },
    });
  });
  it('never runs a method outside the allowlist', async () => {
    const { socket, handle } = setup();
    socket.serverSays({ t: 'welcome', protocol: 1 });
    socket.serverSays({ t: 'req', id: 4, method: 'session.restore', params: {} });
    socket.serverSays({ t: 'req', id: 5, method: 'dispatch', params: { type: 'DELETE_CARD' } });
    await settle();
    expect(handle).not.toHaveBeenCalled();
    expect(JSON.parse(socket.sent.at(-1) as string)).toMatchObject({ t: 'res', id: 5, ok: false });
  });
  it('ignores binary, oversized, non-JSON and malformed frames', async () => {
    const { socket, handle } = setup();
    socket.serverSays({ t: 'welcome', protocol: 1 });
    socket.onmessage?.({ data: new ArrayBuffer(4) });
    socket.serverSays('x'.repeat(MAX_FRAME_BYTES + 1));
    socket.serverSays('not json');
    socket.serverSays('null');
    socket.serverSays({ t: 'req', id: -1, method: 'stack.summary' });
    socket.serverSays({ t: 'req', id: 'a', method: 'stack.summary' });
    await settle();
    expect(handle).not.toHaveBeenCalled();
    expect(socket.sent).toHaveLength(0);
  });
  it('replaces an answer that is too large with an error', async () => {
    const { socket } = setup({ handle: () => Promise.resolve(ok('x'.repeat(MAX_FRAME_BYTES))) });
    socket.serverSays({ t: 'welcome', protocol: 1 });
    socket.serverSays({ t: 'req', id: 6, method: 'stack.summary', params: {} });
    await settle();
    expect(JSON.parse(socket.sent.at(-1) as string)).toMatchObject({ t: 'res', id: 6, ok: false });
  });
  it.each([
    [4401, /not accepted/],
    [4403, /--allow-origin/],
    [4409, /Another tab/],
    [1006, /Could not reach/],
  ])('explains close code %i before pairing', (code, text) => {
    const { socket, conn } = setup();
    socket.onclose?.({ code });
    expect(conn.getStatus().state).toBe('failed');
    expect(conn.getStatus().detail).toMatch(text);
  });
  it('reports a closed connection after pairing', () => {
    const { socket, conn } = setup();
    socket.serverSays({ t: 'welcome', protocol: 1 });
    socket.onclose?.({ code: 1006 });
    expect(conn.getStatus()).toMatchObject({ state: 'closed', detail: 'The agent connection closed.' });
  });
  it('disconnect closes the socket and the agent gets no more answers', async () => {
    const { socket, conn, handle } = setup();
    socket.serverSays({ t: 'welcome', protocol: 1 });
    conn.disconnect();
    expect(socket.closedWith).toBe(1000);
    expect(conn.getStatus().state).toBe('closed');
    socket.serverSays({ t: 'req', id: 7, method: 'stack.summary', params: {} });
    await settle();
    expect(handle).not.toHaveBeenCalled();
    conn.disconnect();
  });
  it('fails when the server never welcomes', async () => {
    const { conn, socket } = setup();
    await new Promise((r) => setTimeout(r, 80));
    expect(conn.getStatus().state).toBe('failed');
    expect(socket.closedWith).toBeDefined();
  });
  it('turns a thrown socket constructor into an error value', () => {
    const r = connectBridge({
      pairingCode: CODE,
      handlers: { handle: () => Promise.resolve(ok(null)) },
      createSocket: () => {
        throw new Error('blocked');
      },
    });
    expect(r).toMatchObject({ ok: false, error: { code: 'MCP_CONNECTION_FAILED' } });
  });
});
