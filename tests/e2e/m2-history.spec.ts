import { expect, test } from '@playwright/test';

test('undo, redo and checkpoints work through the real session and IndexedDB', async ({ page }) => {
  await page.goto('/#/library');
  await page.getByLabel('New Stack title').fill('History Demo');
  await page.getByRole('button', { name: 'Create Stack' }).click();
  const nav = page.getByRole('navigation', { name: 'Cards' });
  await expect(nav).toContainText('Cards (1)');

  const undo = page.getByRole('button', { name: 'Undo' });
  const redo = page.getByRole('button', { name: 'Redo' });
  await expect(undo).toBeDisabled();

  await nav.getByRole('button', { name: 'Add card' }).click();
  await expect(nav).toContainText('Cards (2)');
  await expect(undo).toBeEnabled();
  await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();

  await undo.click();
  await expect(nav).toContainText('Cards (1)');
  await expect(redo).toBeEnabled();
  await redo.click();
  await expect(nav).toContainText('Cards (2)');

  await page.getByRole('button', { name: 'Checkpoints' }).click();
  await page.getByLabel('Checkpoint name').fill('two cards');
  await page.getByRole('button', { name: 'Save checkpoint' }).click();
  await expect(page.getByRole('region', { name: 'Checkpoints' })).toContainText('two cards');

  await nav.getByRole('button', { name: /^Delete Card 2/ }).click();
  await nav.getByRole('button', { name: 'Confirm delete' }).click();
  await expect(nav).toContainText('Cards (1)');

  await page.getByRole('button', { name: 'Restore two cards' }).click();
  await page.getByRole('button', { name: 'Confirm restore' }).click();
  await expect(nav).toContainText('Cards (2)');

  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Cards' })).toContainText('Cards (2)');
});
