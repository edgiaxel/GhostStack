import { expect, test } from '@playwright/test';

test('library -> workspace: create, persist, card CRUD, theme, delete', async ({ page }) => {
  await page.goto('/#/library');
  await expect(page.getByRole('heading', { name: 'Project Library' })).toBeVisible();

  // create
  await page.getByLabel('New Stack title').fill('Quiz Demo');
  await page.getByRole('button', { name: 'Create Stack' }).click();
  await expect(page).toHaveURL(/#\/stack\/[^/]+$/);
  await expect(page.getByRole('navigation', { name: 'Cards' })).toContainText('Cards (1)');

  // persists across reload in real IndexedDB
  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Cards' })).toContainText('Cards (1)');

  // card operations through domain applyCommand
  const nav = page.getByRole('navigation', { name: 'Cards' });
  await nav.getByRole('button', { name: 'Add card' }).click();
  await expect(nav).toContainText('Cards (2)');
  await expect(page).toHaveURL(/\/card\/[^/]+$/);

  await page.getByRole('button', { name: 'Rename Card 1' }).click();
  await page.getByLabel('Card title').fill('Intro');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(nav).toContainText('Intro');

  await page.getByRole('button', { name: 'Duplicate Intro' }).click();
  await expect(nav).toContainText('Cards (3)');

  await page.getByRole('button', { name: 'Move Intro down' }).click();
  await page.reload();
  await expect(nav).toContainText('Cards (3)');
  await expect(nav).toContainText('Intro');

  await page.getByRole('button', { name: /^Delete Intro copy/ }).click();
  await page.getByRole('button', { name: 'Confirm delete' }).click();
  await expect(nav).toContainText('Cards (2)');

  // one navbar, theme switch persists
  await expect(page.locator('header.gs-toolbar')).toHaveCount(1);
  await page.getByLabel('Theme').selectOption('paper');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'paper');

  // back to library: stack listed with persisted card count, rename, delete
  await page.getByRole('link', { name: 'Library' }).click();
  await expect(page.getByRole('list', { name: 'Stacks' })).toContainText('Quiz Demo');
  await expect(page.getByRole('list', { name: 'Stacks' })).toContainText('2 cards');
  await page.getByRole('button', { name: 'Rename Quiz Demo' }).click();
  await page.getByLabel('Rename Quiz Demo').fill('Quiz v2');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('list', { name: 'Stacks' })).toContainText('Quiz v2');
  await page.getByRole('button', { name: 'Delete Quiz v2' }).click();
  await page
    .getByRole('button', { name: /confirm|delete/i })
    .last()
    .click();
  await expect(page.getByRole('list', { name: 'Stacks' })).toHaveCount(0);
});

test('unknown stack id shows an error, not a crash', async ({ page }) => {
  await page.goto('/#/stack/does-not-exist');
  await expect(page.getByRole('alert')).toContainText('Stack not found');
});
