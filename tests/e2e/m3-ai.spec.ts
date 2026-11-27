import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { unzipSync } from 'fflate';
/**
 * M3.3: AI panel and approval workflow. The mock OpenAI-compatible server below runs in this file
 * only. Every Stack is created through the UI.
 */
const SECRET = 'sk-test-SECRET-0123456789';
type Mode = 'ok' | 'auth' | 'rate' | 'badjson' | 'slow';
let mode: Mode = 'ok';
let server: Server;
let baseUrl = '';
const seen: { authorization: string | undefined; path: string }[] = [];
let slowClosed = 0;
const PLAN = {
  schemaVersion: 1,
  summary: 'Add one card named Mock result.',
  affectedCardIds: ['mock-card-1'],
  steps: [
    {
      id: 's1',
      cardId: 'mock-card-1',
      rationale: 'Add the Mock result card.',
      command: { type: 'ADD_CARD', cardId: 'mock-card-1', title: 'Mock result' },
    },
  ],
};
function cors(res: ServerResponse): void {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-headers', 'authorization, content-type, accept');
  res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
  res.setHeader('access-control-expose-headers', 'retry-after');
}
function handle(req: IncomingMessage, res: ServerResponse): void {
  cors(res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204).end();
    return;
  }
  seen.push({ authorization: req.headers.authorization, path: req.url ?? '' });
  req.resume();
  const send = (status: number, body: unknown, headers: Record<string, string> = {}): void => {
    res.writeHead(status, { 'content-type': 'application/json', ...headers });
    res.end(JSON.stringify(body));
  };
  if (mode === 'auth') return send(401, { error: { message: `bad key ${SECRET}` } });
  if (mode === 'rate') return send(429, { error: 'slow down' }, { 'retry-after': '2' });
  if (req.url?.endsWith('/models')) return send(200, { data: [{ id: 'mock-model' }] });
  if (mode === 'slow') {
    res.on('close', () => (slowClosed += 1));
    return; // never answers
  }
  const content = mode === 'badjson' ? 'this is { not json' : JSON.stringify(PLAN);
  send(200, { choices: [{ message: { content }, finish_reason: 'stop' }] });
}
test.beforeAll(async () => {
  server = createServer(handle);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
});
test.afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
test.beforeEach(() => {
  mode = 'ok';
  seen.length = 0;
  slowClosed = 0;
});
async function createStack(page: Page, title: string): Promise<void> {
  await page.goto('/#/library');
  await page.getByLabel('New Stack title').fill(title);
  await page.getByRole('button', { name: 'Create Stack' }).click();
  await expect(page.getByRole('navigation', { name: 'Cards' })).toBeVisible();
}
const panel = (page: Page) => page.getByRole('complementary', { name: 'AI assistant' });
async function openPanel(page: Page): Promise<void> {
  await page.getByRole('menuitem', { name: 'View', exact: true }).click();
  await page.getByRole('menuitem', { name: /AI assistant/ }).click();
  await expect(panel(page).getByTestId('ai-panel')).toBeVisible();
}
async function useDemo(page: Page): Promise<void> {
  const p = panel(page);
  await p.getByRole('tab', { name: 'Provider' }).click();
  await p.getByRole('combobox', { name: 'Provider' }).selectOption('demo');
  await p.getByRole('button', { name: 'Test connection' }).click();
  await expect(p.getByTestId('ai-connection')).toContainText('ready');
  await p.getByRole('tab', { name: 'Assistant' }).click();
}
async function useMock(page: Page, url = baseUrl): Promise<void> {
  const p = panel(page);
  await p.getByRole('tab', { name: 'Provider' }).click();
  await p.getByRole('combobox', { name: 'Provider' }).selectOption('openai-compatible');
  await p.getByLabel('Base URL').fill(url);
  await p.getByLabel('Model').fill('mock-model');
  await p.getByLabel('API key').fill(SECRET);
  await p.getByRole('button', { name: 'Save settings' }).click();
  await p.getByRole('tab', { name: 'Assistant' }).click();
}
async function ask(page: Page, prompt: string): Promise<void> {
  const p = panel(page);
  await p.getByLabel('Describe the change').fill(prompt);
  await p.getByRole('button', { name: 'Ask for a plan' }).click();
}
const cardCount = (page: Page) => page.getByRole('navigation', { name: 'Cards' }).getByText(/^Cards \(\d+\)/);
async function dumpStorage(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const open = indexedDB.open('ghoststack');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const names = Array.from(db.objectStoreNames);
          const out: unknown[] = [];
          let left = names.length;
          names.forEach((name) => {
            const r = db.transaction(name).objectStore(name).getAll();
            r.onsuccess = () => {
              out.push(r.result);
              if (--left === 0) {
                db.close();
                resolve(
                  JSON.stringify(out) +
                    JSON.stringify({ ...localStorage }) +
                    JSON.stringify({ ...sessionStorage }),
                );
              }
            };
          });
        };
      }),
  );
}
test('demo adapter: prompt, review, approve, canvas, preview and a blocked revert after a manual edit', async ({
  page,
}) => {
  await createStack(page, 'AI Journey');
  await expect(cardCount(page)).toContainText('Cards (1)');
  await openPanel(page);
  await expect(page.getByRole('button', { name: /^AI:/ })).toContainText('not configured');
  await useDemo(page);
  await expect(page.getByRole('button', { name: /^AI:/ })).toContainText('Demo');
  await expect(page.getByRole('button', { name: /^AI:/ })).toContainText('Local');
  await ask(page, 'add a quiz question about space with three answers');
  const review = panel(page).getByTestId('ai-review');
  await expect(review).toBeVisible();
  await expect(review.getByRole('heading', { name: 'Quiz question' })).toBeVisible();
  await expect(review.getByText(/Adds a card named Quiz question/)).toBeVisible();
  await expect(review.getByText('Command details').first()).toBeVisible();
  await expect(review.locator('pre').first()).toBeHidden();
  await expect(cardCount(page)).toContainText('Cards (1)');
  const approve = review.getByRole('button', { name: 'Approve and apply' });
  await expect(approve).toBeEnabled();
  await approve.click();
  await expect(panel(page).getByTestId('ai-report')).toBeVisible();
  await expect(cardCount(page)).toContainText('Cards (3)');
  const nav = page.getByRole('navigation', { name: 'Cards' });
  await expect(nav.getByText('Quiz question')).toBeVisible();
  await expect(nav.getByText('Quiz result')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(panel(page)).toBeHidden();
  await nav.getByText('Quiz question').click();
  await expect(page.getByTestId('card-stage').getByRole('button', { name: /Answer A/ })).toBeVisible();
  // Preview starts at the entry Card, so remove the empty first Card by hand to make a quiz Card the entry.
  await nav
    .getByRole('button', { name: /^Card 1/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Delete Card 1' }).click();
  await page.getByRole('button', { name: 'Confirm delete' }).click();
  await expect(cardCount(page)).toContainText('Cards (2)');
  await page.getByRole('button', { name: 'Preview' }).click();
  await expect(page).toHaveURL(/\/preview$/);
  await expect(
    page.getByLabel('Application preview').getByRole('button', { name: /Answer A/ }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Back to editor' }).click();
  // The report survives the preview, but a manual edit after the AI change blocks the whole-change revert.
  await openPanel(page);
  await expect(panel(page).getByTestId('ai-report')).toBeVisible();
  await panel(page).getByRole('button', { name: 'Revert AI change' }).click();
  await expect(panel(page).getByTestId('ai-error')).toContainText('edited after the AI change');
  await expect(cardCount(page)).toContainText('Cards (2)');
});
test('revert survives the preview and is one undo step', async ({ page }) => {
  await createStack(page, 'AI Revert');
  await openPanel(page);
  await useDemo(page);
  await ask(page, 'add a quiz question about space');
  await panel(page).getByRole('button', { name: 'Approve and apply' }).click();
  await expect(cardCount(page)).toContainText('Cards (3)');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Preview' }).click();
  await expect(page).toHaveURL(/\/preview$/);
  await page.getByRole('link', { name: 'Back to editor' }).click();
  await expect(cardCount(page)).toContainText('Cards (3)');
  await openPanel(page);
  await panel(page).getByRole('button', { name: 'Revert AI change' }).click();
  await expect(panel(page).getByTestId('ai-reverted')).toBeVisible();
  await expect(cardCount(page)).toContainText('Cards (1)');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(cardCount(page)).toContainText('Cards (3)');
});
test('one undo step removes an approved AI change', async ({ page }) => {
  await createStack(page, 'AI Undo');
  await openPanel(page);
  await useDemo(page);
  await ask(page, 'add a recipe card with an ingredients list');
  await panel(page).getByRole('button', { name: 'Approve and apply' }).click();
  await expect(panel(page).getByTestId('ai-report')).toBeVisible();
  const added = await cardCount(page).innerText();
  expect(added).not.toContain('Cards (1)');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(cardCount(page)).toContainText('Cards (1)');
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
});
test('reject changes nothing and revise returns to the prompt with the text', async ({ page }) => {
  await createStack(page, 'AI Reject');
  await openPanel(page);
  await useDemo(page);
  await ask(page, 'add a quiz question');
  await panel(page).getByRole('button', { name: 'Revise request' }).click();
  await expect(panel(page).getByLabel('Describe the change')).toHaveValue('add a quiz question');
  await panel(page).getByRole('button', { name: 'Ask for a plan' }).click();
  await panel(page).getByRole('button', { name: 'Reject' }).click();
  await expect(panel(page).locator('p', { hasText: /Plan rejected/ })).toBeVisible();
  await expect(cardCount(page)).toContainText('Cards (1)');
});
test('demo provider reports a request it cannot handle without changing the project', async ({ page }) => {
  await createStack(page, 'AI Unsupported');
  await openPanel(page);
  await useDemo(page);
  await ask(page, 'translate everything to French');
  const alert = panel(page).getByTestId('ai-error');
  await expect(alert).toBeVisible();
  await expect(alert).toHaveAttribute('data-code', 'INVALID_AI_PLAN');
  await expect(cardCount(page)).toContainText('Cards (1)');
});
test.describe('OpenAI-compatible server failures', () => {
  test('401 asks for the key and never shows it', async ({ page }) => {
    await createStack(page, 'AI 401');
    await openPanel(page);
    mode = 'auth';
    await useMock(page);
    await ask(page, 'add a card');
    const alert = panel(page).getByTestId('ai-error');
    await expect(alert).toHaveAttribute('data-code', 'PROVIDER_AUTH_FAILED');
    await expect(alert).toContainText('Check the API key');
    await expect(page.locator('body')).not.toContainText(SECRET);
    await alert.getByRole('button', { name: 'Open provider settings' }).click();
    await expect(panel(page).getByRole('tab', { name: 'Provider' })).toHaveAttribute('aria-selected', 'true');
    await expect(cardCount(page)).toContainText('Cards (1)');
  });
  test('429 waits for Retry-After before Try again is enabled', async ({ page }) => {
    await createStack(page, 'AI 429');
    await openPanel(page);
    mode = 'rate';
    await useMock(page);
    await ask(page, 'add a card');
    const alert = panel(page).getByTestId('ai-error');
    await expect(alert).toHaveAttribute('data-code', 'PROVIDER_RATE_LIMIT');
    await expect(alert).toContainText(/about \d seconds/);
    const retry = alert.getByRole('button', { name: 'Try again' });
    await expect(retry).toBeDisabled();
    mode = 'ok';
    await expect(retry).toBeEnabled({ timeout: 6000 });
    await retry.click();
    await expect(panel(page).getByTestId('ai-review')).toBeVisible();
  });
  test('invalid JSON is reported as an unusable plan', async ({ page }) => {
    await createStack(page, 'AI JSON');
    await openPanel(page);
    mode = 'badjson';
    await useMock(page);
    await ask(page, 'add a card');
    const alert = panel(page).getByTestId('ai-error');
    await expect(alert).toHaveAttribute('data-code', 'INVALID_AI_PLAN');
    await expect(alert).not.toContainText('not json');
    await expect(cardCount(page)).toContainText('Cards (1)');
    await alert.getByRole('button', { name: 'Edit the request' }).click();
    await expect(panel(page).getByLabel('Describe the change')).toHaveValue('add a card');
  });
  test('a slow answer can be cancelled and the request is aborted', async ({ page }) => {
    await createStack(page, 'AI slow');
    await openPanel(page);
    mode = 'slow';
    await useMock(page);
    await ask(page, 'add a card');
    await expect(panel(page).getByTestId('ai-planning')).toBeVisible();
    await page.getByRole('button', { name: 'Add card' }).click();
    await expect(cardCount(page)).toContainText('Cards (2)');
    await panel(page).getByRole('button', { name: 'Cancel request' }).click();
    await expect(panel(page).locator('p', { hasText: /Request cancelled/ })).toBeVisible();
    await expect.poll(() => slowClosed).toBeGreaterThan(0);
    await expect(cardCount(page)).toContainText('Cards (2)');
  });
  test('a key never reaches storage, a .gsp or a web export', async ({ page }) => {
    await createStack(page, 'AI Secret');
    await openPanel(page);
    await useMock(page);
    await panel(page).getByRole('tab', { name: 'Provider' }).click();
    await panel(page).getByRole('button', { name: 'Test connection' }).click();
    await expect(panel(page).getByTestId('ai-connection')).toContainText('ready');
    await panel(page).getByRole('tab', { name: 'Assistant' }).click();
    await ask(page, 'add a card');
    await panel(page).getByRole('button', { name: 'Approve and apply' }).click();
    await expect(panel(page).getByTestId('ai-report')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Cards' }).getByText('Mock result')).toBeVisible();
    expect(seen.some((r) => r.authorization === `Bearer ${SECRET}`)).toBe(true);
    await expect(page.getByRole('status').filter({ hasText: /^Saved/ })).toBeVisible();
    const stored = await dumpStorage(page);
    expect(stored).not.toContain(SECRET);
    expect(stored).toContain('gs.ai.settings');
    expect(stored).toContain('Before AI');
    await page.keyboard.press('Escape');
    const gspDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export .gsp' }).click();
    const gsp = await gspDownload;
    const gspFiles = unzipSync(readFileSync((await gsp.path())!));
    for (const data of Object.values(gspFiles))
      expect(Buffer.from(data).toString('latin1')).not.toContain(SECRET);
    const zipDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export web app' }).click();
    const zip = await zipDownload;
    const webFiles = unzipSync(readFileSync((await zip.path())!));
    for (const data of Object.values(webFiles))
      expect(Buffer.from(data).toString('latin1')).not.toContain(SECRET);
    await page.reload();
    await expect(page.getByRole('button', { name: /^AI:/ })).toContainText('OpenAI-compatible');
    await expect(page.getByRole('button', { name: /^AI:/ })).toContainText('not tested');
    await openPanel(page);
    await panel(page).getByRole('tab', { name: 'Provider' }).click();
    await expect(panel(page).getByLabel('API key')).toHaveValue('');
    await expect(panel(page).getByText(/key is held in memory/)).toBeHidden();
  });
});
test.describe('editing stays intact', () => {
  test('provider down: connection error is shown and manual editing, undo and autosave work', async ({
    page,
  }) => {
    await createStack(page, 'AI down');
    await openPanel(page);
    await useMock(page, 'http://127.0.0.1:1/v1');
    await panel(page).getByRole('tab', { name: 'Provider' }).click();
    await panel(page).getByRole('button', { name: 'Test connection' }).click();
    await expect(panel(page).getByTestId('ai-connection')).toContainText('error');
    await expect(page.getByRole('button', { name: /^AI:/ })).toContainText('error');
    await page.getByRole('button', { name: 'Add text' }).click();
    await expect(page.getByRole('button', { name: 'Text 1 (text)' })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: /^Saved/ })).toBeVisible();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByRole('button', { name: 'Text 1 (text)' })).toBeHidden();
    await page.reload();
    await expect(page.getByRole('navigation', { name: 'Cards' })).toBeVisible();
  });
  test('the panel failing to load leaves the editor working', async ({ page }) => {
    await page.route(/\/features\/ai\/(index|AIPanel)\.tsx/, (route) => route.abort());
    await createStack(page, 'AI crash');
    await page.getByRole('menuitem', { name: 'View', exact: true }).click();
    await page.getByRole('menuitem', { name: /AI assistant/ }).click();
    await expect(page.getByText(/The AI assistant stopped working/).first()).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Add text' }).click();
    await expect(page.getByRole('button', { name: 'Text 1 (text)' })).toBeVisible();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByRole('button', { name: 'Text 1 (text)' })).toBeHidden();
  });
});
test('axe: the open panel has no serious or critical violations', async ({ page }) => {
  await createStack(page, 'AI axe');
  await openPanel(page);
  const scan = async (label: string): Promise<void> => {
    const results = await new AxeBuilder({ page })
      .include('[aria-label="AI assistant"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const bad = results.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target.join(' ')) }));
    expect(bad, label).toEqual([]);
  };
  await scan('provider tab');
  await useDemo(page);
  await scan('assistant tab');
  await ask(page, 'add a quiz question');
  await expect(panel(page).getByTestId('ai-review')).toBeVisible();
  await scan('review');
  await panel(page).getByRole('button', { name: 'Approve and apply' }).click();
  await expect(panel(page).getByTestId('ai-report')).toBeVisible();
  await scan('report');
});
