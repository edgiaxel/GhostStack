import { expect, test } from '@playwright/test';

test('design gallery renders every component and the keyboard works', async ({ page }) => {
  await page.goto('/#/design');
  await expect(page.getByRole('heading', { name: 'Design system', level: 1 })).toBeVisible();
  for (const name of ['Button', 'Icon button', 'Fields', 'Tabs', 'Toast', 'Swatch']) {
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  }
  await page.getByRole('tab', { name: 'Script' }).click();
  await expect(page.getByRole('tabpanel')).toHaveText('Script panel');

  await page.getByRole('button', { name: 'Actions', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Duplicate' }).click();
  await expect(page.getByText('Last menu choice:')).toContainText('Duplicate');

  await page.getByRole('button', { name: 'Open dialog' }).click();
  await expect(page.getByRole('dialog', { name: 'Delete this card?' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('button', { name: 'Show error' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'This is a error message.' })).toBeVisible();
});

test('every control in the gallery is at least 32px high', async ({ page }) => {
  await page.goto('/#/design');
  const boxes = await page.locator('main button:visible, main .gs-input:visible').evaluateAll((els) =>
    els.map((e) => ({
      label: e.getAttribute('aria-label') ?? e.textContent ?? '',
      h: e.getBoundingClientRect().height,
    })),
  );
  expect(boxes.length).toBeGreaterThan(20);
  for (const b of boxes) expect.soft(b.h, b.label).toBeGreaterThanOrEqual(31.5);
});

test('accent choice is stored as an interface preference and survives reload', async ({ page }) => {
  await page.goto('/#/library');
  await page
    .locator('label', { hasText: /^Accent/ })
    .locator('select')
    .selectOption('jade');
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'jade');
  expect(await page.evaluate(() => localStorage.getItem('gs.accent'))).toBe('jade');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'jade');
  await page
    .locator('label', { hasText: /^Accent/ })
    .locator('select')
    .selectOption('default');
  await expect(page.locator('html')).not.toHaveAttribute('data-accent', /.+/);
});

test('accent is independent of theme', async ({ page }) => {
  await page.goto('/#/library');
  await page
    .locator('label', { hasText: /^Accent/ })
    .locator('select')
    .selectOption('rose');
  const accent = () =>
    page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--gs-accent').trim());
  const before = await accent();
  await page
    .locator('label', { hasText: /^Theme/ })
    .locator('select')
    .selectOption('paper');
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'rose');
  expect(await accent()).not.toBe(before);
});

test('the shell shows the generated brand mark', async ({ page }) => {
  await page.goto('/#/library');
  const mark = page.locator('.gs-brand img');
  await expect(mark).toBeVisible();
  expect(await mark.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
});
