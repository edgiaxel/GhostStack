import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * M3.6 live check against OpenRouter (an OpenAI-compatible hosted provider, decision D4).
 * Skipped unless OPENROUTER_KEY is in the environment. Run it with
 *   node --env-file=.env node_modules/@playwright/test/cli.js test m3-live-openrouter
 * The key goes only into the panel's API key field and is never printed or stored.
 */
const KEY = process.env['OPENROUTER_KEY'] ?? '';
const MODEL = process.env['OPENROUTER_MODEL'] ?? 'openai/gpt-4o-mini';
const BASE = 'https://openrouter.ai/api/v1';

test.skip(KEY === '', 'OPENROUTER_KEY is not set');
test.setTimeout(420_000);

const panel = (page: Page) => page.getByRole('complementary', { name: 'AI assistant' });

test('hosted provider: consent, plan, review, approve, preview, undo and no key in storage', async ({
  page,
}) => {
  await page.goto('/#/library');
  await page.getByLabel('New Stack title').fill('Live AI');
  await page.getByRole('button', { name: 'Create Stack' }).click();
  await expect(page.getByRole('navigation', { name: 'Cards' })).toBeVisible();
  await page.getByRole('menuitem', { name: 'View', exact: true }).click();
  await page.getByRole('menuitem', { name: /AI assistant/ }).click();
  const p = panel(page);
  await p.getByRole('tab', { name: 'Provider' }).click();
  await p.getByRole('combobox', { name: 'Provider' }).selectOption('openai-compatible');
  await p.getByLabel('Base URL').fill(BASE);
  await p.getByLabel('Model').fill(MODEL);
  await p.getByLabel('API key').fill(KEY);
  await p.getByRole('button', { name: 'Save settings' }).click();
  await p.getByRole('button', { name: 'Test connection' }).click();
  await expect(p.getByTestId('ai-connection')).toContainText('ready', { timeout: 30_000 });
  await p.getByRole('tab', { name: 'Assistant' }).click();
  await p
    .getByLabel('Describe the change')
    .fill(
      'Add a two-question quiz about the solar system. Each question is its own card with a text element for the question and three answer buttons. Each button goes to the next card. Add a final card that says the quiz is finished.',
    );
  await p.getByRole('button', { name: 'Ask for a plan' }).click();
  // Remote provider: the first send needs explicit consent.
  const consent = page.getByRole('button', { name: /^Send to / });
  await expect(consent).toBeVisible({ timeout: 15_000 });
  await consent.click();
  const review = p.getByTestId('ai-review');
  await expect(review).toBeVisible({ timeout: 120_000 });
  const failures = await review.getByTestId('ai-step-failure').allTextContents();
  test.info().annotations.push({ type: 'dry-run', description: failures.join(' | ') || 'all steps apply' });
  expect(failures, 'dry-run rejections').toEqual([]);
  await expect(page.getByRole('navigation', { name: 'Cards' }).getByText(/^Cards \(1\)/)).toBeVisible();
  await review.getByRole('button', { name: 'Approve and apply' }).click();
  await expect(p.getByTestId('ai-report')).toBeVisible({ timeout: 30_000 });
  const count = await page
    .getByRole('navigation', { name: 'Cards' })
    .getByText(/^Cards \(\d+\)/)
    .textContent();
  expect(Number(/\((\d+)\)/.exec(count ?? '')?.[1])).toBeGreaterThan(1);
  await page.keyboard.press('Escape');
  // One undo reverts the whole AI change, redo brings it back.
  const cards = page.getByRole('navigation', { name: 'Cards' });
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(cards.getByText(/^Cards \(1\)/)).toBeVisible();
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(cards.getByText(count ?? '')).toBeVisible();
  // The result is an ordinary Stack: it persists and previews without runtime issues.
  await expect(page.getByRole('status').filter({ hasText: /^Saved/ })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Preview' }).click();
  await expect(page).toHaveURL(/\/preview$/);
  await expect(page.getByLabel('Application preview')).toBeVisible();
  await expect(page.getByLabel('Runtime issues')).toHaveCount(0);
  await page.getByRole('link', { name: 'Back to editor' }).click();
  await expect(cards.getByText(count ?? '')).toBeVisible();
  // The key is held in memory only.
  const stored = await page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const open = indexedDB.open('ghoststack');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const names = Array.from(db.objectStoreNames);
          const out: unknown[] = [];
          let left = names.length;
          names.forEach((n) => {
            const r = db.transaction(n).objectStore(n).getAll();
            r.onsuccess = () => {
              out.push(r.result);
              if (--left === 0) {
                db.close();
                resolve(JSON.stringify(out) + JSON.stringify({ ...localStorage }));
              }
            };
          });
        };
      }),
  );
  expect(stored).not.toContain(KEY);
});
