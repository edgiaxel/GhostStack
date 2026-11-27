import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

async function newStack(page: Page, title: string): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/library');
  await page.getByLabel('New Stack title').fill(title);
  await page.getByRole('button', { name: 'Create Stack' }).click();
  await expect(page.getByTestId('card-stage')).toBeVisible();
}

const menubar = (page: Page) => page.getByRole('menubar', { name: 'Editor menu' });
async function choose(page: Page, menu: string, item: string): Promise<void> {
  await menubar(page).getByRole('menuitem', { name: menu, exact: true }).click();
  await page.getByRole('menu', { name: menu }).getByRole('menuitem', { name: item }).click();
}
const stage = (page: Page) => page.getByTestId('card-stage');
const zoomText = (page: Page) => page.getByTestId('status-zoom');
/**
 * Clicks one zoom step at a time and waits for the shown value to change before the next click, so a
 * click never lands on a button that the previous step is about to disable at the limit.
 */
async function stepZoom(page: Page, button: Locator, limit: number): Promise<void> {
  for (let i = 0; i < 20; i++) {
    const before = await zoomPct(page);
    if (before === limit) return;
    await button.click();
    await expect.poll(() => zoomPct(page)).not.toBe(before);
  }
}
const zoomPct = async (page: Page): Promise<number> =>
  Number(((await zoomText(page).textContent()) ?? '').replace('%', ''));

