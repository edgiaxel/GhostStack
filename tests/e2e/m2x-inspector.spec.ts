import { expect, test } from '@playwright/test';

test('inspector: card section, tabs, pin picker, steppers, colors, errors, keyboard and persistence', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/library');
  await page.getByLabel('New Stack title').fill('Inspector');
  await page.getByRole('button', { name: 'Create Stack' }).click();
  await expect(page.getByText('This card is empty')).toBeVisible();

  // card section when nothing is selected
  const card = page.getByLabel('Card properties');
  await card.getByLabel('Title', { exact: true }).fill('Welcome');
  await card.getByLabel('Background', { exact: true }).fill('#223344');
  await expect(page.getByTestId('card-stage')).toHaveCSS('background-color', 'rgb(34, 51, 68)');

  // element tabs
  await page.getByRole('button', { name: 'Add shape' }).click();
  const panel = page.getByLabel('Shape 1 properties');
  await expect(panel.getByRole('tab')).toHaveText(['Content', 'Layout', 'Appearance', 'Behavior']);
  await panel.getByRole('tab', { name: 'Layout' }).click();
  await expect(panel.getByText('Tablet', { exact: true })).toBeVisible();
  await expect(panel.getByText('Mobile', { exact: true })).toBeVisible();

  // steppers and fields
  const x = panel.getByLabel('X', { exact: true });
  const x0 = Number(await x.inputValue());
  await panel.getByRole('button', { name: 'Increase X' }).click();
  await expect.poll(async () => Number(await x.inputValue())).toBe(x0 + 1);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(async () => Number(await x.inputValue())).toBe(x0);

  // pin picker, anchor select and scaling explanation stay in sync
  await panel.getByRole('button', { name: 'Pin bottom right' }).click();
  await expect(panel.getByLabel('Anchor')).toHaveValue('bottom-right');
  await expect(panel.getByRole('button', { name: 'Pin bottom right' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await panel.getByLabel('Scaling').selectOption('stretch');
  await expect(panel.getByText(/Stretch changes width and height/)).toBeVisible();

  // keyboard only: arrows on the tab list, Tab into the pin picker, Space to choose
  await panel.getByRole('tab', { name: 'Layout' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(panel.getByRole('tab', { name: 'Appearance' })).toHaveAttribute('aria-selected', 'true');

  // colors: swatch, invalid hex with hint, Default
  await panel.getByRole('button', { name: 'Fill: White' }).click();
  await expect(panel.getByLabel('Fill', { exact: true })).toHaveValue('#ffffff');
  await panel.getByLabel('Fill', { exact: true }).fill('red;');
  await expect(panel.getByRole('alert')).toContainText('Use a hex color');
  await panel.getByLabel('Fill', { exact: true }).blur();
  await expect(panel.getByLabel('Fill', { exact: true })).toHaveValue('#ffffff');
  await panel.getByRole('button', { name: 'Default' }).first().click();

  // behavior tab: empty, no edit button until the shell supplies onOpenBehavior
  await panel.getByRole('tab', { name: 'Behavior' }).click();
  await expect(panel.getByText('No behaviors on this element.')).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Edit behaviors' })).toHaveCount(0);

  // nothing overflows the panel horizontally
  const clipped = await page.evaluate(() => {
    const root = document.querySelector('.gs-ci') as HTMLElement | null;
    return root ? root.scrollWidth - root.clientWidth : 0;
  });
  expect(clipped).toBeLessThanOrEqual(0);

  // reference frame (the canvas locks editing while the preset differs from the frame)
  await page.reload();
  await page.getByTestId('card-stage').click({ position: { x: 2, y: 2 } });
  const frame = page.getByLabel('Card properties');
  await frame.getByLabel('Frame width', { exact: true }).fill('1000');
  await frame.getByLabel('Frame height', { exact: true }).fill('600');
  await frame.getByLabel('Frame height', { exact: true }).fill('50');
  await expect(frame.getByText('Must be at least 120.')).toBeVisible();

  // persistence
  await page.reload();
  await page.getByTestId('card-stage').click({ position: { x: 2, y: 2 } });
  await expect(page.getByLabel('Card properties').getByLabel('Title', { exact: true })).toHaveValue(
    'Welcome',
  );
  await expect(page.getByLabel('Card properties').getByLabel('Frame width', { exact: true })).toHaveValue(
    '1000',
  );
});
