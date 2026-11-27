import WebSocket from 'ws';
import { formatPairingCode } from './protocol';
import type { BridgeHub } from './hub';
/** Test helpers only. Never imported by product code. */
export const LOCAL_ORIGIN = 'http://localhost:5173';
export interface TestTab {
  socket: WebSocket;
  frames: unknown[];
  closed: Promise<{ code: number }>;
  waitFrame(match: (f: Record<string, unknown>) => boolean): Promise<Record<string, unknown>>;
}
export async function openTab(
  hub: Pick<BridgeHub, 'port'>,
  options: { origin?: string | null; host?: string } = {},
): Promise<TestTab> {
  const headers: Record<string, string> = {};
  if (options.origin !== null) headers['Origin'] = options.origin ?? LOCAL_ORIGIN;
  if (options.host) headers['Host'] = options.host;
  const socket = new WebSocket(`ws://127.0.0.1:${hub.port}/`, { headers });
  const frames: unknown[] = [];
  const waiters: {
    match: (f: Record<string, unknown>) => boolean;
    resolve: (f: Record<string, unknown>) => void;
  }[] = [];
  socket.on('message', (d) => {
    const f = JSON.parse(d.toString()) as Record<string, unknown>;
    frames.push(f);
    for (const w of [...waiters]) {
      if (w.match(f)) {
        waiters.splice(waiters.indexOf(w), 1);
        w.resolve(f);
      }
    }
  });
  const closed = new Promise<{ code: number }>((resolve) => {
    socket.on('close', (code) => resolve({ code }));
    socket.on('unexpected-response', (_req, res) => {
      resolve({ code: res.statusCode ?? 0 });
      res.resume();
    });
    socket.on('error', () => undefined);
  });
  await new Promise<void>((resolve) => {
    socket.once('open', () => resolve());
    socket.once('close', () => resolve());
    socket.once('unexpected-response', () => resolve());
  });
  return {
    socket,
    frames,
    closed,
    waitFrame(match) {
      const seen = frames.find((f) => match(f as Record<string, unknown>));
      if (seen) return Promise.resolve(seen as Record<string, unknown>);
      return new Promise((resolve) => waiters.push({ match, resolve }));
    },
  };
}
export async function pairTab(hub: BridgeHub, origin?: string): Promise<TestTab> {
  const tab = await openTab(hub, origin ? { origin } : {});
  tab.socket.send(JSON.stringify({ t: 'hello', token: hub.token, protocol: 1 }));
  await tab.waitFrame((f) => f['t'] === 'welcome');
  return tab;
}
/** Answers every request with `answer(method, params)`; returns the list of methods seen. */
export function answerWith(
  tab: TestTab,
  answer: (
    method: string,
    params: unknown,
  ) => { ok: true; result: unknown } | { ok: false; error: { code: string; message: string } },
): string[] {
  const seen: string[] = [];
  tab.socket.on('message', (d) => {
    const f = JSON.parse(d.toString()) as { t: string; id: number; method: string; params: unknown };
    if (f.t !== 'req') return;
    seen.push(f.method);
    tab.socket.send(JSON.stringify({ t: 'res', id: f.id, ...answer(f.method, f.params) }));
  });
  return seen;
}
export { formatPairingCode };
