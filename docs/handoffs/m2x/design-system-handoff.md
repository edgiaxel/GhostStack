# HANDOFF: design-system (M2.1), branch feature/design-system, GS_PORT 5191

## 1. Files touched

- Tokens and base: `apps/web/src/themes/tokens.css` (v2), `base.css`, new `contrast.ts`, `tokens.test.ts`, `brand.test.ts`.
- Shell: `apps/web/src/app/AppShell.tsx` (mark, Design link, Accent select, `ToastProvider`), `theme.ts` (accents), `routes.tsx` (`/design` added).
- Kit (new): `apps/web/src/components/` (`Icon`, `Button`, `Field`, `Tabs`, `Menu`, `Dialog`, `Tooltip`, `Panel`, `Toast`, `EmptyState`, `Swatch`, `DesignGallery`, `kit.css`, `gallery.css`, `index.ts`, `kit.test.tsx`).
- Brand: `scripts/brand/generate.mjs` (+ `generate.d.mts`), output in `apps/web/public/brand/` (`mark.svg`, `wordmark.svg`, `favicon.svg`).
- Tests: `tests/e2e/m2x-design.spec.ts`, `tests/e2e/audit-themes.spec.ts` (now theme x accent, adds border, accent and status pairs).
- Spec: `.kiro/specs/m2-1-design-foundations/` (requirements, design, tasks).

## 2. Exported entry points (`apps/web/src/components/index.ts`, which also imports `kit.css`)

- `Button {variant: default|primary|danger|ghost, icon?, loading?}`; `IconButton {icon, label (required)}`.
- `Field {label, value, onChange(string), hint?, error?}`; `NumberField {label, value, onChange(number), min?, max?, step?, unit?, hint?, error?, disabled?}` (keeps the draft, commits only valid in-range numbers); `Select {label, value, options[{value,label,disabled?}], onChange}`.
- `Tabs {tabs[{id,label,panel,disabled?}], label, value?, defaultValue?, onChange?}`; `Menu {label, items[{id,label,onSelect,icon?,disabled?,danger?}]}`; `Dialog {open, title, onClose, actions?}` (native `<dialog>`); `Tooltip {text, children: one element}`.
- `Panel {title, actions?}`; `Toolbar {label}`; `ToastProvider {duration?}` and `useToast().push({kind?, message})` (mounted in `AppShell`; errors persist); `EmptyState {title, tone: empty|error, action?}`; `Swatch {color, label, selected?, onSelect?}`; `Kbd`; `Icon {name, size?}` and `ICON_NAMES` (19 icons).
- `app/theme.ts`: `ACCENTS` (violet, ember, azure, jade, rose), `AccentId`, `loadAccent`, `applyAccent` (`localStorage` key `gs.accent`, `data-accent` on `<html>`; `default` removes it).
- Tokens added: `--gs-border-strong`, `--gs-success|warning|info`, `--gs-focus`, `--gs-space-1..6`, `--gs-text-xs..2xl`, `--gs-radius-sm|lg`, `--gs-motion*`, `--gs-ease`, `--gs-shadow`. Existing names kept. `.gs-btn` and `.gs-input` borders now use `--gs-border-strong` (closes U5).
- Route `#/design`: every component in every state.

## 3. Requests for the orchestrator

- `apps/web/index.html`: add `<link rel="icon" href="/brand/favicon.svg" type="image/svg+xml" />`. The page still requests `/favicon.ico` and gets a 404 (central file, not changed).
- Font loading (rest of U16): `Inter` is still not bundled. It needs a dependency (for example `@fontsource-variable/inter`). The type scale tokens are in; no font was added.
- `packages/behavior/src/lists.test.ts` (lines 120 and 135, owned by behavior-lists) fails `tsc` as inherited from `main`, so `npm run typecheck` exits 2 at the root. The web package typechecks clean.
- No `package.json`, lockfile or config change needed.

## 4. Caveats and known gaps

- Favicon is SVG only. The wordmark SVG uses a `<text>` element, so it depends on the system font.
- Feature folders do not use the kit yet (by brief). They still use `gs-btn` and `gs-input`, which now have stronger borders.
- Contrast is computed for text, control borders, focus and accent against `bg`, `panel` and `panel-2` for every theme and accent pair, in a unit test and again in the browser spec.
- `Dialog` focus trap relies on the native `<dialog>`; checked in Edge only. jsdom has no `showModal`, so the component falls back to the `open` attribute there.
- At 640px and below the top bar hides the Design link, and the Theme and Accent labels become visually hidden text, to avoid horizontal overflow at 390px.
- `tokens.test.ts` builds the `node:fs` specifier at runtime because the web tsconfig has no Node types and Vitest strips imported CSS.
- Theme and accent in `AppShell` are native selects, not kit `Select` (the top bar needs inline labels).
- A saved accent is applied in an effect on first render, so it can show the theme accent for one frame (`main.tsx` is central).

## 5. What the next wave needs

- Adopt the kit as each worktree takes its folder (shell, inspector, library, canvas-craft). Use `NumberField` and `Field` in the inspector and `useToast` for save and import messages.
- Orchestrator: merge before wave 2, add the favicon link, decide on a bundled font.
- After editing the brand generator, run `node scripts/brand/generate.mjs`. `brand.test.ts` fails if the committed files drift.

## 6. Commands run (in the worktree)

- `npm run typecheck`: web, domain, player, project-format, shared-contracts and storage pass. `@ghoststack/behavior` fails on the inherited `lists.test.ts` errors (exit 2).
- `npm run lint`: pass. `npm run format:check`: pass.
- `npm test`: 28 files, 233 tests pass; `npx vitest run apps/web/src/themes apps/web/src/components`: 45 pass. In one combined `vitest run apps/web` the `features/history/session.test.ts` recovery tests timed out at 5s under load; they passed in the full `npm test`.
- `npm run build`: pass (850 kB bundle, chunk size warning as before).
- `npm run dev -w @ghoststack/web -- --port 5191` as dev server; `GS_PORT=5191 npx playwright test`: 50 passed, 1 skipped (final full run). `m2x-design.spec.ts` 5 pass, `audit-themes.spec.ts` 18 pass. Earlier full runs showed `audit-flows.spec.ts` overflow at 390px (fixed by the compact top bar) and two tests that passed on rerun.
- `playwright-cli -s=ds open ... --browser=msedge` (Chrome is not installed): opened `#/design`, chose accent rose (`data-accent=rose`, `gs.accent=rose`, mark image loaded), opened the dialog (focus inside it), closed it with Escape. Only console error: `/favicon.ico` 404.
- `node scripts/brand/generate.mjs`: wrote the three SVGs.
