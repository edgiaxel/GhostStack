import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import WebSocket from 'ws';
/**
 * M3.5: a real MCP client (SDK, stdio) launches the built server, pairs with an open editor tab, reads the
 * live Stack and submits a proposal that waits for approval. Needs `BridgePairing` mounted in the AI panel.
 */
const pkg = resolve(process.cwd(), 'packages/mcp-server');
let client: Client | undefined;
let stderrText = '';
test.beforeAll(async () => {
  await promisify(execFile)('node', [resolve(pkg, 'build.mjs')], { cwd: pkg });
});
test.afterEach(async () => {
  await client?.close();
  client = undefined;
});
async function startAgent(): Promise<{ client: Client; code: string; port: number; token: string }> {
  stderrText = '';
  const transport = new StdioClientTransport({
    command: 'node',
    args: [resolve(pkg, 'dist/cli.mjs')],
    stderr: 'pipe',
  });
  const c = new Client({ name: 'e2e-agent', version: '1.0.0' });
  await c.connect(transport);
  transport.stderr?.on('data', (d: Buffer) => (stderrText += d.toString()));
  client = c;
  await expect.poll(() => /Pairing code: \S+/.test(stderrText)).toBe(true);
  const code = /Pairing code: (\S+)/.exec(stderrText)?.[1] ?? '';
  const [, port, token] = code.split(':');
  return { client: c, code, port: Number(port), token: token ?? '' };
}
async function call(c: Client, name: string, args: Record<string, unknown> = {}) {
  const r = (await c.callTool({ name, arguments: args })) as {
    isError?: boolean;
    content: { text: string }[];
  };
  return {
    isError: r.isError === true,
    json: JSON.parse(r.content[0]?.text ?? '{}') as Record<string, unknown>,
  };
}
async function openStack(page: Page, title: string): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/library');
  await page.getByLabel('New Stack title').fill(title);
  await page.getByRole('button', { name: 'Create Stack' }).click();
  await expect(page.getByTestId('card-stage')).toBeVisible();
  await page
    .getByRole('menubar', { name: 'Editor menu' })
    .getByRole('menuitem', { name: 'View', exact: true })
    .click();
  await page.getByRole('menu', { name: 'View' }).getByRole('menuitem', { name: 'AI assistant' }).click();
  await expect(page.getByRole('complementary', { name: 'AI assistant' })).toBeVisible();
}
const wsClose = (url: string, origin: string, hello?: unknown): Promise<number> =>
  new Promise((done) => {
    const ws = new WebSocket(url, { headers: { Origin: origin } });
    ws.on('open', () => hello && ws.send(JSON.stringify(hello)));
    ws.on('close', (code) => done(code));
    ws.on('unexpected-response', (_req, res) => {
      res.resume();
      done(res.statusCode ?? 0);
    });
    ws.on('error', () => undefined);
  });
