import { expect, test } from '@playwright/test';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const shot = (name: string) => `docs/audit/${name}.png`;

test('audit screenshots: every main screen in every theme', async ({ page }) => {
  test.skip(!process.env.AUDIT_SHOTS, 'Set AUDIT_SHOTS=1 to regenerate docs/audit screenshots');
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/library');
  await page.screenshot({ path: shot('01-library-empty') });
  await page.getByLabel('New Stack title').fill('Capital Quiz');
  await page.getByRole('button', { name: 'Create Stack' }).click();
  await page.screenshot({ path: shot('02-workspace-empty') });

  for (const t of ['text', 'button', 'input', 'shape', 'line', 'image'])
    await page.getByRole('button', { name: `Add ${t}` }).click();
  await page
    .getByLabel('Image 1 properties')
    .locator('input[type=file]')
    .setInputFiles({ name: 'dot.png', mimeType: 'image/png', buffer: PNG });
  await page.screenshot({ path: shot('03-workspace-elements') });

  await page.getByRole('button', { name: 'Button 1 (button)' }).focus();
  await page.screenshot({ path: shot('04-inspector-button') });

  const panel = page.locator('.gs-beh-panel');
  await panel.getByRole('tab', { name: 'GhostScript' }).click();
  await page.screenshot({ path: shot('05-behavior-script') });
  await panel.getByRole('tab', { name: 'Blocks' }).click();
  await panel.getByRole('button', { name: 'Add behavior' }).click();
  await page.screenshot({ path: shot('06-behavior-blocks') });

  await page.getByRole('button', { name: 'Checkpoints' }).click();
  await page.screenshot({ path: shot('07-checkpoints') });

  await page.getByRole('radio', { name: 'Mobile' }).click();
  await page.screenshot({ path: shot('08-viewport-mobile') });
  await page.getByRole('radio', { name: 'Desktop' }).click();

  for (const theme of ['paper', 'midnight']) {
    await page.getByLabel('Theme').selectOption(theme);
    await page.screenshot({ path: shot(`09-theme-${theme}`) });
  }
  await page.getByLabel('Theme').selectOption('spectral');
  await page.getByRole('button', { name: 'Preview' }).click();
  await expect(page.getByLabel('Application preview')).toBeVisible();
  await page.screenshot({ path: shot('10-preview') });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: shot('11-preview-phone-window') });
  await page.goto('/#/library');
  await page.screenshot({ path: shot('12-library-phone-window') });
});
