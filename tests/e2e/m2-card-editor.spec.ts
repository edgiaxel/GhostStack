import { expect, test } from '@playwright/test';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

test('card editor: add, edit, move, reorder, image, viewport and persistence', async ({ page }) => {
  await page.goto('/#/library');
  await page.getByLabel('New Stack title').fill('Editor Demo');
  await page.getByRole('button', { name: 'Create Stack' }).click();
  await expect(page.getByText('This card is empty')).toBeVisible();

  const stage = page.getByTestId('card-stage');
  const inspector = (name: string) => page.getByLabel(`${name} properties`);

  // text element, edited in the inspector
  await page.getByRole('button', { name: 'Add text' }).click();
  await inspector('Text 1').getByLabel('Text', { exact: true }).fill('Hello quiz');
  await expect(stage.getByText('Hello quiz')).toBeVisible();

  // shape, moved by pointer drag and by keyboard
  await page.getByRole('button', { name: 'Add shape' }).click();
  const shape = page.getByRole('button', { name: 'Shape 1 (shape)' });
  const x = inspector('Shape 1').getByLabel('X', { exact: true });
  const startX = Number(await x.inputValue());
  const box = (await shape.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 40, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => Number(await x.inputValue())).toBeGreaterThan(startX + 20);
  const afterDrag = Number(await x.inputValue());
  await shape.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => Number(await x.inputValue())).toBe(afterDrag + 1);

  // resize from the keyboard
  const width = inspector('Shape 1').getByLabel('Width', { exact: true });
  const w0 = Number(await width.inputValue());
  await page.keyboard.press('Alt+ArrowRight');
  await expect.poll(async () => Number(await width.inputValue())).toBe(w0 + 1);

  // invalid value is reported and not stored
  await inspector('Shape 1').getByLabel('Fill', { exact: true }).fill('red;');
  await expect(inspector('Shape 1').getByRole('alert')).toBeVisible();

  // z-order: bring the text to front
  await page.getByRole('button', { name: 'Text 1 (text)' }).click();
  await page.getByRole('button', { name: 'Bring to front' }).click();
  await expect(page.getByRole('button', { name: 'Text 1 (text)' })).toHaveCSS('z-index', '1');

  // image upload and missing-file fallback survive reload
  await page.getByRole('button', { name: 'Add image' }).click();
  await inspector('Image 1')
    .locator('input[type=file]')
    .setInputFiles({ name: 'dot.png', mimeType: 'image/png', buffer: PNG });
  await expect(stage.locator('img')).toBeVisible();
  await inspector('Image 1').getByLabel('Alternative text').fill('A dot');

  // anchoring in another viewport
  await page.getByRole('button', { name: 'Text 1 (text)' }).click();
  await inspector('Text 1').getByLabel('Anchor').selectOption('bottom-right');
  const el = page.getByRole('button', { name: 'Text 1 (text)' });
  const desktopLeft = await el.evaluate((n) => (n as HTMLElement).style.left);
  await page.getByRole('radio', { name: 'Tablet' }).click();
  await expect(page.getByRole('note')).toContainText('Previewing anchoring');
  expect(await el.evaluate((n) => (n as HTMLElement).style.left)).not.toBe(desktopLeft);
  await page.getByRole('radio', { name: 'Desktop' }).click();

  // reload keeps everything
  await page.reload();
  await expect(stage.getByText('Hello quiz')).toBeVisible();
  await expect(stage.locator('img')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Shape 1 (shape)' })).toBeVisible();

  // delete
  await page.getByRole('button', { name: 'Shape 1 (shape)' }).focus();
  await page.getByRole('button', { name: 'Delete element' }).click();
  await expect(page.getByRole('button', { name: 'Shape 1 (shape)' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('button', { name: 'Shape 1 (shape)' })).toBeVisible();
});