test('agent reads the live Stack, proposals wait for approval, wrong token and origin are refused', async ({
  page,
}) => {
  const agent = await startAgent();
  await openStack(page, 'Agent Quiz');
  const nav = page.getByRole('navigation', { name: 'Cards' });
  const dock = page.getByRole('complementary', { name: 'AI assistant' });
  // Before pairing the agent gets a normalized error, not a Stack.
  const early = await call(agent.client, 'get_stack_summary');
  expect(early.isError).toBe(true);
  expect(early.json['error']).toMatchObject({ code: 'MCP_CONNECTION_FAILED' });
  // A wrong token typed into the UI is refused and says so.
  await dock.getByLabel('Pairing code').fill(`gs-mcp:${agent.port}:${'A'.repeat(22)}`);
  await dock.getByRole('button', { name: 'Connect', exact: true }).click();
  await expect(dock.getByTestId('bridge-status')).toContainText('not accepted');
  // Wrong token and wrong Origin straight at the listener.
  const url = `ws://127.0.0.1:${agent.port}/`;
  expect(
    await wsClose(url, 'http://127.0.0.1:5205', { t: 'hello', token: 'B'.repeat(22), protocol: 1 }),
  ).toBe(4401);
  expect(await wsClose(url, 'https://evil.example')).toBe(403);
  // Pair with the right code.
  await dock.getByLabel('Pairing code').fill(agent.code);
  await dock.getByRole('button', { name: 'Connect', exact: true }).click();
  await expect(dock.getByTestId('bridge-shared')).toContainText('Sharing Agent Quiz');
  // The agent sees the Stack as it is now, including an edit made after pairing.
  await nav.getByRole('button', { name: 'Add card' }).click();
  await expect(nav).toContainText('Cards (2)');
  const summary = await call(agent.client, 'get_stack_summary');
  expect(summary.json['title']).toBe('Agent Quiz');
  expect((summary.json['cards'] as unknown[]).length).toBe(2);
  const firstCardId = (summary.json['cards'] as { cardId: string }[])[0]?.cardId ?? '';
  expect((await call(agent.client, 'get_card_details', { cardId: firstCardId })).isError).toBe(false);
  expect((await call(agent.client, 'validate_project')).json).toEqual({ valid: true });
  // A proposal is accepted into the queue and nothing changes in the Stack.
  const proposal = await call(agent.client, 'propose_stack_patch', {
    plan: {
      schemaVersion: 1,
      summary: 'Add a Result card',
      affectedCardIds: ['result-card'],
      steps: [
        {
          id: 's1',
          rationale: 'The quiz needs a result card.',
          command: { type: 'ADD_CARD', cardId: 'result-card', title: 'Result' },
        },
      ],
    },
  });
  expect(proposal.isError).toBe(false);
  expect(proposal.json['status']).toBe('pending_user_approval');
  expect(String(proposal.json['message'])).toContain('pending user approval');
  await expect(dock.getByTestId('bridge-shared')).toContainText('waiting for approval: 1');
  await expect(nav).toContainText('Cards (2)');
  expect(((await call(agent.client, 'get_stack_summary')).json['cards'] as unknown[]).length).toBe(2);
  // A plan that does not fit the Stack is refused with the reason and queues nothing.
  const clash = await call(agent.client, 'propose_stack_patch', {
    plan: {
      schemaVersion: 1,
      summary: 'Add an existing card',
      affectedCardIds: [firstCardId],
      steps: [
        { id: 's1', rationale: 'Clash.', command: { type: 'ADD_CARD', cardId: firstCardId, title: 'Again' } },
      ],
    },
  });
  expect(clash.isError).toBe(true);
  await expect(dock.getByTestId('bridge-shared')).toContainText('waiting for approval: 1');
  // Disconnect cuts the agent off at once; editing and undo still work.
  await dock.getByRole('button', { name: 'Disconnect' }).click();
  await expect(dock.getByTestId('bridge-status')).toContainText('can no longer reach');
  const after = await call(agent.client, 'get_stack_summary');
  expect(after.isError).toBe(true);
  expect(after.json['error']).toMatchObject({ code: 'MCP_CONNECTION_FAILED' });
  await nav.getByRole('button', { name: 'Add card' }).click();
  await expect(nav).toContainText('Cards (3)');
  await page.keyboard.press('Control+z');
  await expect(nav).toContainText('Cards (2)');
});
test('the pairing control is keyboard operable with visible focus', async ({ page }) => {
  await startAgent();
  await openStack(page, 'Keyboard Stack');
  const dock = page.getByRole('complementary', { name: 'AI assistant' });
  const field = dock.getByLabel('Pairing code');
  await field.focus();
  await expect(field).toBeFocused();
  await page.keyboard.type('gs-mcp:1:bad');
  await page.keyboard.press('Enter');
  await expect(dock.getByTestId('bridge-status')).toContainText('looks like gs-mcp');
  await dock.getByRole('button', { name: 'Connect', exact: true }).focus();
  const outline = await dock
    .getByRole('button', { name: 'Connect', exact: true })
    .evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe('none');
});
