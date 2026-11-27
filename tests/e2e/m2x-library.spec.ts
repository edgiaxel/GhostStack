import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { unzipSync } from 'fflate';

async function createFromTemplate(page: Page, name: string) {
  await page.goto('/#/library');
  await page.getByRole('button', { name }).click();
  await expect(page.getByRole('navigation', { name: 'Cards' })).toBeVisible();
}

test('M2.4: a quiz from a template runs in preview, with a branch', async ({ page }) => {
  await page.goto('/#/library');
  // nothing is seeded
  await expect(page.getByText('No Stacks yet')).toBeVisible();
  await createFromTemplate(page, 'Branching quiz');
  const nav = page.getByRole('navigation', { name: 'Cards' });
  await expect(nav).toContainText('Cards (4)');
  await expect(nav.getByText('Entry')).toHaveCount(1);
  await expect(nav.locator('.gs-navigator-thumb svg')).toHaveCount(4);

  await page.getByRole('button', { name: 'Preview' }).click();
  const host = page.getByLabel('Application preview');
  await expect(host.getByText('Branching quiz')).toBeVisible();
  await host.getByRole('button', { name: 'Begin' }).click();
  await expect(host.getByText('Which city is the capital of France?')).toBeVisible();
  await host.getByRole('button', { name: 'Lyon' }).click();
  await expect(host.getByText('Not quite.')).toBeVisible();
  await host.getByRole('button', { name: 'Try again' }).click();
  await host.getByRole('button', { name: 'Paris' }).click();
  await expect(host.getByText('Correct. Paris is the capital.')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Runtime issues' })).toHaveCount(0);
});

test('M2.4: an inventory from a template adds and removes items in preview', async ({ page }) => {
  await createFromTemplate(page, 'Inventory list');
  await page.getByRole('button', { name: 'Preview' }).click();
  const host = page.getByLabel('Application preview');
  await expect(host.getByText('No items yet.')).toBeVisible();
  const input = host.getByRole('textbox');
  await input.fill('milk');
  await host.getByRole('button', { name: 'Add item' }).click();
  await expect(host.getByText('milk')).toBeVisible();
  await input.fill('eggs');
  await host.getByRole('button', { name: 'Add item' }).click();
  await expect(host.getByText(/milk\s+eggs/)).toBeVisible();
  await host.getByRole('button', { name: 'Remove last' }).click();
  await expect(host.getByText('eggs')).toHaveCount(0);
  await expect(host.getByText('milk')).toBeVisible();
  await host.getByRole('button', { name: 'Remove last' }).click();
  await expect(host.getByText('No items yet.')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Runtime issues' })).toHaveCount(0);
});

test('M2.4: recipe and guide templates open as ordinary Stacks', async ({ page }) => {
  await createFromTemplate(page, 'Recipe collection');
  await expect(page.getByRole('navigation', { name: 'Cards' })).toContainText('Cards (2)');
  await page.getByRole('button', { name: 'Preview' }).click();
  const host = page.getByLabel('Application preview');
  await host.getByRole('textbox').fill('Soup');
  await host.getByRole('button', { name: 'Add recipe' }).click();
  await expect(host.getByText('Soup')).toBeVisible();
  await host.getByRole('button', { name: 'Ingredients' }).click();
  await expect(host.getByText('No ingredients yet.')).toBeVisible();

  await createFromTemplate(page, 'Interactive guide');
  await expect(page.getByRole('navigation', { name: 'Cards' })).toContainText('Cards (4)');
  await page.getByRole('button', { name: 'Preview' }).click();
  await page.getByLabel('Application preview').getByRole('button', { name: 'Start' }).click();
  await expect(page.getByLabel('Application preview').getByText('Describe the first thing')).toBeVisible();
  await page.getByLabel('Application preview').getByRole('button', { name: 'Back' }).click();
  await expect(page.getByLabel('Application preview').getByText('This guide has two steps')).toBeVisible();
});

test('M2.4: library search, sort, duplicate, export, delete and an empty search', async ({ page }) => {
  await page.goto('/#/library');
  await page.getByLabel('New Stack title').fill('Zebra');
  await page.getByRole('button', { name: 'Create Stack' }).click();
  // Create saves, then navigates; leave only after that navigation or it can land after ours.
  await expect(page).toHaveURL(/#\/stack\/[^/]+$/);
  await page.goto('/#/library');
  await page.getByRole('button', { name: 'Branching quiz' }).click();
  await expect(page.getByRole('navigation', { name: 'Cards' })).toContainText('Cards (4)');
  await page.goto('/#/library');
  const list = page.getByRole('list', { name: 'Stacks' });
  await expect(list.getByRole('listitem')).toHaveCount(2);
  // thumbnails are drawn from the first card
  await expect(list.locator('.gs-library-thumb svg')).toHaveCount(2);
  await expect(list.locator('.gs-library-thumb svg text', { hasText: 'Branching quiz' })).toHaveCount(1);

  // sort by title: the quiz (named after the template) comes before Zebra
  await page.getByLabel('Sort by').selectOption('title');
  await expect(list.getByRole('listitem').first()).toContainText('Branching quiz');
  await page.getByLabel('Sort by').selectOption('cards');
  await expect(list.getByRole('listitem').first()).toContainText('4 cards');

  // search
  await page.getByLabel('Search Stacks').fill('zeb');
  await expect(list.getByRole('listitem')).toHaveCount(1);
  await page.getByLabel('Search Stacks').fill('nothing like this');
  await expect(page.getByText('No Stacks match')).toBeVisible();
  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(list.getByRole('listitem')).toHaveCount(2);

  // duplicate
  await page.getByRole('button', { name: 'Duplicate Branching quiz' }).click();
  await expect(list.getByRole('listitem')).toHaveCount(3);
  await expect(list).toContainText('Branching quiz copy');

  // export from the card
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Zebra' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('Zebra.gsp');
  const zip = unzipSync(new Uint8Array(readFileSync((await file.path())!)));
  expect(Object.keys(zip).length).toBeGreaterThan(0);

  // delete asks first
  await page.getByRole('button', { name: 'Delete Branching quiz copy' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'This cannot be undone' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm delete' }).click();
  await expect(list.getByRole('listitem')).toHaveCount(2);
});

test('M2.4: the navigator reorders by drag and keeps the entry badge; delete names references', async ({
  page,
}) => {
  // tall viewport so no card scrolls while it is dragged
  await page.setViewportSize({ width: 1280, height: 1400 });
  await createFromTemplate(page, 'Branching quiz');
  const nav = page.getByRole('navigation', { name: 'Cards' });
  const items = nav.getByRole('listitem');
  await expect(items.nth(0)).toContainText('Start');
  // drag the last card to the top
  await items.nth(3).locator('.gs-navigator-thumb').dragTo(items.nth(0));
  await expect(items.nth(0)).toContainText('Try again');
  await expect(items.nth(1)).toContainText('Start');
  await expect(items.nth(1)).toContainText('Entry');
  // keyboard buttons still work
  await nav.getByRole('button', { name: 'Move Try again down' }).click();
  await expect(items.nth(0)).toContainText('Start');
  // delete names the references
  await nav.getByRole('button', { name: 'Delete Question' }).click();
  await expect(nav.getByRole('alertdialog')).toContainText('behaviors navigate to it');
  await nav.getByRole('button', { name: 'Cancel' }).click();
  await expect(nav).toContainText('Cards (4)');
});