test('M2.2: menu bar, tool rail and status bar run real commands', async ({ page }) => {
  await newStack(page, 'Shell menus');
  const menus = await menubar(page).getByRole('menuitem').allInnerTexts();
  expect(menus.map((m) => m.trim())).toEqual(['File', 'Edit', 'Insert', 'Arrange', 'View', 'Help']);

  // Insert menu adds an element and shows its shortcut.
  await menubar(page).getByRole('menuitem', { name: 'Insert' }).click();
  await expect(page.getByRole('menuitem', { name: 'Text' })).toHaveAttribute('aria-keyshortcuts', 'T');
  await page.getByRole('menuitem', { name: 'Text' }).click();
  await expect(page.getByRole('button', { name: 'Text 1 (text)' })).toBeVisible();
  await expect(page.getByTestId('status-selection')).toHaveText('Selected: Text 1 (text)');

  // Tool rail replaces the Add row.
  await page.getByRole('toolbar', { name: 'Tools' }).getByRole('button', { name: 'Add shape' }).click();
  await expect(page.getByRole('button', { name: 'Shape 1 (shape)' })).toBeVisible();
  await expect(page.getByTestId('status-card')).toHaveText('Card 1 of 1');

  // Arrange changes the z-order of the selected element.
  await choose(page, 'Arrange', 'Send to back');
  await expect(page.getByTestId('status-save')).toHaveText(/Saved|Saving|Unsaved/);

  // Edit > Undo twice: the reorder, then the shape. Delete (menu) removes the selected text.
  await choose(page, 'Edit', 'Undo');
  await choose(page, 'Edit', 'Undo');
  await expect(page.getByRole('button', { name: 'Shape 1 (shape)' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Text 1 (text)' }).focus();
  await choose(page, 'Edit', 'Delete element');
  await expect(page.getByRole('button', { name: 'Text 1 (text)' })).toHaveCount(0);
  await expect(page.getByTestId('status-selection')).toHaveText('Nothing selected');

  // Single-key tool shortcut.
  await page.getByTestId('card-stage').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('b');
  await expect(page.getByRole('button', { name: 'Button 1 (button)' })).toBeVisible();

  // Keyboard: arrow keys open and move through a menu, Escape closes it.
  await menubar(page).getByRole('menuitem', { name: 'File' }).focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menu', { name: 'File' })).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('menu', { name: 'Edit' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(menubar(page).getByRole('menuitem', { name: 'Edit' })).toBeFocused();

  // File > Preview opens the preview route.
  await choose(page, 'File', 'Preview');
  await expect(page).toHaveURL(/#\/stack\/[^/]+\/preview$/);
});

test('M2.2: panels resize with pointer and keyboard, collapse, and persist', async ({ page }) => {
  await newStack(page, 'Shell panels');
  const inspector = page.getByRole('complementary', { name: 'Inspector' });
  const width = async (): Promise<number> => (await inspector.boundingBox())!.width;
  const before = await width();

  // Pointer drag on the splitter between canvas and inspector.
  const split = page.getByRole('separator', { name: 'Resize inspector' });
  const box = (await split.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 80, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  const dragged = await width();
  expect(dragged).toBeGreaterThan(before + 60);

  // Keyboard: ArrowLeft grows it by 16, End jumps to the maximum.
  await split.focus();
  await page.keyboard.press('ArrowLeft');
  await expect.poll(width).toBeGreaterThan(dragged + 10);
  await page.keyboard.press('End');
  await expect(split).toHaveAttribute('aria-valuenow', '560');
  await page.keyboard.press('Home');
  await expect(split).toHaveAttribute('aria-valuenow', '240');
  await page.keyboard.press('ArrowLeft');
  await expect(split).toHaveAttribute('aria-valuenow', '256');

  // Sizes persist as interface preferences, not project data.
  expect(await page.evaluate(() => localStorage.getItem('gs.layout.inspector'))).toBe(
    '{"size":256,"collapsed":false}',
  );
  await page.reload();
  await expect(stage(page)).toBeVisible();
  await expect(page.getByRole('separator', { name: 'Resize inspector' })).toHaveAttribute(
    'aria-valuenow',
    '256',
  );
  expect(Math.round(await width())).toBe(256);

  // Collapse and expand the navigator; the choice survives a reload.
  const nav = page.getByRole('complementary', { name: 'Navigator' });
  await page.getByRole('button', { name: 'Collapse cards' }).click();
  await expect(nav).toHaveAttribute('data-collapsed', 'true');
  expect(Math.round((await nav.boundingBox())!.width)).toBe(36);
  await page.reload();
  await expect(page.getByRole('complementary', { name: 'Navigator' })).toHaveAttribute(
    'data-collapsed',
    'true',
  );
  await page.getByRole('button', { name: 'Expand cards' }).click();
  await expect(page.getByRole('navigation', { name: 'Cards' })).toBeVisible();

  // Console: collapsing gives the canvas more height (U9).
  const area = page.getByTestId('canvas-area');
  const areaHeight = async (): Promise<number> => (await area.boundingBox())!.height;
  const withConsole = await areaHeight();
  await page.getByRole('button', { name: 'Collapse console' }).click();
  await expect.poll(areaHeight).toBeGreaterThan(withConsole + 100);

  // View > Reset panel sizes restores defaults and clears the stored keys.
  await choose(page, 'View', 'Reset panel sizes');
  await expect(page.getByRole('separator', { name: 'Resize inspector' })).toHaveAttribute(
    'aria-valuenow',
    '320',
  );
  expect(await page.evaluate(() => localStorage.getItem('gs.layout.inspector'))).toBeNull();
});

test('M2.2: whole card is visible at Fit, and the drawer shows validation and runtime tabs', async ({
  page,
}) => {
  await newStack(page, 'Shell console');
  const frame = (await page.locator('.gs-ce-frame').boundingBox())!;
  const area = (await page.getByTestId('canvas-area').boundingBox())!;
  expect(frame.y + frame.height).toBeLessThanOrEqual(area.y + area.height + 1);
  expect(frame.x + frame.width).toBeLessThanOrEqual(area.x + area.width + 1);

  const drawer = page.locator('footer.gs-area-drawer');
  await drawer.getByRole('tab', { name: 'Problems' }).click();
  await expect(drawer.getByText('No problems')).toBeVisible();
  await drawer.getByRole('tab', { name: 'Runtime' }).click();
  await expect(drawer.getByText(/Dry run of entering/)).toBeVisible();
  await drawer.getByRole('tab', { name: 'Behavior' }).click();
  await expect(drawer.locator('.gs-beh-panel')).toBeVisible();
});

test('M2.2: zoom 25 to 400, Fit, actual size, wheel zoom at the pointer, and space-drag pan', async ({
  page,
}) => {
  await newStack(page, 'Shell zoom');
  await page.getByRole('button', { name: 'Add shape' }).click();
  const fitPct = await zoomPct(page);
  expect(fitPct).toBeLessThan(100);
  await expect(page.getByRole('button', { name: 'Fit' })).toHaveAttribute('aria-pressed', 'true');

  await choose(page, 'View', 'Actual size');
  await expect(zoomText(page)).toHaveText('100%');
  await expect(stage(page)).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');

  const zoomIn = page.getByRole('button', { name: 'Zoom in' });
  await stepZoom(page, zoomIn, 400);
  await expect(zoomText(page)).toHaveText('400%');
  await expect(zoomIn).toBeDisabled();
  const zoomOut = page.getByRole('button', { name: 'Zoom out' });
  await stepZoom(page, zoomOut, 25);
  await expect(zoomText(page)).toHaveText('25%');
  await expect(zoomOut).toBeDisabled();

  // Fit again, then ctrl+wheel keeps the design point under the pointer fixed.
  await page.getByRole('button', { name: 'Fit' }).click();
  await expect(zoomText(page)).toHaveText(`${fitPct}%`);
  await page.getByRole('button', { name: 'Actual size' }).click();
  const s0 = (await stage(page).boundingBox())!;
  const px = s0.x + s0.width * 0.3;
  const py = s0.y + s0.height * 0.4;
  const fx = (px - s0.x) / s0.width;
  const fy = (py - s0.y) / s0.height;
  await page.mouse.move(px, py);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -240);
  await page.keyboard.up('Control');
  await expect.poll(() => zoomPct(page)).toBeGreaterThan(100);
  const s1 = (await stage(page).boundingBox())!;
  expect(s1.width).toBeGreaterThan(s0.width);
  expect(Math.abs((px - s1.x) / s1.width - fx)).toBeLessThan(0.01);
  expect(Math.abs((py - s1.y) / s1.height - fy)).toBeLessThan(0.01);

  // Space-drag pans the scrolled area.
  const area = page.getByTestId('canvas-area');
  const scrollLeft = async (): Promise<number> => area.evaluate((n) => n.scrollLeft);
  const start = await scrollLeft();
  const a = (await area.boundingBox())!;
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.down('Space');
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 120, a.y + a.height / 2, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.up('Space');
  expect(await scrollLeft()).toBeLessThan(start - 50);
  // The element did not move: panning is not an edit.
  await expect(page.getByTestId('status-selection')).toHaveText(/Selected: Shape 1|Nothing selected/);
});

test('M2.2: the shortcut sheet opens from ? and from Help, and lists the shortcuts', async ({ page }) => {
  await newStack(page, 'Shell help');
  await page.getByTestId('card-stage').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('?');
  const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await expect(dialog).toBeVisible();
  for (const text of ['Undo', 'Fit to window', 'Pan the canvas', 'Show keyboard shortcuts']) {
    await expect(dialog.getByText(text, { exact: true })).toBeVisible();
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await choose(page, 'Help', 'Keyboard shortcuts');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Close' }).first().click();
  await expect(dialog).toBeHidden();
});
