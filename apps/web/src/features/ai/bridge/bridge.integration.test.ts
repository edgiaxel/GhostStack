import { afterEach, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import WebSocket from 'ws';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createBridgeHub, createMcpServer } from '@ghoststack/mcp-server';
import type { BridgeHub } from '@ghoststack/mcp-server';
import { connectBridge } from './client';
import type { BridgeConnection, SocketLike } from './client';
import { addCardPlan, clearQueue, openTestSession } from './testing';
import { listProposals } from '../proposals';
/**
 * Whole chain without a browser: MCP client, MCP server, real loopback WebSocket hub, this bridge
 * client, real handlers, real StackSession over fake-indexeddb. `ws` stands in for the browser
 * WebSocket only to be able to send an `Origin` header.
 */
const ORIGIN = 'http://localhost:5173';
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const cleanup: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  while (cleanup.length) await cleanup.pop()?.();
  clearQueue();
});
const socketFor =
  (origin: string) =>
  (url: string): SocketLike =>
    new WebSocket(url, { headers: { Origin: origin } }) as unknown as SocketLike;
async function rig(origin = ORIGIN, hubToken?: string) {
  const hub: BridgeHub = await createBridgeHub(hubToken ? { token: hubToken } : {});
  cleanup.push(() => hub.close());
  const server = createMcpServer({ bridge: hub });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'agent', version: '1.0.0' });
  await Promise.all([server.connect(a), client.connect(b)]);
  cleanup.push(() => client.close());
  const tab = await openTestSession('Live quiz');
  const pair = (code = hub.pairingCode): { conn?: BridgeConnection; error?: string; states: string[] } => {
    const states: string[] = [];
    const r = connectBridge({
      pairingCode: code,
      handlers: tab.handlers,
      createSocket: socketFor(origin),
      onStatus: (s) => states.push(s.state),
    });
    if (!r.ok) return { error: r.error.message, states };
    cleanup.push(() => r.value.disconnect());
    return { conn: r.value, states };
  };
  const waitFor = async (cond: () => boolean): Promise<void> => {
    for (let i = 0; i < 100 && !cond(); i++) await new Promise((r) => setTimeout(r, 20));
    expect(cond()).toBe(true);
  };
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const r = (await client.callTool({ name, arguments: args })) as {
      isError?: boolean;
      content: { text: string }[];
    };
    return {
      isError: r.isError === true,
      json: JSON.parse(r.content[0]?.text ?? '{}') as Json,
    };
  };
  return { hub, client, tab, pair, waitFor, call };
}
describe('agent to editor chain', () => {
  it('reads the live Stack and queues a proposal without changing the Stack', async () => {
    const { hub, tab, pair, waitFor, call } = await rig();
    const { conn } = pair();
    await waitFor(() => conn?.getStatus().state === 'connected' && hub.isPaired());
    tab.session.dispatch({ type: 'ADD_CARD', cardId: 'q2', title: 'Question 2' });
    const summary = await call('get_stack_summary');
    expect(summary.json['title']).toBe('Live quiz');
    expect(summary.json['cards'].map((c: { cardId: string }) => c.cardId)).toEqual(['start', 'q2']);
    expect((await call('get_card_details', { cardId: 'q2' })).json['card']['title']).toBe('Question 2');
    expect((await call('validate_project')).json).toEqual({ valid: true });
    const before = JSON.stringify(tab.session.getStack());
    const undoBefore = tab.session.getStatus().canUndo;
    const proposed = await call('propose_stack_patch', { plan: addCardPlan('result', 'Result') });
    expect(proposed.isError).toBe(false);
    expect(proposed.json['status']).toBe('pending_user_approval');
    expect(listProposals()).toHaveLength(1);
    expect(listProposals()[0]?.plan.steps[0]?.command).toMatchObject({ type: 'ADD_CARD', cardId: 'result' });
    expect(JSON.stringify(tab.session.getStack())).toBe(before);
    expect(tab.session.getStatus().canUndo).toBe(undoBefore);
    expect(tab.session.getStack().cards['result']).toBeUndefined();
  });
  it('refuses a plan that does not apply to the live Stack', async () => {
    const { hub, pair, waitFor, call } = await rig();
    const { conn } = pair();
    await waitFor(() => conn?.getStatus().state === 'connected' && hub.isPaired());
    const r = await call('propose_stack_patch', { plan: addCardPlan('start', 'Clash') });
    expect(r.isError).toBe(true);
    expect(listProposals()).toHaveLength(0);
  });
  it('stores an agent checkpoint through the real repository', async () => {
    const { hub, tab, pair, waitFor, call } = await rig();
    const { conn } = pair();
    await waitFor(() => conn?.getStatus().state === 'connected' && hub.isPaired());
    const r = await call('create_checkpoint', { label: 'before refactor' });
    expect(r.isError).toBe(false);
    expect(await tab.checkpoints.list(tab.session.stackId)).toMatchObject([
      { label: 'Agent: before refactor' },
    ]);
  });
  it('stops answering once the tab disconnects', async () => {
    const { hub, pair, waitFor, call } = await rig();
    const { conn } = pair();
    await waitFor(() => conn?.getStatus().state === 'connected' && hub.isPaired());
    conn?.disconnect();
    await waitFor(() => !hub.isPaired());
    const r = await call('get_stack_summary');
    expect(r.isError).toBe(true);
    expect(r.json['error'].code).toBe('MCP_CONNECTION_FAILED');
  });
});
describe('rejections end to end', () => {
  it('a wrong token never pairs', async () => {
    const { hub, pair, waitFor } = await rig();
    const forged = `gs-mcp:${hub.port}:${'A'.repeat(22)}`;
    const { conn, states } = pair(forged);
    await waitFor(() => conn?.getStatus().state === 'failed');
    expect(hub.isPaired()).toBe(false);
    expect(conn?.getStatus().detail).toMatch(/not accepted/);
    expect(states).not.toContain('connected');
  });
  it('a foreign Origin never pairs', async () => {
    const { hub, pair, waitFor, call } = await rig('https://evil.example');
    const { conn } = pair();
    await waitFor(() => conn?.getStatus().state === 'failed');
    expect(hub.isPaired()).toBe(false);
    expect((await call('get_stack_summary')).isError).toBe(true);
  });
  it('a second tab is turned away while the first stays paired', async () => {
    const { hub, pair, waitFor } = await rig();
    const first = pair();
    await waitFor(() => first.conn?.getStatus().state === 'connected');
    const second = pair();
    await waitFor(() => second.conn?.getStatus().state === 'failed');
    expect(second.conn?.getStatus().detail).toMatch(/Another tab/);
    expect(first.conn?.getStatus().state).toBe('connected');
    expect(hub.isPaired()).toBe(true);
  });
});
describe('property: no tool call changes the Stack without an approval event', () => {
  it('keeps the Stack identical across arbitrary agent call sequences', async () => {
    const { hub, tab, pair, waitFor, client } = await rig();
    const { conn } = pair();
    await waitFor(() => conn?.getStatus().state === 'connected' && hub.isPaired());
    const before = JSON.stringify(tab.session.getStack());
    const calls = fc.oneof(
      fc.constant({ name: 'get_stack_summary', arguments: {} }),
      fc.record({
        name: fc.constant('get_card_details'),
        arguments: fc.record({ cardId: fc.constantFrom('start', 'nope') }),
      }),
      fc.constant({ name: 'validate_project', arguments: {} }),
      fc.constant({ name: 'list_registered_actions', arguments: {} }),
      fc.record({
        name: fc.constant('propose_stack_patch'),
        arguments: fc.record({
          plan: fc.constantFrom(addCardPlan('a1', 'A1'), addCardPlan('start', 'Clash'), {} as never),
        }),
      }),
      fc.record({
        name: fc.constant('create_checkpoint'),
        arguments: fc.record({ label: fc.string({ minLength: 1, maxLength: 20 }) }),
      }),
    );
    await fc.assert(
      fc.asyncProperty(fc.array(calls, { minLength: 1, maxLength: 6 }), async (seq) => {
        for (const c of seq) await client.callTool(c as { name: string; arguments: Record<string, unknown> });
        expect(JSON.stringify(tab.session.getStack())).toBe(before);
        expect(tab.session.getStatus()).toMatchObject({ canUndo: false, canRedo: false });
        clearQueue();
      }),
      { numRuns: 15 },
    );
  }, 60_000);
});
