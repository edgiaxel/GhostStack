/* eslint-disable @typescript-eslint/no-explicit-any */
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { unzipSync } from 'fflate';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function create(page: Page, title: string): Promise<void> {
  await page.goto('/#/library');
  await page.getByLabel('New Stack title').fill(title);
  await page.getByRole('button', { name: 'Create Stack' }).click();
  await expect(page.getByRole('navigation', { name: 'Cards' })).toContainText('Cards (1)');
}
const saved = (page: Page) => expect(page.getByRole('status').filter({ hasText: /^Saved/ })).toBeVisible();
const readStack = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<any>((resolve, reject) => {
        const open = indexedDB.open('ghoststack');
        open.onsuccess = () => {
          const db = open.result;
          const r = db.transaction('stacks').objectStore('stacks').getAll();
          r.onsuccess = () => {
            db.close();
            resolve(r.result[0]);
          };
          r.onerror = () => reject(r.error);
        };
        open.onerror = () => reject(open.error);
      }),
  );
const writeStack = (page: Page, stack: unknown) =>
  page.evaluate(
    (s) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('ghoststack');
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('stacks', 'readwrite');
          tx.objectStore('stacks').put(s);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    stack,
  );
const clearAssetBytes = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const open = indexedDB.open('ghoststack');
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('assets', 'readwrite');
          tx.objectStore('assets').clear();
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
        };
      }),
  );

