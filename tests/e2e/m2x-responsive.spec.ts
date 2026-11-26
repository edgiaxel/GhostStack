import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';
import type { Locator } from '@playwright/test';
import { unzipSync } from 'fflate';

/** Position of an element's center inside its stage, as a fraction of the stage size. */
async function fraction(stage: Locator, node: Locator): Promise<[number, number]> {
  const s = (await stage.boundingBox())!;
  const n = (await node.boundingBox())!;
  return [(n.x + n.width / 2 - s.x) / s.width, (n.y + n.height / 2 - s.y) / s.height];
}

test('M2.6: editor, preview and web export agree, and a phone window shows the whole card', async ({
  page,
  browser,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/library');
  await page.getByLabel('New Stack title').fill('Responsive');
  await page.getByRole('button', { name: 'Create Stack' }).click();
  await page.getByRole('button', { name: 'Add text' }).click();
  await page.getByLabel('Text 1 properties').getByLabel('Text', { exact: true }).fill('Line one\nLine two');
  await page.getByRole('button', { name: 'Add button' }).click();
  await page.getByLabel('Button 1 properties').getByLabel('Label').fill('Go');
  await page.getByRole('button', { name: 'Add shape' }).click();
  // new elements scale by default
  await expect(page.getByLabel('Shape 1 properties').getByLabel('Scaling')).toHaveValue('scale');
  const editorStage = page.getByTestId('card-stage');
  const editorGo = await fraction(editorStage, page.getByRole('button', { name: 'Button 1 (button)' }));

  // apply-scaling: make one element fixed, apply, undo restores it as one step
  await page.getByLabel('Shape 1 properties').getByLabel('Scaling').selectOption('fixed');
  const apply = page.getByRole('button', { name: 'Apply scaling to all' });
  await expect(apply).toBeEnabled();
  await apply.click();
  await expect(page.getByLabel('Shape 1 properties').getByLabel('Scaling')).toHaveValue('scale');
  await expect(apply).toBeDisabled();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByLabel('Shape 1 properties').getByLabel('Scaling')).toHaveValue('fixed');
  await apply.click();
  await expect(apply).toBeDisabled();

  // preview: Fit is the default and agrees with the editor
  await page.getByRole('button', { name: 'Preview' }).click();
  const host = page.getByLabel('Application preview');
  await expect(page.getByLabel('Size')).toHaveValue('fit');
  const previewStage = host.locator('[data-gs-stage]');
  const previewGo = await fraction(previewStage, host.getByRole('button', { name: 'Go' }));
  expect(previewGo[0]).toBeCloseTo(editorGo[0], 2);
  expect(previewGo[1]).toBeCloseTo(editorGo[1], 2);
  // line breaks of the text element are kept
  await expect(host.getByText('Line one')).toHaveCSS('white-space', 'pre-wrap');

  // phone window: the frame is letterboxed inside the host and nothing is cropped
  await page.setViewportSize({ width: 390, height: 844 });
  const h = (await host.boundingBox())!;
  const s = (await previewStage.boundingBox())!;
  expect(s.x).toBeGreaterThanOrEqual(h.x - 1);
  expect(s.x + s.width).toBeLessThanOrEqual(h.x + h.width + 1);
  expect(s.y).toBeGreaterThanOrEqual(h.y - 1);
  expect(s.y + s.height).toBeLessThanOrEqual(h.y + h.height + 1);
  expect(s.width / s.height).toBeCloseTo(1280 / 720, 1);
  const go = (await host.getByRole('button', { name: 'Go' }).boundingBox())!;
  expect(go.x + go.width).toBeLessThanOrEqual(h.x + h.width + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  // the button box shrinks with the frame (design height 40, scale about 0.3)
  const rendered = (await host.getByRole('button', { name: 'Go' }).boundingBox())!;
  expect(rendered.height).toBeLessThan(20);

  // window size mode is still available
  await page.getByLabel('Size').selectOption('window');
  await expect(host.getByRole('button', { name: 'Go' })).toBeVisible();
  await page.getByLabel('Size').selectOption('fit');

  // web export agrees too (from file://)
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('link', { name: 'Back to editor' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export web app' }).click();
  const files = unzipSync(readFileSync((await (await download).path())!));
  const dir = mkdtempSync(join(tmpdir(), 'gs-resp-'));
  for (const [name, data] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), data);
  }
  const app = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await app.goto(pathToFileURL(join(dir, 'index.html')).href);
  const exportGo = await fraction(app.locator('[data-gs-stage]'), app.getByRole('button', { name: 'Go' }));
  expect(exportGo[0]).toBeCloseTo(editorGo[0], 2);
  expect(exportGo[1]).toBeCloseTo(editorGo[1], 2);
  await app.setViewportSize({ width: 390, height: 844 });
  const box = (await app.locator('[data-gs-stage]').boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(391);
  await app.close();
});
