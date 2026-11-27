import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { unzipSync } from 'fflate';

/**
 * M3.6: an external agent builds a whole app through MCP. A real SDK client launches the built server
 * over stdio, pairs with the open editor tab, reads the live Stack, proposes an inventory app as one
 * plan, and the creator approves it in the editor. The result runs in preview and as an exported web
 * app opened from file://.
 */
const pkg = resolve(process.cwd(), 'packages/mcp-server');
let client: Client | undefined;

test.beforeAll(async () => {
  await promisify(execFile)('node', [resolve(pkg, 'build.mjs')], { cwd: pkg });
});
test.afterEach(async () => {
  await client?.close();
  client = undefined;
});

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

const layout = (x: number, y: number, width: number, height: number) => ({
  x,
  y,
  width,
  height,
  zIndex: 0,
  scaleMode: 'scale',
});
const joinItems = { kind: 'listJoin', key: 'items', separator: '\n' };

function inventoryPlan(cardId: string) {
  const element = (
    elementId: string,
    type: string,
    name: string,
    properties: Record<string, unknown>,
    l: ReturnType<typeof layout>,
    behaviors: unknown[] = [],
  ) => ({ elementId, type, name, properties, layout: l, behaviors });
  const click = (behaviorId: string, actions: unknown[]) => ({
    behaviorId,
    trigger: 'element.click',
    conditions: [],
    actions,
    enabled: true,
  });
  const add = (id: string, el: unknown) => ({
    id,
    cardId,
    rationale: 'Builds the inventory screen.',
    command: { type: 'ADD_ELEMENT', cardId, element: el },
  });
  return {
    schemaVersion: 1,
    summary: 'Turn the first card into a pantry inventory with add and remove.',
    affectedCardIds: [cardId],
    steps: [
      {
        id: 's1',
        rationale: 'Store the item being typed and the list of items.',
        command: {
          type: 'UPDATE_STATE_SCHEMA',
          stateSchema: { newItem: { type: 'string', initial: '' }, items: { type: 'list', initial: [] } },
        },
      },
      {
        id: 's2',
        cardId,
        rationale: 'Name the card.',
        command: { type: 'RENAME_CARD', cardId, title: 'Pantry' },
      },
      add(
        's3',
        element(
          'title',
          'text',
          'Title',
          { text: 'Pantry', fontSize: 40, fontWeight: 'bold' },
          layout(80, 60, 600, 64),
        ),
      ),
      add(
        's4',
        element(
          'item-input',
          'input',
          'Item',
          { placeholder: 'Item name', stateKey: 'newItem' },
          layout(80, 160, 420, 48),
        ),
      ),
      add(
        's5',
        element(
          'list-text',
          'text',
          'Items',
          { text: 'No items yet', fontSize: 22 },
          layout(80, 300, 600, 340),
        ),
      ),
      add(
        's6',
        element('add-btn', 'button', 'Add', { text: 'Add item' }, layout(520, 160, 180, 48), [
          click('add', [
            { type: 'listAdd', key: 'items', value: { kind: 'state', key: 'newItem' } },
            { type: 'setText', elementId: 'list-text', value: joinItems },
          ]),
        ]),
      ),
      add(
        's7',
        element('remove-btn', 'button', 'Remove first', { text: 'Remove first' }, layout(80, 230, 220, 48), [
          click('remove', [
            {
              type: 'if',
              condition: {
                kind: 'binary',
                op: '>',
                left: { kind: 'listLength', key: 'items' },
                right: { kind: 'literal', value: 0 },
              },
              then: [
                { type: 'listRemove', key: 'items', index: { kind: 'literal', value: 0 } },
                { type: 'setText', elementId: 'list-text', value: joinItems },
              ],
              else: [],
            },
          ]),
        ]),
      ),
    ],
  };
}

async function useInventory(app: Page | ReturnType<Page['getByLabel']>): Promise<void> {
  const input = app.getByRole('textbox').first();
  await input.fill('Rice');
  await app.getByRole('button', { name: 'Add item' }).click();
  await input.fill('Beans');
  await app.getByRole('button', { name: 'Add item' }).click();
  await expect(app.getByText('Rice')).toBeVisible();
  await expect(app.getByText('Beans')).toBeVisible();
  await app.getByRole('button', { name: 'Remove first' }).click();
  await expect(app.getByText('Rice')).toHaveCount(0);
  await expect(app.getByText('Beans')).toBeVisible();
}

