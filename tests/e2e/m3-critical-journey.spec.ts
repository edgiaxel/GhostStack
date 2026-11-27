import { expect, test } from '@playwright/test';

/**
 * M3.6 critical journey: create, ask the offline demo adapter with the network switched off, approve,
 * preview, export .gsp, import it again and find the AI change in the copy. Requests that leave the
 * machine are counted; there must be none.
 */
test('offline demo adapter: create, ask, approve, preview, export and import', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (r) => {
    const host = new URL(r.url()).hostname;
    if (
      !['127.0.0.1', 'localhost', '[::1]'].includes(host) &&
      !r.url().startsWith('data:') &&
      !r.url().startsWith('blob:')
    )
      external.push(host);
  });

  await page.goto('/#/library');
  await page.getByLabel('New Stack title').fill('Offline Journey');
  await page.getByRole('button', { name: 'Create Stack' }).click();
  const nav = page.getByRole('navigation', { name: 'Cards' });
  await expect(nav).toContainText('Cards (1)');
  await page.getByRole('menuitem', { name: 'View', exact: true }).click();
  await page.getByRole('menuitem', { name: /AI assistant/ }).click();
  const p = page.getByRole('complementary', { name: 'AI assistant' });
  await expect(p.getByTestId('ai-panel')).toBeVisible();
  await p.getByRole('tab', { name: 'Provider' }).click();
  await p.getByRole('combobox', { name: 'Provider' }).selectOption('demo');
  await p.getByRole('button', { name: 'Test connection' }).click();
  await expect(p.getByTestId('ai-connection')).toContainText('ready');
  await p.getByRole('tab', { name: 'Assistant' }).click();

  // No network from here until the change is applied.
  await page.context().setOffline(true);
  await p.getByLabel('Describe the change').fill('add a quiz question about space with three answers');
  await p.getByRole('button', { name: 'Ask for a plan' }).click();
  const review = p.getByTestId('ai-review');
  await expect(review).toBeVisible();
  await expect(review.getByTestId('ai-step-failure')).toHaveCount(0);
  await expect(nav).toContainText('Cards (1)');
  await review.getByRole('button', { name: 'Approve and apply' }).click();
  await expect(p.getByTestId('ai-report')).toBeVisible();
  await expect(nav).toContainText('Cards (3)');
  await expect(page.getByRole('status').filter({ hasText: /^Saved/ })).toBeVisible();
  await page.context().setOffline(false);
  await page.keyboard.press('Escape');

  // Preview starts at the entry card, so open the quiz card through the navigator first.
  await nav.getByText('Quiz question').click();
  await expect(page.getByTestId('card-stage').getByRole('button', { name: /Answer A/ })).toBeVisible();

  const gsp = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export .gsp' }).click();
  const gspPath = (await (await gsp).path())!;
  await page.getByRole('link', { name: 'Library' }).click();
  await page.locator('input[type=file][aria-label="Choose a .gsp file"]').setInputFiles(gspPath);
  await expect(page).toHaveURL(/#\/stack\/[^/]+$/);
  await expect(nav).toContainText('Cards (3)');
  await expect(nav.getByText('Quiz question')).toBeVisible();
  await nav.getByText('Quiz question').click();
  await expect(page.getByTestId('card-stage').getByRole('button', { name: /Answer A/ })).toBeVisible();
  await page.getByRole('button', { name: 'Preview' }).click();
  await expect(page.getByLabel('Application preview')).toBeVisible();
  await expect(page.getByLabel('Runtime issues')).toHaveCount(0);

  expect(external).toEqual([]);
});