test.describe('library', () => {
  test('rejects an empty title, then creates, renames and deletes with confirmation', async ({ page }) => {
    await page.goto('/#/library');
    await page.getByRole('button', { name: 'Create Stack' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await page.getByLabel('New Stack title').fill('Alpha');
    await page.getByRole('button', { name: 'Create Stack' }).click();
    await page.getByRole('link', { name: 'Library' }).click();
    await expect(page.getByRole('list', { name: 'Stacks' })).toContainText('Alpha');
    await page.getByRole('button', { name: 'Rename Alpha' }).click();
    await page.getByLabel('Rename Alpha').fill('Beta');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('list', { name: 'Stacks' })).toContainText('Beta');
    await page.getByRole('button', { name: 'Delete Beta' }).click();
    await page.getByRole('button', { name: /confirm/i }).click();
    await expect(page.getByText(/No Stacks yet/)).toBeVisible();
  });

  test('document has a title and the stack survives a reload of the library', async ({ page }) => {
    await create(page, 'Persist');
    await page.goto('/#/library');
    await page.reload();
    await expect(page.getByRole('list', { name: 'Stacks' })).toContainText('Persist');
    await expect(page).toHaveTitle(/GhostStack/);
  });
});

test.describe('cards', () => {
  test('the last card cannot be deleted and the reason is shown', async ({ page }) => {
    await create(page, 'Single');
    await page.getByRole('button', { name: /^Delete Card 1/ }).click();
    await page.getByRole('button', { name: 'Confirm delete' }).click();
    await expect(page.getByRole('alert')).toContainText(/last card/i);
    await expect(page.getByRole('navigation', { name: 'Cards' })).toContainText('Cards (1)');
  });

  test('deleting a referenced card warns, removes the navigate action, and undo restores both', async ({
    page,
  }) => {
    await create(page, 'Refs');
    const nav = page.getByRole('navigation', { name: 'Cards' });
    await nav.getByRole('button', { name: 'Add card' }).click();
    await expect(nav).toContainText('Cards (2)');
    await nav
      .getByRole('button', { name: /^Card 1/ })
      .first()
      .click();
    await page.getByRole('button', { name: 'Add button' }).click();
    await saved(page);
    const stack = await readStack(page);
    const [c1, c2] = stack.cardOrder as string[];
    const b = stack.cards[c1!].elements[0];
    b.behaviors = [
      {
        behaviorId: 'go',
        trigger: 'element.click',
        conditions: [],
        actions: [{ type: 'navigate', cardId: c2 }],
        enabled: true,
      },
    ];
    await writeStack(page, stack);
    await page.reload();
    await nav.getByRole('button', { name: /^Delete Card 2/ }).click();
    await expect(page.getByRole('alertdialog')).toContainText('1 behavior(s) navigate to it');
    await page.getByRole('button', { name: 'Confirm delete' }).click();
    await expect(nav).toContainText('Cards (1)');
    await saved(page);
    expect((await readStack(page)).cards[c1!].elements[0].behaviors[0].actions).toEqual([]);
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(nav).toContainText('Cards (2)');
    await saved(page);
    expect((await readStack(page)).cards[c1!].elements[0].behaviors[0].actions).toHaveLength(1);
  });

  test('deleting the entry card promotes another card and reorder persists', async ({ page }) => {
    await create(page, 'Entry');
    const nav = page.getByRole('navigation', { name: 'Cards' });
    await nav.getByRole('button', { name: 'Add card' }).click();
    await expect(nav).toContainText('Cards (2)');
    await nav.getByRole('button', { name: 'Move Card 2 up' }).click();
    await expect(nav.getByRole('listitem').first()).toContainText('Card 2');
    await page.reload();
    await expect(nav.getByRole('listitem').first()).toContainText('Card 2');
    await nav.getByRole('button', { name: /^Delete Card 1/ }).click();
    await page.getByRole('button', { name: 'Confirm delete' }).click();
    await expect(nav.getByRole('listitem').first()).toContainText('(entry)');
  });

  test('an unknown card id in the URL falls back to the entry card', async ({ page }) => {
    await create(page, 'Fallback');
    const stackId = (await readStack(page)).stackId as string;
    await page.goto(`/#/stack/${stackId}/card/does-not-exist`);
    await expect(page.getByRole('navigation', { name: 'Cards' })).toContainText('Card 1');
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
});

test.describe('elements', () => {
  test('one drag is one undo step', async ({ page }) => {
    await create(page, 'Drag');
    await page.getByRole('button', { name: 'Add shape' }).click();
    await page.getByLabel('Shape 1 properties').getByRole('tab', { name: 'Layout' }).click();
    const x = page.getByLabel('Shape 1 properties').getByLabel('X', { exact: true });
    const start = Number(await x.inputValue());
    const shape = page.getByRole('button', { name: 'Shape 1 (shape)' });
    const box = (await shape.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 60, { steps: 12 });
    await page.mouse.up();
    await expect.poll(async () => Number(await x.inputValue())).toBeGreaterThan(start + 50);
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect.poll(async () => Number(await x.inputValue())).toBe(start);
  });

  test('keyboard only: Tab reaches an element, arrows move it, Escape deselects', async ({ page }) => {
    await create(page, 'Keys');
    await page.getByRole('button', { name: 'Add text' }).click();
    await page.getByTestId('card-stage').click({ position: { x: 200, y: 200 } });
    await page.getByRole('radio', { name: 'Mobile' }).focus();
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab');
      if (
        ((await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))) ?? '').includes(
          '(text)',
        )
      )
        break;
    }
    expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))).toContain(
      'Text 1 (text)',
    );
    await page.getByRole('radio', { name: 'Desktop' }).click();
    await page.getByLabel('Text 1 properties').getByRole('tab', { name: 'Layout' }).click();
    await page.getByRole('button', { name: 'Text 1 (text)' }).focus();
    const x = page.getByLabel('Text 1 properties').getByLabel('X', { exact: true });
    const before = Number(await x.inputValue());
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => Number(await x.inputValue())).toBe(before + 1);
    await page.keyboard.press('Escape');
    await expect(page.getByLabel('Text 1 properties')).toHaveCount(0);
  });

  test('image upload rejects the wrong type and oversize files with a message', async ({ page }) => {
    await create(page, 'Images');
    await page.getByRole('button', { name: 'Add image' }).click();
    const file = page.getByLabel('Image 1 properties').locator('input[type=file]');
    await file.setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') });
    await expect(page.getByRole('alert').filter({ hasText: 'PNG, JPEG, GIF or WebP' })).toBeVisible();
    await file.setInputFiles({
      name: 'big.png',
      mimeType: 'image/png',
      buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
    });
    await expect(page.getByRole('alert').filter({ hasText: '5 MB' })).toBeVisible();
    await expect(page.getByTestId('card-stage').locator('img')).toHaveCount(0);
  });

  test('a missing image file shows a fallback, a warning, a blocked .gsp export and a working web export', async ({
    page,
  }) => {
    await create(page, 'Missing');
    await page.getByRole('button', { name: 'Add image' }).click();
    await page
      .getByLabel('Image 1 properties')
      .locator('input[type=file]')
      .setInputFiles({ name: 'dot.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.getByTestId('card-stage').locator('img')).toBeVisible();
    await saved(page);
    await clearAssetBytes(page);
    await page.reload();
    await expect(page.getByTestId('card-stage').getByText(/Image file missing/)).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'image file(s) missing' })).toBeVisible();
    await page.getByRole('button', { name: 'Export .gsp' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'missing' })).toBeVisible();
    await page.getByRole('button', { name: 'Preview' }).click();
    await expect(page.locator('[data-gs-fallback]')).toBeVisible();
    await page.getByRole('link', { name: 'Back to editor' }).click();
    const zip = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export web app' }).click();
    await zip;
    await expect(page.getByRole('status').filter({ hasText: 'placeholder' })).toBeVisible();
  });
});

