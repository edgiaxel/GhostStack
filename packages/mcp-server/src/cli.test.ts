import { execFile } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { parsePairingCode } from './protocol';
import { LOCAL_ORIGIN, answerWith, openTab } from './test-support';
/**
 * Conformance run: the built stdio entry is started as a child process and driven by the MCP SDK
 * client over stdio, the same way an agent launches it. The "tab" is a real WebSocket client.
 */
const here = dirname(fileURLToPath(import.meta.url));
const pkg = resolve(here, '..');
const entry = resolve(pkg, 'dist/cli.mjs');
let client: Client;
let transport: StdioClientTransport;
let stderrText = '';
beforeAll(async () => {
  await promisify(execFile)('node', [resolve(pkg, 'build.mjs')], { cwd: pkg });
  transport = new StdioClientTransport({ command: 'node', args: [entry], stderr: 'pipe' });
  client = new Client({ name: 'conformance', version: '1.0.0' });
  await client.connect(transport);
  transport.stderr?.on('data', (d: Buffer) => (stderrText += d.toString()));
}, 60_000);
afterAll(async () => {
  await client?.close();
});
async function pairingFromStderr(): Promise<{ port: number; token: string }> {
  for (let i = 0; i < 100; i++) {
    const m = /Pairing code: (\S+)/.exec(stderrText);
    const parsed = m ? parsePairingCode(m[1] as string) : undefined;
    if (parsed) return parsed;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('server printed no pairing code');
}
describe('stdio server', () => {
  it('initializes and lists the six tools', async () => {
    const { tools } = await client.listTools();
    expect(tools).toHaveLength(6);
    expect(client.getServerVersion()?.name).toBe('ghoststack');
  });
  it('answers list_registered_actions without a tab and fails reads with MCP_CONNECTION_FAILED', async () => {
    const actions = await client.callTool({ name: 'list_registered_actions', arguments: {} });
    expect((actions as { isError?: boolean }).isError).toBeFalsy();
    const r = (await client.callTool({ name: 'get_stack_summary', arguments: {} })) as {
      isError?: boolean;
      content: { text: string }[];
    };
    expect(r.isError).toBe(true);
    expect(JSON.parse(r.content[0]?.text ?? '{}').error.code).toBe('MCP_CONNECTION_FAILED');
  });
  it('prints the pairing code on stderr and keeps stdout for the protocol', async () => {
    const { port, token } = await pairingFromStderr();
    expect(port).toBeGreaterThan(1023);
    expect(stderrText).toContain('127.0.0.1');
    expect(token.length).toBeGreaterThanOrEqual(22);
  });
  it('reads from a paired tab and a wrong token or origin is turned away', async () => {
    const { port, token } = await pairingFromStderr();
    const wrong = await openTab({ port });
    wrong.socket.send(JSON.stringify({ t: 'hello', token: 'wrong'.repeat(5), protocol: 1 }));
    expect((await wrong.closed).code).toBe(4401);
    const foreign = await openTab({ port }, { origin: 'https://evil.example' });
    expect((await foreign.closed).code).toBe(403);
    const tab = await openTab({ port }, { origin: LOCAL_ORIGIN });
    tab.socket.send(JSON.stringify({ t: 'hello', token, protocol: 1 }));
    await tab.waitFrame((f) => f['t'] === 'welcome');
    const seen = answerWith(tab, (method) =>
      method === 'proposal.submit'
        ? { ok: true, result: { proposalId: 'p-1', stepCount: 1, waitingForApproval: 1 } }
        : { ok: true, result: { title: 'Live Stack' } },
    );
    const summary = (await client.callTool({ name: 'get_stack_summary', arguments: {} })) as {
      content: { text: string }[];
    };
    expect(JSON.parse(summary.content[0]?.text ?? '{}')).toEqual({ title: 'Live Stack' });
    const proposal = (await client.callTool({
      name: 'propose_stack_patch',
      arguments: {
        plan: {
          schemaVersion: 1,
          summary: 'Add a card',
          affectedCardIds: ['n1'],
          steps: [
            { id: 's1', rationale: 'Needed.', command: { type: 'ADD_CARD', cardId: 'n1', title: 'New' } },
          ],
        },
      },
    })) as { content: { text: string }[] };
    expect(proposal.content[0]?.text).toContain('pending user approval');
    expect(seen).toEqual(['stack.summary', 'proposal.submit']);
    tab.socket.close();
  });
});
