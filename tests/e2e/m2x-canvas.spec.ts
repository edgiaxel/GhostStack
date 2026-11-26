import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { unzipSync } from 'fflate';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const PNG2 = Buffer.concat([PNG, Buffer.from([0])]);

async function newStack(page: Page, title: string): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/library');
  await page.getByLabel('New Stack title').fill(title);
  await page.getByRole('button', { name: 'Create Stack' }).click();
  await expect(page.getByTestId('card-stage')).toBeVisible();
}
const stage = (page: Page): Locator => page.getByTestId('card-stage');
const elements = (page: Page): Locator => stage(page).getByRole('button');
const menubar = (page: Page): Locator => page.getByRole('menubar', { name: 'Editor menu' });
async function choose(page: Page, menu: string, item: string): Promise<void> {
  await menubar(page).getByRole('menuitem', { name: menu, exact: true }).click();
  await page.getByRole('menu', { name: menu }).getByRole('menuitem', { name: item }).click();
}
async function itemState(page: Page, menu: string, item: string): Promise<boolean> {
  await menubar(page).getByRole('menuitem', { name: menu, exact: true }).click();
  const disabled = await page
    .getByRole('menu', { name: menu })
    .getByRole('menuitem', { name: item })
    .evaluate((n) => n.getAttribute('aria-disabled') === 'true' || (n as HTMLButtonElement).disabled);
  await page.keyboard.press('Escape');
  return !disabled;
}
/** Screen point of a design pixel on the stage (the stage is scaled to fit). */
async function at(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  const b = (await stage(page).boundingBox())!;
  const k = b.width / 1280;
  return { x: b.x + x * k, y: b.y + y * k };
}
async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
}
async function centerOf(loc: Locator): Promise<{ x: number; y: number }> {
  const b = (await loc.boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
const selected = (page: Page): Locator => page.getByTestId('status-selection');
const addShape = async (page: Page): Promise<void> => {
  await page.getByRole('toolbar', { name: 'Tools' }).getByRole('button', { name: 'Add shape' }).click();
};
const layoutField = async (page: Page, label: string): Promise<string> => {
  await page.getByRole('tab', { name: 'Layout' }).click();
  return page.getByLabel(label, { exact: true }).first().inputValue();
};

/** Three shapes laid out apart from each other so they can be clicked and boxed in. */
async function threeShapes(page: Page): Promise<void> {
  for (let i = 0; i < 3; i++) await addShape(page);
  await expect(elements(page)).toHaveCount(3);
  await drag(
    page,
    await centerOf(page.getByRole('button', { name: 'Shape 3 (shape)' })),
    await at(page, 800, 400),
  );
  await drag(
    page,
    await centerOf(page.getByRole('button', { name: 'Shape 2 (shape)' })),
    await at(page, 450, 250),
  );
}

test('M2.5: marquee, shift-click, align, distribute, duplicate, delete and undo', async ({ page }) => {
  await newStack(page, 'Canvas multi');
  await threeShapes(page);
  // Marquee from empty canvas around every shape.
  await drag(page, await at(page, 1200, 680), await at(page, 5, 5));
  await expect(selected(page)).toHaveText('Selected: 3 elements');
  await expect(page.getByTestId('selection-bounds')).toBeVisible();
  await expect(page.getByTestId('marquee')).toHaveCount(0);
  // Inspector edits them together.
  await expect(page.getByLabel('3 elements properties')).toBeVisible();
  // Shift-click removes one from the selection and adds it back.
  const shape1 = page.getByRole('button', { name: 'Shape 1 (shape)' });
  await page.keyboard.down('Shift');
  await shape1.click({ position: { x: 20, y: 20 } });
  await page.keyboard.up('Shift');
  await expect(selected(page)).toHaveText('Selected: 2 elements');
  await page.keyboard.down('Shift');
  await shape1.click({ position: { x: 20, y: 20 } });
  await page.keyboard.up('Shift');
  await expect(selected(page)).toHaveText('Selected: 3 elements');
  // Align left: every X becomes the same shared value.
  await choose(page, 'Arrange', 'Align left');
  const x = await layoutField(page, 'X');
  expect(x).not.toBe('');
  expect(Number(x)).toBeLessThan(100);
  // Distribute needs three; the menu items are enabled with three selected.
  expect(await itemState(page, 'Arrange', 'Distribute vertically')).toBe(true);
  await choose(page, 'Arrange', 'Distribute vertically');
  // Drag moves the whole selection.
  const tops = async (): Promise<number[]> =>
    Promise.all(
      [1, 2, 3].map(
        async (i) => (await page.getByRole('button', { name: `Shape ${i} (shape)` }).boundingBox())!.y,
      ),
    );
  const before = await tops();
  const c = await centerOf(shape1);
  await drag(page, c, { x: c.x, y: c.y + 40 });
  const moved = await tops();
  moved.forEach((y, i) => expect(y).toBeGreaterThan(before[i]! + 20));
  // One undo reverts the whole drag.
  await choose(page, 'Edit', 'Undo');
  expect(await tops()).toEqual(before);
  // Ctrl+D duplicates all three as one undo step.
  await page.keyboard.press('Control+d');
  await expect(elements(page)).toHaveCount(6);
  await expect(selected(page)).toHaveText('Selected: 3 elements');
  await choose(page, 'Edit', 'Undo');
  await expect(elements(page)).toHaveCount(3);
  // Delete removes the selection together; undo brings it back.
  await page.keyboard.press('Control+a');
  await expect(selected(page)).toHaveText('Selected: 3 elements');
  await choose(page, 'Edit', 'Delete element');
  await expect(elements(page)).toHaveCount(0);
  await choose(page, 'Edit', 'Undo');
  await expect(elements(page)).toHaveCount(3);
});

test('M2.5: copy and paste across cards, with fresh ids and one undo step', async ({ page }) => {
  await newStack(page, 'Canvas clipboard');
  expect(await itemState(page, 'Edit', 'Paste')).toBe(false);
  await addShape(page);
  await addShape(page);
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Control+c');
  expect(await itemState(page, 'Edit', 'Paste')).toBe(true);
  await choose(page, 'Insert', 'Card');
  await expect(page.getByTestId('status-card')).toHaveText('Card 2 of 2');
  await expect(elements(page)).toHaveCount(0);
  await choose(page, 'Edit', 'Paste');
  await expect(elements(page)).toHaveCount(2);
  await expect(selected(page)).toHaveText('Selected: 2 elements');
  // A second paste lands further along, not on top of the first.
  await page.keyboard.press('Control+v');
  await expect(elements(page)).toHaveCount(4);
  await choose(page, 'Edit', 'Undo');
  await expect(elements(page)).toHaveCount(2);
  await choose(page, 'Edit', 'Undo');
  await expect(elements(page)).toHaveCount(0);
  // Card 1 still has its two shapes, untouched.
  await page
    .getByRole('button', { name: /Card 1/ })
    .first()
    .click();
  await expect(elements(page)).toHaveCount(2);
});

test('M2.5: elements snap to the frame edge and show a guide while dragging', async ({ page }) => {
  await newStack(page, 'Canvas snap');
  await addShape(page);
  const shape = page.getByRole('button', { name: 'Shape 1 (shape)' });
  const start = await centerOf(shape);
  const k = (await stage(page).boundingBox())!.width / 1280;
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  // The shape starts at x = 40. Move it so its left edge is 3 design pixels from the frame.
  await page.mouse.move(start.x - 37 * k, start.y, { steps: 6 });
  await expect(page.getByTestId('snap-guide').first()).toBeVisible();
  await page.mouse.up();
  await expect(page.getByTestId('snap-guide')).toHaveCount(0);
  expect(await layoutField(page, 'X')).toBe('0');
  // Alt disables snapping.
  const again = await centerOf(shape);
  await page.keyboard.down('Alt');
  await page.mouse.move(again.x, again.y);
  await page.mouse.down();
  await page.mouse.move(again.x + 3 * k, again.y, { steps: 4 });
  await expect(page.getByTestId('snap-guide')).toHaveCount(0);
  await page.mouse.up();
  await page.keyboard.up('Alt');
  expect(Number(await layoutField(page, 'X'))).toBeGreaterThan(0);
  // Arrow keys nudge by 1 and by 10 with Shift.
  const base = Number(await layoutField(page, 'X'));
  await shape.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Shift+ArrowRight');
  expect(Number(await layoutField(page, 'X'))).toBeCloseTo(base + 11, 0);
});

test('M2.5: double-click edits text in place; Enter commits and Escape cancels', async ({ page }) => {
  await newStack(page, 'Canvas text');
  await page.getByRole('toolbar', { name: 'Tools' }).getByRole('button', { name: 'Add text' }).click();
  const el = page.getByRole('button', { name: /Text 1 \(text\)/ });
  await el.dblclick();
  const box = page.getByRole('textbox', { name: 'Edit text of Text 1' });
  await expect(box).toBeFocused();
  await box.fill('Hello canvas');
  await box.press('Enter');
  await expect(page.getByRole('button', { name: 'Hello canvas, Text 1 (text)' })).toBeVisible();
  await page.getByRole('button', { name: /Text 1 \(text\)/ }).dblclick();
  await page.getByRole('textbox', { name: 'Edit text of Text 1' }).fill('discarded');
  await page.getByRole('textbox', { name: 'Edit text of Text 1' }).press('Escape');
  await expect(page.getByRole('button', { name: 'Hello canvas, Text 1 (text)' })).toBeVisible();
  // One undo restores the original text.
  await choose(page, 'Edit', 'Undo');
  await expect(page.getByRole('button', { name: 'Hello canvas, Text 1 (text)' })).toHaveCount(0);
  // The button on the canvas also edits in place.
  await page.getByRole('toolbar', { name: 'Tools' }).getByRole('button', { name: 'Add button' }).click();
  await page.getByRole('button', { name: /Button 1 \(button\)/ }).dblclick();
  await page.getByRole('textbox', { name: 'Edit text of Button 1' }).fill('Go');
  await page.getByRole('textbox', { name: 'Edit text of Button 1' }).press('Enter');
  await expect(page.getByRole('button', { name: 'Go, Button 1 (button)' })).toBeVisible();
});

test('M2.5: asset manager lists usage, replaces files, removes orphans, and exports leave orphans out', async ({
  page,
}) => {
  await newStack(page, 'Canvas assets');
  await page.getByRole('toolbar', { name: 'Tools' }).getByRole('button', { name: 'Add image' }).click();
  await page
    .getByLabel('Image 1 properties')
    .locator('input[type=file]')
    .setInputFiles({ name: 'dot.png', mimeType: 'image/png', buffer: PNG });
  await expect(stage(page).locator('img')).toBeVisible();
  await choose(page, 'View', 'Asset manager');
  const dialog = page.getByRole('dialog', { name: 'Assets' });
  await expect(dialog.getByTestId('asset-row')).toHaveCount(1);
  await expect(dialog.getByTestId('asset-usage')).toHaveText('Used by 1 element');
  await expect(dialog.getByRole('button', { name: /^Delete / })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Remove unused' })).toBeDisabled();
  // Replace the file: same asset, new size.
  const chooser = page.waitForEvent('filechooser');
  await dialog.getByRole('button', { name: /^Replace file of/ }).click();
  await (await chooser).setFiles({ name: 'dot2.png', mimeType: 'image/png', buffer: PNG2 });
  await expect(dialog.getByText(`${PNG2.length} B`)).toBeVisible();
  await expect(dialog.getByText('dot2.png')).toBeVisible();
  // A file that is not an image is refused with a reason.
  const second = page.waitForEvent('filechooser');
  await dialog.getByRole('button', { name: /^Replace file of/ }).click();
  await (await second).setFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('x') });
  await expect(dialog.getByRole('alert')).toContainText('Choose a PNG, JPEG, GIF or WebP image.');
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  // Delete the element: the asset becomes an orphan.
  await page.getByRole('button', { name: /Image 1 \(image\)/ }).focus();
  await page.keyboard.press('Delete');
  await expect(elements(page)).toHaveCount(0);
  await choose(page, 'View', 'Asset manager');
  await expect(dialog.getByTestId('asset-usage')).toHaveText('Not used');
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  // The web export leaves the orphan out.
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export web app' }).click();
  const files = unzipSync(readFileSync((await (await download).path())!));
  expect(Object.keys(files).filter((n) => n.startsWith('assets/'))).toEqual([]);
  // Remove unused deletes the entry.
  await choose(page, 'View', 'Asset manager');
  await dialog.getByRole('button', { name: 'Remove 1 unused' }).click();
  await expect(dialog.getByText('No assets in this stack.')).toBeVisible();
});

test('M2.5: the Edit and Arrange menus enable only what applies', async ({ page }) => {
  await newStack(page, 'Canvas menus');
  for (const item of ['Copy', 'Duplicate', 'Delete element']) {
    expect(await itemState(page, 'Edit', item), item).toBe(false);
  }
  expect(await itemState(page, 'Edit', 'Select all')).toBe(true);
  await addShape(page);
  expect(await itemState(page, 'Edit', 'Copy')).toBe(true);
  expect(await itemState(page, 'Arrange', 'Align left')).toBe(false);
  expect(await itemState(page, 'Arrange', 'Bring forward')).toBe(true);
  await addShape(page);
  await page.keyboard.press('Control+a');
  expect(await itemState(page, 'Arrange', 'Align left')).toBe(true);
  expect(await itemState(page, 'Arrange', 'Distribute horizontally')).toBe(false);
  expect(await itemState(page, 'Arrange', 'Bring forward')).toBe(false);
});
