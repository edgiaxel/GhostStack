import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';
import { unzipSync } from 'fflate';

/** M2 exit criteria: build a small interactive app without AI, keep it across reload, preview it, and ship it standalone. */
test('build, preview and export a two-card quiz with behavior', async ({ page, browser }) => {
  await page.goto('/#/library');
  await page.getByLabel('New Stack title').fill('Quiz');
  await page.getByRole('button', { name: 'Create Stack' }).click();

  const nav = page.getByRole('navigation', { name: 'Cards' });
  const stage = page.getByTestId('card-stage');
  const props = (name: string) => page.getByLabel(`${name} properties`);

  // card 1: a label and a button
  await page.getByRole('button', { name: 'Add text' }).click();
  await props('Text 1').getByLabel('Text', { exact: true }).fill('Question');
  await page.getByRole('button', { name: 'Add button' }).click();
  await props('Button 1').getByLabel('Label').fill('Answer');

  // card 2: the winning message
  await nav.getByRole('button', { name: 'Add card' }).click();
  await expect(nav).toContainText('Cards (2)');
  await page.getByRole('button', { name: 'Add text' }).click();
  await props('Text 1').getByLabel('Text', { exact: true }).fill('You win');
  await nav
    .getByRole('button', { name: /^Card 1/ })
    .first()
    .click();
  await expect(stage.getByText('Question')).toBeVisible();

  // behavior through GhostScript on the button
  await page.getByRole('button', { name: 'Button 1 (button)' }).click();
  const panel = page.locator('.gs-beh-panel');
  await expect(panel).toContainText('Behaviors for Button 1');
  await panel.getByRole('tab', { name: 'Variables' }).click();
  await panel.getByLabel('New variable', { exact: true }).fill('score');
  await panel.getByRole('button', { name: 'Add variable' }).click();
  await panel.getByRole('tab', { name: 'GhostScript' }).click();
  await panel.locator('summary').click();
  const labelId = JSON.parse(
    await panel.locator('li', { hasText: 'Text 1 (text)' }).locator('code').innerText(),
  ) as string;
  const card2Id = JSON.parse(
    await panel.locator('li', { hasText: 'Card Card 2' }).locator('code').innerText(),
  ) as string;
  await panel.locator('.cm-content').click();
  await page.keyboard.insertText(
    `behavior "answer" on element.click {\n  set score = score + 1\n  text "${labelId}" = "Score " + score\n  if score >= 2 {\n    go "${card2Id}"\n  }\n}\n`,
  );
  await expect(panel.getByText('Script is valid and saved.')).toBeVisible();

  // undo and redo work for the whole behavior edit
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('button', { name: 'Redo' })).toBeEnabled();
  await page.getByRole('button', { name: 'Redo' }).click();

  // data survives reload
  await page.reload();
  await expect(stage.getByText('Question')).toBeVisible();
  await page.getByRole('button', { name: 'Button 1 (button)' }).click();
  await panel.getByRole('tab', { name: 'GhostScript' }).click();
  await expect(panel.locator('.cm-content')).toContainText('set score = score + 1');

  // preview runs the behavior
  await page.getByRole('button', { name: 'Preview' }).click();
  const host = page.getByLabel('Application preview');
  await host.getByRole('button', { name: 'Answer' }).click();
  await expect(host.getByText('Score 1')).toBeVisible();
  await host.getByRole('button', { name: 'Answer' }).click();
  await expect(host.getByText('You win')).toBeVisible();
  await page.getByRole('button', { name: 'Restart' }).click();
  await expect(host.getByText('Question')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Runtime issues' })).toHaveCount(0);

  // exported web app behaves the same, offline from file://
  await page.getByRole('link', { name: 'Back to editor' }).click();
  const zipDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export web app' }).click();
  const files = unzipSync(readFileSync((await (await zipDownload).path())!));
  const dir = mkdtempSync(join(tmpdir(), 'gs-quiz-'));
  for (const [name, data] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), data);
  }
  const app = await browser.newPage();
  const errors: string[] = [];
  app.on('pageerror', (err) => errors.push(err.message));
  app.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await app.goto(pathToFileURL(join(dir, 'index.html')).href);
  await app.getByRole('button', { name: 'Answer' }).click();
  await expect(app.getByText('Score 1')).toBeVisible();
  await app.getByRole('button', { name: 'Answer' }).click();
  await expect(app.getByText('You win')).toBeVisible();
  expect(errors).toEqual([]);
  await app.close();

  // .gsp round trip keeps the behavior
  const gsp = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export .gsp' }).click();
  const gspPath = (await (await gsp).path())!;
  await page.getByRole('link', { name: 'Library' }).click();
  await page.locator('input[type=file][aria-label="Choose a .gsp file"]').setInputFiles(gspPath);
  await expect(page).toHaveURL(/#\/stack\/[^/]+$/);
  await page.getByRole('button', { name: 'Preview' }).click();
  const copy = page.getByLabel('Application preview');
  await copy.getByRole('button', { name: 'Answer' }).click();
  await copy.getByRole('button', { name: 'Answer' }).click();
  await expect(copy.getByText('You win')).toBeVisible();
});
