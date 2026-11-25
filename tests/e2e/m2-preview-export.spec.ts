import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';
import { unzipSync } from 'fflate';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

test('preview, .gsp round trip and standalone web export', async ({ page, browser }) => {
  await page.goto('/#/library');
  await page.getByLabel('New Stack title').fill('Export Demo');
  await page.getByRole('button', { name: 'Create Stack' }).click();

  await page.getByRole('button', { name: 'Add text' }).click();
  await page.getByLabel('Text 1 properties').getByLabel('Text', { exact: true }).fill('Hello export');
  await page.getByRole('button', { name: 'Add image' }).click();
  await page
    .getByLabel('Image 1 properties')
    .locator('input[type=file]')
    .setInputFiles({ name: 'dot.png', mimeType: 'image/png', buffer: PNG });
  await page.getByLabel('Image 1 properties').getByLabel('Alternative text').fill('A dot');
  await expect(page.getByTestId('card-stage').locator('img')).toBeVisible();

  // preview
  await page.getByRole('button', { name: 'Preview' }).click();
  await expect(page).toHaveURL(/\/preview$/);
  const host = page.getByLabel('Application preview');
  await expect(host.getByText('Hello export')).toBeVisible();
  await expect(host.locator('img')).toHaveAttribute('alt', 'A dot');
  await page.getByRole('link', { name: 'Back to editor' }).click();
  await expect(page.getByRole('button', { name: 'Text 1 (text)' })).toBeVisible();

  // .gsp export then import as a new Stack
  const gspDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export .gsp' }).click();
  const gsp = await gspDownload;
  expect(gsp.suggestedFilename()).toBe('Export Demo.gsp');
  const gspPath = await gsp.path();

  await page.getByRole('link', { name: 'Library' }).click();
  await page.locator('input[type=file][aria-label="Choose a .gsp file"]').setInputFiles(gspPath);
  await expect(page).toHaveURL(/#\/stack\/[^/]+$/);
  await expect(page.getByTestId('card-stage').getByText('Hello export')).toBeVisible();
  await expect(page.getByTestId('card-stage').locator('img')).toBeVisible();
  await page.getByRole('link', { name: 'Library' }).click();
  await expect(page.getByRole('list', { name: 'Stacks' }).getByRole('listitem')).toHaveCount(2);

  // a corrupt file is rejected and creates nothing
  const bad = join(mkdtempSync(join(tmpdir(), 'gs-bad-')), 'bad.gsp');
  writeFileSync(bad, 'not a zip');
  await page.locator('input[type=file][aria-label="Choose a .gsp file"]').setInputFiles(bad);
  await expect(page.getByRole('alert').filter({ hasText: 'Import failed' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Stacks' }).getByRole('listitem')).toHaveCount(2);

  // standalone web export runs from file:// without the editor
  await page.getByRole('button', { name: 'Open Export Demo' }).first().click();
  const zipDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export web app' }).click();
  const zip = await zipDownload;
  const files = unzipSync(readFileSync((await zip.path())!));
  expect(Object.keys(files).sort()).toEqual(expect.arrayContaining(['index.html', 'player.js']));
  expect(Object.keys(files).some((n) => n.startsWith('assets/'))).toBe(true);
  const dir = mkdtempSync(join(tmpdir(), 'gs-web-'));
  for (const [name, data] of Object.entries(files)) {
    const target = join(dir, name);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, data);
  }
  const app = await browser.newPage();
  const errors: string[] = [];
  app.on('pageerror', (e) => errors.push(e.message));
  await app.goto(pathToFileURL(join(dir, 'index.html')).href);
  await expect(app.getByText('Hello export')).toBeVisible();
  await expect(app.locator('img[alt="A dot"]')).toBeVisible();
  expect(await app.locator('img[alt="A dot"]').evaluate((i: HTMLImageElement) => i.naturalWidth)).toBe(1);
  expect(errors).toEqual([]);
  await app.close();
});
