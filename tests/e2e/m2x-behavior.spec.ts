import { expect, test } from '@playwright/test';

/** M2.7: an inventory built with the real editor (input, add, list shown, remove) runs in preview. */
test('inventory: input, add item, list shown through join, remove, in editor and preview', async ({
  page,
}) => {
  await page.goto('/#/library');
  await page.getByLabel('New Stack title').fill('Inventory');
  await page.getByRole('button', { name: 'Create Stack' }).click();

  const panel = page.locator('.gs-beh-panel');
  const props = (name: string) => page.getByLabel(`${name} properties`);

  // variables: a text draft and a list
  await panel.getByRole('tab', { name: 'Variables' }).click();
  await panel.getByLabel('New variable', { exact: true }).fill('draft');
  await panel.getByLabel('New variable type').selectOption('string');
  await panel.getByRole('button', { name: 'Add variable' }).click();
  await panel.getByLabel('New variable', { exact: true }).fill('items');
  await panel.getByLabel('New variable type').selectOption('list');
  await panel.getByRole('button', { name: 'Add variable' }).click();
  await expect(panel.getByLabel('items type')).toHaveValue('list');
  await panel.getByRole('button', { name: 'Add item to items' }).click();
  await panel.getByLabel('items item 0', { exact: true }).fill('starter');
  await panel.getByRole('button', { name: 'Remove items item 0' }).click();
  await expect(panel.getByText('Starts empty.')).toBeVisible();

  // elements
  await page.getByRole('button', { name: 'Add input' }).click();
  await props('Input 1').getByLabel('Save typed value in variable').selectOption('draft');
  await page.getByRole('button', { name: 'Add text' }).click();
  await props('Text 1').getByLabel('Text', { exact: true }).fill('Nothing yet');
  await page.getByRole('button', { name: 'Add button' }).click();
  await props('Button 1').getByLabel('Label').fill('Add item');

  // Button 1: add the typed value to the list, then show the list
  await expect(panel).toContainText('Behaviors for Button 1');
  await panel.getByRole('tab', { name: 'Blocks' }).click();
  await panel.getByRole('button', { name: 'Add behavior' }).click();
  await panel.getByLabel('Add action to Behavior 1').selectOption('listAdd');
  await panel.getByLabel('Behavior 1 action 1 value kind').selectOption('state');
  await panel.getByLabel('Behavior 1 action 1 value variable').selectOption('draft');
  await panel.getByLabel('Add action to Behavior 1').selectOption('setText');
  await panel.getByLabel('Behavior 1 action 2 element').selectOption({ label: 'Text 1' });
  await panel.getByLabel('Behavior 1 action 2 text kind').selectOption('listJoin');
  await panel.getByLabel('Behavior 1 action 2 text separator').selectOption({ label: 'new line' });
  await expect(
    panel.getByText(/When Button 1 is clicked, add draft to items, then set the text of "Text 1"/),
  ).toBeVisible();

  // collapsing keeps the sentence and hides the controls
  await panel.getByRole('button', { name: 'Collapse Behavior 1' }).click();
  await expect(panel.getByLabel('Add action to Behavior 1')).toBeHidden();
  await expect(panel.getByText(/When Button 1 is clicked/)).toBeVisible();
  await panel.getByRole('button', { name: 'Expand Behavior 1' }).click();
  await expect(panel.getByLabel('Add action to Behavior 1')).toBeVisible();

  // Button 2: remove the first item and show the list
  await page.getByRole('button', { name: 'Add button' }).click();
  await props('Button 2').getByLabel('Label').fill('Remove first');
  await expect(panel).toContainText('Behaviors for Button 2');
  await panel.getByRole('button', { name: 'Add behavior' }).click();
  await panel.getByLabel('Add action to Behavior 1').selectOption('listRemove');
  await panel.getByLabel('Add action to Behavior 1').selectOption('setText');
  await panel.getByLabel('Behavior 1 action 2 element').selectOption({ label: 'Text 1' });
  await panel.getByLabel('Behavior 1 action 2 text kind').selectOption('listJoin');
  await panel.getByLabel('Behavior 1 action 2 text separator').selectOption({ label: 'new line' });

  // the script shows names and list syntax, and reports a domain error on its own line
  await panel.getByRole('tab', { name: 'GhostScript' }).click();
  const editor = panel.locator('.cm-content');
  await expect(editor).toContainText('list remove items at 0');
  await expect(editor).toContainText('text "Text 1" = join(items,');
  await editor.click();
  await editor.press('Control+A');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText('behavior "x" on element.click {\n  list clear items\n  go "nowhere"\n}\n');
  await expect(panel.getByRole('alert', { name: 'Script problems' })).toContainText('Line 3');
  await editor.press('Control+A');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(
    'behavior "x" on element.click {\n  list remove items at 0\n  text "Text 1" = join(items, "\\n")\n  next card\n}\n',
  );
  await expect(panel.getByText('Script is valid and saved.')).toBeVisible();
  await panel.getByRole('tab', { name: 'Blocks' }).click();
  await expect(panel.getByText(/then go to the next card/)).toBeVisible();
  // drop the next card block again through the blocks editor
  await panel.getByRole('button', { name: 'Remove Behavior 1 action 3' }).click();

  // it survives a reload
  await page.reload();
  await page.getByRole('button', { name: 'Button 2 (button)' }).click();
  await panel.getByRole('tab', { name: 'GhostScript' }).click();
  await expect(panel.locator('.cm-content')).toContainText('list remove items at 0');

  // preview runs it
  await page.getByRole('button', { name: 'Preview' }).click();
  const host = page.getByLabel('Application preview');
  const typeIn = host.getByRole('textbox');
  await typeIn.fill('milk');
  await host.getByRole('button', { name: 'Add item' }).click();
  await expect(host.getByText('milk')).toBeVisible();
  await typeIn.fill('eggs');
  await host.getByRole('button', { name: 'Add item' }).click();
  await expect(host.getByText(/milk\s+eggs/)).toBeVisible();
  await host.getByRole('button', { name: 'Remove first' }).click();
  await expect(host.getByText('eggs')).toBeVisible();
  await expect(host.getByText('milk')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Runtime issues' })).toHaveCount(0);
});