test.describe('behavior', () => {
  test('script errors are reported with a line and nothing invalid is saved', async ({ page }) => {
    await create(page, 'Script');
    const panel = page.locator('.gs-beh-panel');
    await panel.getByRole('tab', { name: 'GhostScript' }).click();
    await panel.locator('.cm-content').click();
    await page.keyboard.insertText('behavior "a" on card.enter {\n  go\n}\n');
    await expect(panel.getByRole('alert', { name: 'Script problems' })).toContainText('Line 3');
    expect((await readStack(page)).cards[Object.keys((await readStack(page)).cards)[0]!].behaviors).toEqual(
      [],
    );
  });

  test('a runtime error is shown in preview and does not break the app', async ({ page }) => {
    await create(page, 'Runtime');
    const panel = page.locator('.gs-beh-panel');
    await panel.getByRole('tab', { name: 'Variables' }).click();
    await panel.getByLabel('New variable', { exact: true }).fill('n');
    await panel.getByRole('button', { name: 'Add variable' }).click();
    await panel.getByRole('tab', { name: 'GhostScript' }).click();
    await panel.locator('.cm-content').click();
    await page.keyboard.insertText('behavior "boom" on card.enter {\n  set n = 1 / 0\n}\n');
    await expect(panel.getByText('Script is valid and saved.')).toBeVisible();
    await page.getByRole('button', { name: 'Add text' }).click();
    await saved(page);
    await page.getByRole('button', { name: 'Preview' }).click();
    await expect(page.getByRole('region', { name: 'Runtime issues' })).toContainText('Division by zero');
    await expect(page.getByLabel('Application preview').getByText('Text')).toBeVisible();
  });

  test('an input bound to a variable drives text in preview', async ({ page }) => {
    await create(page, 'Echo');
    const panel = page.locator('.gs-beh-panel');
    await panel.getByRole('tab', { name: 'Variables' }).click();
    await panel.getByLabel('New variable', { exact: true }).fill('who');
    await panel.getByLabel('New variable type').selectOption('string');
    await panel.getByRole('button', { name: 'Add variable' }).click();
    await page.getByRole('button', { name: 'Add text' }).click();
    await page.getByRole('button', { name: 'Add input' }).click();
    await page
      .getByLabel('Input 1 properties')
      .getByLabel('Save typed value in variable')
      .selectOption('who');
    await panel.getByRole('tab', { name: 'GhostScript' }).click();
    await panel.locator('summary').click();
    const textId = JSON.parse(
      await panel.locator('li', { hasText: 'Text 1 (text)' }).locator('code').innerText(),
    ) as string;
    await panel.getByRole('tab', { name: 'Blocks' }).click();
    await panel.getByRole('button', { name: 'Add behavior' }).click();
    await panel.getByLabel('Behavior 1 trigger').selectOption('element.change');
    await panel.getByLabel('Add action to Behavior 1').selectOption('setText');
    await panel.getByLabel('Behavior 1 action 1 element').selectOption(textId);
    await panel.getByLabel('Behavior 1 action 1 text kind').selectOption('state');
    await panel.getByLabel('Behavior 1 action 1 text variable').selectOption('who');
    await saved(page);
    await page.getByRole('button', { name: 'Preview' }).click();
    const host = page.getByLabel('Application preview');
    await host.getByRole('textbox').fill('Ada');
    await expect(host.getByText('Ada', { exact: true })).toBeVisible();
  });
});