test('an MCP agent builds an inventory app, the creator approves it, and it runs in preview and as a web export', async ({
  page,
  browser,
}) => {
  let stderr = '';
  const transport = new StdioClientTransport({
    command: 'node',
    args: [resolve(pkg, 'dist/cli.mjs')],
    stderr: 'pipe',
  });
  const agent = new Client({ name: 'kiro-agent', version: '1.0.0' });
  await agent.connect(transport);
  transport.stderr?.on('data', (d: Buffer) => (stderr += d.toString()));
  client = agent;
  await expect.poll(() => /Pairing code: \S+/.test(stderr)).toBe(true);
  const code = /Pairing code: (\S+)/.exec(stderr)?.[1] ?? '';

  // The agent can list what it may do before any tab is paired.
  const actions = await call(agent, 'list_registered_actions');
  expect(actions.isError).toBe(false);
  expect(JSON.stringify(actions.json)).toContain('listAdd');

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/library');
  await page.getByLabel('New Stack title').fill('Agent Pantry');
  await page.getByRole('button', { name: 'Create Stack' }).click();
  await expect(page.getByTestId('card-stage')).toBeVisible();
  await page
    .getByRole('menubar', { name: 'Editor menu' })
    .getByRole('menuitem', { name: 'View', exact: true })
    .click();
  await page.getByRole('menu', { name: 'View' }).getByRole('menuitem', { name: 'AI assistant' }).click();
  const dock = page.getByRole('complementary', { name: 'AI assistant' });
  await dock.getByLabel('Pairing code').fill(code);
  await dock.getByRole('button', { name: 'Connect', exact: true }).click();
  await expect(dock.getByTestId('bridge-shared')).toContainText('Sharing Agent Pantry');

  const summary = await call(agent, 'get_stack_summary');
  const cardId = String(summary.json['entryCardId']);
  expect(cardId.length).toBeGreaterThan(0);
  const proposal = await call(agent, 'propose_stack_patch', { plan: inventoryPlan(cardId) });
  expect(proposal.json, JSON.stringify(proposal.json)).toMatchObject({ status: 'pending_user_approval' });
  // Nothing changed until the creator approves.
  await expect(page.getByTestId('card-stage').getByText('Pantry')).toHaveCount(0);

  await expect(dock.getByTestId('bridge-shared')).toContainText('waiting for approval: 1');
  await dock.getByRole('tab', { name: 'Assistant' }).click();
  await dock.getByRole('button', { name: /^Review: / }).click();
  const review = dock.getByTestId('ai-review');
  await expect(review).toBeVisible();
  await expect(review.getByTestId('ai-step-failure')).toHaveCount(0);
  await review.getByRole('button', { name: 'Approve and apply' }).click();
  await expect(dock.getByTestId('ai-report')).toBeVisible();
  expect((await call(agent, 'validate_project')).json).toEqual({ valid: true });
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('card-stage').getByText('Pantry').first()).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: /^Saved/ })).toBeVisible();

  // Preview runs the app with the shared runtime.
  await page.getByRole('button', { name: 'Preview' }).click();
  await expect(page).toHaveURL(/\/preview$/);
  await useInventory(page.getByLabel('Application preview'));
  await page.getByRole('link', { name: 'Back to editor' }).click();

  // The exported web app runs on its own from file://, with no editor or AI code.
  const zipDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export web app' }).click();
  const files = unzipSync(readFileSync((await (await zipDownload).path())!));
  const text = Object.values(files)
    .map((d) => Buffer.from(d).toString('latin1'))
    .join('\n');
  expect(text).not.toContain('gs-mcp:');
  expect(text).not.toContain('openrouter');
  const dir = mkdtempSync(join(tmpdir(), 'gs-pantry-'));
  for (const [name, data] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), data);
  }
  const app = await browser.newPage();
  const errors: string[] = [];
  app.on('pageerror', (e) => errors.push(e.message));
  app.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await app.goto(pathToFileURL(join(dir, 'index.html')).href);
  await expect(app.getByText('Pantry').first()).toBeVisible();
  await useInventory(app);
  expect(errors).toEqual([]);
  await app.close();
});
