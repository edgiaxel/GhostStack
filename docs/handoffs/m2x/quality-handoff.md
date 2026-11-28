# HANDOFF: quality (M2.8 part 1), branch `feature/quality`, port 5194

## 1. Files touched

- `.github/workflows/ci.yml` (new)
- `packages/domain/src/validate.ts` (safe-id checks only)
- `packages/domain/src/safe-ids.test.ts` (new, property tests)
- `tests/e2e/m2x-a11y.spec.ts` (new)
- `.kiro/specs/m2-8-quality/{requirements,design,tasks}.md` (new)
- `playwright.config.ts`: NOT changed (see section 3).

## 2. Exported entry points

None added. `validateStack` now rejects unsafe ids: card, element, asset, behavior ids must match `[A-Za-z0-9_-]{1,128}` and must not be an `Object.prototype` member (`toString`, `constructor`, `__proto__`). Message: `Unsafe <kind> id "<id>": ...`.

## 3. Contract changes requested

- `playwright.config.ts` is in my brief but the write permission rule denied the edit, so I did not bypass it. Orchestrator: replace it with this (Chromium default, `GS_BROWSERS=chromium,firefox,webkit`, `GS_NO_WEBSERVER=1`):

```ts
import { defineConfig, devices } from '@playwright/test';
const port = Number(process.env.GS_PORT ?? 5173);
const baseURL = `http://127.0.0.1:${port}`;
const known = {
  chromium: devices['Desktop Chrome'],
  firefox: devices['Desktop Firefox'],
  webkit: devices['Desktop Safari'],
} as const;
type BrowserName = keyof typeof known;
const requested = (process.env.GS_BROWSERS ?? 'chromium')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter((s): s is BrowserName => s in known);
const browsers: BrowserName[] = requested.length > 0 ? requested : ['chromium'];
const externalServer = process.env.GS_NO_WEBSERVER === '1';
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: { baseURL, trace: 'retain-on-failure' },
  projects: browsers.map((name) => ({ name, use: { ...known[name] } })),
  ...(externalServer
    ? {}
    : { webServer: { command: 'npm run dev', url: baseURL, reuseExistingServer: true, timeout: 60_000 } }),
});
```

CI works without it: it starts the dev server itself and Playwright reuses it (`reuseExistingServer: true`). `GS_NO_WEBSERVER` in `ci.yml` is harmless until the config is replaced. Firefox/WebKit browsers must be installed separately (`npx playwright install firefox webkit`).

- No dependency, schema or command changes.

## 4. Caveats and known gaps

- Reserved-name ids: `importGsp` reports `Duplicate card toString in manifest` for a card id named `toString` (plain-object `in` lookup in `packages/project-format`). Found by the property test. I closed it at the domain boundary by rejecting prototype names; the importer bug is still there for hand-built archives. Owner: preview-export/responsive (`project-format`).
- Existing stored Stacks with ids outside the safe set (none made by the UI, which uses UUIDs) will now fail validation on load.
- `ci.yml` is not run anywhere yet (not pushed). Its commands were run locally one by one; the workflow itself is unverified. `npx playwright install --with-deps chromium` and the curl poll are untested on a runner.
- `packages/domain/src/safe-ids.test.ts` imports `@ghoststack/project-format` (test only; domain src does not).
- Design gallery scan is skipped (annotated) because `/design` does not exist on this branch. It runs automatically once design-system merges and an h1/h2/h3 matching "design" or "components" exists. Check the heading text then.
- Firefox/WebKit runs: not run (config change not applied).
- The history test `HistoryControls ... restores it after confirmation` failed once in a full `npm test` run while the dev server and Playwright were busy, then passed in 4 reruns and in a clean full run (191 tests). Likely timing flake; owner: history.

### Remaining a11y violations (axe, WCAG 2 A/AA, serious or critical)

Allowlisted in `KNOWN` in the spec so the scan still fails on anything new. Delete the entry when fixed.

| Screen                                                                                                                                                                       | Rule                                    | Node                                                 | Owner / fix                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Workspace (every state with an element on the card: inspector, behavior blocks, script, checkpoints)                                                                         | `label-content-name-mismatch` (serious) | `div[aria-label="Button 1 (button)"]` canvas element | card-editor: the accessible name must contain the visible text (for example `Next, Button 1 (button)`) |
| Library (empty and with a Stack), workspace with empty card, preview                                                                                                         | none serious or critical                |                                                      |                                                                                                        |
| Design gallery                                                                                                                                                               | not scanned                             |                                                      | pending merge                                                                                          |
| Minor and moderate findings are attached to the test report as `axe-minor-*` (none were found in the runs I made; use `GS_A11Y_VERBOSE=1` to print all findings per screen). |
| Not covered by axe: color contrast in non-default themes (Paper, Midnight), keyboard order, canvas keyboard move.                                                            |

## 5. What the next step needs

- Apply the config in section 3, then run `GS_BROWSERS=chromium,firefox,webkit npm run test:e2e` once browsers are installed.
- card-editor owner fixes the label mismatch and empties `KNOWN`.
- After design-system merges, confirm the `/design` scan runs (not skipped) and add themes/accents to the scan.
- Code splitting is wave 3 (not done).
- Pre-existing, not mine: `npm run typecheck` fails in `packages/behavior/src/lists.test.ts` (lines 120 and 135, fast-check generic types). Owner: behavior-lists.

## 6. Commands run and results

- `npx vitest run packages/domain`: 32 passed (after fixing my fixture and the reserved-name finding).
- `npm run lint`: pass. `npm run format:check`: pass. `npm run build`: pass.
- `npm run typecheck`: FAIL, only in `packages/behavior/src/lists.test.ts` (pre-existing, not my files). `npx tsc -p packages/domain/tsconfig.json`: pass.
- `npm test`: first run 190/191 (history flake above); second run 191/191 pass.
- Dev server started by me: `$env:GS_PORT='5194'; npm run dev` (background). `$env:GS_PORT='5194'; npx playwright test tests/e2e/m2x-a11y.spec.ts`: 1 passed, 1 skipped (design route absent).
- Not run: full e2e suite, `playwright-cli` click-through (the axe spec drove the real UI for library, workspace, behavior, checkpoints and preview), Firefox/WebKit, the CI workflow.