test.describe('recovery and persistence', () => {
  test('a newer recovery checkpoint is applied on open and announced', async ({ page }) => {
    // A real tab crash cannot be simulated here: closing a tab flushes the save on visibilitychange.
    // So the interrupted-session state (a recovery checkpoint newer than the saved Stack) is written
    // into the real IndexedDB, exactly as the session writes it after every edit.
    await create(page, 'Crash');
    await saved(page);
    const stack = await readStack(page);
    const newer = {
      ...stack,
      updatedAt: new Date(Date.now() + 60_000).toISOString(),
      cards: {
        ...stack.cards,
        [stack.entryCardId]: {
          ...stack.cards[stack.entryCardId],
          elements: [
            {
              elementId: 'shape-rec',
              type: 'shape',
              name: 'Shape 1',
              properties: { shape: 'rect' },
              layout: { x: 5, y: 5, width: 50, height: 50, zIndex: 0 },
              behaviors: [],
            },
          ],
        },
      },
    };
    await page.evaluate(
      ({ cp }) =>
        new Promise<void>((resolve) => {
          const open = indexedDB.open('ghoststack');
          open.onsuccess = () => {
            const db = open.result;
            const tx = db.transaction('checkpoints', 'readwrite');
            tx.objectStore('checkpoints').put(cp);
            tx.oncomplete = () => {
              db.close();
              resolve();
            };
          };
        }),
      {
        cp: {
          checkpointId: `recovery:${stack.stackId}`,
          stackId: stack.stackId,
          label: 'Recovery',
          kind: 'recovery',
          createdAt: newer.updatedAt,
          stack: newer,
        },
      },
    );
    await page.reload();
    await expect(page.getByRole('button', { name: 'Shape 1 (shape)' })).toBeVisible();
    await expect(page.getByText('Restored unsaved changes')).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Shape 1 (shape)' })).toBeVisible();
    await expect(page.getByText('Restored unsaved changes')).toHaveCount(0);
  });
  test('theme choice persists across reload for every theme', async ({ page }) => {
    await page.goto('/#/library');
    for (const theme of ['paper', 'midnight', 'spectral']) {
      await page.getByLabel('Theme').selectOption(theme);
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    }
  });
});

test.describe('exports', () => {
  test('web export of an empty stack still opens and runs from file://', async ({ page, browser }) => {
    await create(page, 'Blank');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export web app' }).click();
    const files = unzipSync(readFileSync((await (await download).path())!));
    const dir = mkdtempSync(join(tmpdir(), 'gs-blank-'));
    for (const [name, data] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, name)), { recursive: true });
      writeFileSync(join(dir, name), data);
    }
    const app = await browser.newPage();
    const errors: string[] = [];
    app.on('pageerror', (e) => errors.push(e.message));
    await app.goto(pathToFileURL(join(dir, 'index.html')).href);
    await expect(app.locator('[data-gs-stage]')).toBeVisible();
    expect(errors).toEqual([]);
    await app.close();
  });
});

test.describe('quality gates', () => {
  test('no console errors, page errors or failed requests during a normal session', async ({ page }) => {
    const problems: string[] = [];
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`));
    page.on('response', (r) => r.status() >= 400 && problems.push(`http ${r.status()}: ${r.url()}`));
    await create(page, 'Clean');
    for (const t of ['text', 'button', 'input', 'shape', 'line'])
      await page.getByRole('button', { name: `Add ${t}` }).click();
    await page.getByRole('button', { name: 'Checkpoints' }).click();
    await page.getByRole('button', { name: 'Preview' }).click();
    await page.getByRole('link', { name: 'Back to editor' }).click();
    await page.getByRole('link', { name: 'Library' }).click();
    expect(problems).toEqual([]);
  });

  for (const width of [390, 768, 1024]) {
    test(`no horizontal page overflow at ${width}px in library, workspace and preview`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await create(page, 'Narrow');
      await page.getByRole('button', { name: 'Add text' }).click();
      const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect.soft(await overflow(), 'workspace').toBeLessThanOrEqual(0);
      const inspectorClipped = await page.evaluate(() => {
        const panel = document.querySelector('.gs-area-inspector') as HTMLElement | null;
        if (!panel) return 0;
        return Array.from(panel.querySelectorAll('input,select,button')).filter(
          (n) => n.getBoundingClientRect().right > panel.getBoundingClientRect().right + 1,
        ).length;
      });
      expect.soft(inspectorClipped, 'inspector controls clipped by the panel edge').toBe(0);
      await page.getByRole('button', { name: 'Preview' }).click();
      expect.soft(await overflow(), 'preview').toBeLessThanOrEqual(0);
      await page.goto('/#/library');
      expect.soft(await overflow(), 'library').toBeLessThanOrEqual(0);
    });
  }
});
