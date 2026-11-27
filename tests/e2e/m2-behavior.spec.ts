import { expect, test } from '@playwright/test';

test('card behaviors: blocks and GhostScript edit the same AST and persist', async ({ page }) => {
  await page.goto('/#/library');
  await page.getByLabel('New Stack title').fill('Behavior Demo');
  await page.getByRole('button', { name: 'Create Stack' }).click();
  await expect(page.getByRole('navigation', { name: 'Cards' })).toContainText('Cards (1)');
  await page.getByRole('navigation', { name: 'Cards' }).getByRole('button', { name: 'Add card' }).click();
  await expect(page.getByRole('navigation', { name: 'Cards' })).toContainText('Cards (2)');
  await page.getByRole('navigation', { name: 'Cards' }).first().click();

  const panel = page.locator('.gs-beh-panel');
  await panel.getByRole('tab', { name: 'Variables' }).click();
  await panel.getByLabel('New variable', { exact: true }).fill('score');
  await panel.getByRole('button', { name: 'Add variable' }).click();
  await expect(panel.getByLabel('score type')).toBeVisible();

  await panel.getByRole('tab', { name: 'Blocks' }).click();
  await panel.getByRole('button', { name: 'Add behavior' }).click();
  await panel.getByLabel('Add action to Behavior 1').selectOption('setState');
  await panel.getByLabel('Behavior 1 action 1 value kind').selectOption('literal');
  await panel.getByLabel('Behavior 1 action 1 value type').selectOption('number');
  await panel.getByLabel('Behavior 1 action 1 value', { exact: true }).fill('3');

  await panel.getByRole('tab', { name: 'GhostScript' }).click();
  const editor = panel.locator('.cm-content');
  await expect(editor).toContainText('behavior');
  await expect(editor).toContainText('set score = 3');
  await expect(panel.getByText('Script is valid and saved.')).toBeVisible();

  await editor.click();
  await editor.press('Control+A');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText('behavior "x" on card.enter {\n  set score = 7\n}\n');
  await expect(panel.getByText('Script is valid and saved.')).toBeVisible();

  await editor.press('Control+A');

  await page.keyboard.press('Delete');
  await page.keyboard.insertText('behavior "x" on card.enter {\n  go "nope"\n}\n');
  await expect(panel.getByRole('alert', { name: 'Script problems' })).toContainText('unknown card');

  await editor.press('Control+A');

  await page.keyboard.press('Delete');
  await page.keyboard.insertText('behavior "x" on card.enter {\n  set score = 7\n}\n');
  await expect(panel.getByText('Script is valid and saved.')).toBeVisible();

  await panel.getByRole('tab', { name: 'Blocks' }).click();
  await expect(panel.getByLabel('Behavior 1 action 1 value', { exact: true })).toHaveValue('7');

  await page.reload();
  await expect(
    page.locator('.gs-beh-panel').getByLabel('Behavior 1 action 1 value', { exact: true }),
  ).toHaveValue('7');
});
