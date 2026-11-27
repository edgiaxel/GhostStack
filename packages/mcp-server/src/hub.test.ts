import { afterEach, describe, expect, it } from 'vitest';
import { createBridgeHub, hostAllowed, originAllowed, tokensMatch } from './hub';
import type { BridgeHub } from './hub';
import { MAX_FRAME_BYTES, parsePairingCode } from './protocol';
import { answerWith, openTab, pairTab } from './test-support';
let hub: BridgeHub | undefined;
const make = async (options: Parameters<typeof createBridgeHub>[0] = {}): Promise<BridgeHub> => {
  hub = await createBridgeHub(options);
  return hub;
};
afterEach(async () => {
  await hub?.close();
  hub = undefined;
});
describe('listener', () => {
  it('binds loopback on a random port with a fresh token each launch', async () => {
    const a = await createBridgeHub();
    const b = await createBridgeHub();
    try {
      expect(a.host).toBe('127.0.0.1');
      expect(a.port).toBeGreaterThan(1023);
      expect(a.port).not.toBe(b.port);
      expect(a.token).not.toBe(b.token);
      expect(a.token).toMatch(/^[A-Za-z0-9_-]{22}$/);
      expect(parsePairingCode(a.pairingCode)).toEqual({ port: a.port, token: a.token });
    } finally {
      await a.close();
      await b.close();
    }
  });
});
describe('authentication', () => {
  it('accepts the right token and pairs one tab', async () => {
    const h = await make();
    const events: boolean[] = [];
    h.onPairingChange((p) => events.push(p));
    const tab = await pairTab(h);
    expect(h.isPaired()).toBe(true);
    tab.socket.close();
    await tab.closed;
    await new Promise((r) => setTimeout(r, 20));
    expect(h.isPaired()).toBe(false);
    expect(events).toEqual([true, false]);
  });
  it('rejects a wrong token with 4401 and never pairs', async () => {
    const h = await make();
    const tab = await openTab(h);
    tab.socket.send(JSON.stringify({ t: 'hello', token: 'x'.repeat(22), protocol: 1 }));
    expect((await tab.closed).code).toBe(4401);
    expect(h.isPaired()).toBe(false);
  });
  it('rejects a request frame before hello', async () => {
    const h = await make();
    const tab = await openTab(h);
    tab.socket.send(JSON.stringify({ t: 'res', id: 1, ok: true, result: {} }));
    expect((await tab.closed).code).toBe(4401);
    expect(h.isPaired()).toBe(false);
  });
  it('closes a socket that never says hello', async () => {
    await make({ helloTimeoutMs: 50 });
    const tab = await openTab(hub!);
    expect((await tab.closed).code).toBe(4401);
  });
  it('compares tokens without leaking length', () => {
    expect(tokensMatch('abc', 'abc')).toBe(true);
    expect(tokensMatch('abc', 'abd')).toBe(false);
    expect(tokensMatch('', 'abc')).toBe(false);
  });
});
describe('origin and host', () => {
  it.each([
    ['https://evil.example', 403],
    ['http://localhost.evil.example', 403],
    ['null', 403],
  ])('rejects Origin %s at the upgrade', async (origin, status) => {
    const h = await make();
    const tab = await openTab(h, { origin });
    expect((await tab.closed).code).toBe(status);
    expect(h.isPaired()).toBe(false);
  });
  it('rejects a missing Origin', async () => {
    const h = await make();
    const tab = await openTab(h, { origin: null });
    expect((await tab.closed).code).toBe(403);
  });
  it('rejects a Host that is not this loopback listener (DNS rebinding)', async () => {
    const h = await make();
    const tab = await openTab(h, { host: 'rebind.example:80' });
    expect((await tab.closed).code).toBe(403);
  });
  it('accepts an extra origin only when configured', async () => {
    const h = await make({ allowedOrigins: ['https://editor.example'] });
    const tab = await pairTab(h, 'https://editor.example');
    expect(h.isPaired()).toBe(true);
    tab.socket.close();
  });
  it('checks origin and host as pure rules', () => {
    expect(originAllowed('http://127.0.0.1:5173', [])).toBe(true);
    expect(originAllowed('http://[::1]:5173', [])).toBe(true);
    expect(originAllowed('http://localhost', [])).toBe(true);
    expect(originAllowed('http://localhost:5173/', [])).toBe(false);
    expect(originAllowed('ftp://localhost', [])).toBe(false);
    expect(originAllowed(undefined, [])).toBe(false);
    expect(hostAllowed('127.0.0.1:4000', 4000)).toBe(true);
    expect(hostAllowed('localhost:4000', 4000)).toBe(true);
    expect(hostAllowed('127.0.0.1:4001', 4000)).toBe(false);
    expect(hostAllowed('evil.example:4000', 4000)).toBe(false);
    expect(hostAllowed(undefined, 4000)).toBe(false);
  });
});
describe('payload limit', () => {
  it('closes with 1009 when an authenticated tab sends more than the limit', async () => {
    const h = await make();
    const tab = await pairTab(h);
    tab.socket.send('x'.repeat(MAX_FRAME_BYTES + 1));
    // Windows can reset the socket before the 1009 close frame arrives, which the client reports as 1006.
    expect([1009, 1006]).toContain((await tab.closed).code);
    expect(h.isPaired()).toBe(false);
  });
  it('closes an unauthenticated tab that sends a large hello', async () => {
    const h = await make();
    const tab = await openTab(h);
    tab.socket.send(JSON.stringify({ t: 'hello', token: 'x'.repeat(2000), protocol: 1 }));
    expect((await tab.closed).code).toBe(4401);
  });
  it('closes on invalid JSON, unknown frames and binary frames', async () => {
    const h = await make();
    for (const payload of ['not json', JSON.stringify({ t: 'surprise' }), Buffer.from([1, 2, 3])]) {
      const tab = await openTab(h);
      tab.socket.send(payload);
      expect((await tab.closed).code).toBe(4400);
    }
  });
});
describe('one paired tab', () => {
  it('turns away a second tab and keeps the first', async () => {
    const h = await make();
    const first = await pairTab(h);
    const second = await openTab(h);
    second.socket.send(JSON.stringify({ t: 'hello', token: h.token, protocol: 1 }));
    expect((await second.closed).code).toBe(4409);
    expect(h.isPaired()).toBe(true);
    first.socket.close();
  });
  it('allows pairing again after Disconnect', async () => {
    const h = await make();
    const first = await pairTab(h);
    first.socket.close();
    await first.closed;
    await new Promise((r) => setTimeout(r, 20));
    const again = await pairTab(h);
    expect(h.isPaired()).toBe(true);
    again.socket.close();
  });
});
describe('requests', () => {
  it('answers from the tab', async () => {
    const h = await make();
    const tab = await pairTab(h);
    const seen = answerWith(tab, (m) => ({ ok: true, result: { echoed: m } }));
    const r = await h.request('stack.summary', {});
    expect(r).toEqual({ ok: true, value: { echoed: 'stack.summary' } });
    expect(seen).toEqual(['stack.summary']);
    tab.socket.close();
  });
  it('passes tab errors through with their code', async () => {
    const h = await make();
    const tab = await pairTab(h);
    answerWith(tab, () => ({ ok: false, error: { code: 'INVALID_AI_PLAN', message: 'nope' } }));
    expect(await h.request('proposal.submit', {})).toEqual({
      ok: false,
      error: { code: 'INVALID_AI_PLAN', message: 'nope' },
    });
    tab.socket.close();
  });
  it('reports MCP_CONNECTION_FAILED with no tab', async () => {
    const h = await make();
    const r = await h.request('stack.summary', {});
    expect(r).toMatchObject({ ok: false, error: { code: 'MCP_CONNECTION_FAILED' } });
  });
  it('times out when the tab stays silent and fails pending calls on disconnect', async () => {
    const h = await make({ requestTimeoutMs: 60 });
    const tab = await pairTab(h);
    const slow = await h.request('stack.summary', {});
    expect(slow).toMatchObject({ ok: false, error: { code: 'MCP_CONNECTION_FAILED' } });
    const waiting = h.request('stack.summary', {});
    tab.socket.close();
    expect(await waiting).toMatchObject({
      ok: false,
      error: { message: expect.stringContaining('disconnected') },
    });
  });
  it('ignores a response with an unknown id', async () => {
    const h = await make();
    const tab = await pairTab(h);
    tab.socket.send(JSON.stringify({ t: 'res', id: 999, ok: true, result: {} }));
    await new Promise((r) => setTimeout(r, 30));
    expect(h.isPaired()).toBe(true);
    tab.socket.close();
  });
});
