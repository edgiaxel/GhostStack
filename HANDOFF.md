# HANDOFF: M2.1 to M2.8 (2026-11-27)

## Completed (all merged on `main`)

- **M2.1 Design:** tokens v2, five accent presets (`data-accent`, `gs.accent`), generated brand (`scripts/brand`), component kit `apps/web/src/components`, gallery `#/design`.
- **M2.2 Shell:** menu bar, tool rail, status bar, resizable panels (`gs.layout.*`), console drawer, zoom 25 to 400 percent, shortcut sheet.
- **M2.3 Inspector:** tabs Content, Layout, Appearance, Behavior; anchor picker; card background and frame size; multi-selection ready.
- **M2.4 Library:** thumbnails grid, search, sort, duplicate, export; templates (Blank, Quiz, Recipe, Inventory, Guide) in `features/templates`; navigator thumbnails and drag reorder.
- **M2.5 Canvas:** multi-select, clipboard, align, distribute, snap, in-place edit, asset manager, exports drop orphan assets. Layer panel not built.
- **M2.6 Responsive:** `DEFAULT_ELEMENT_PLACEMENT` (scale), Fit preview, `Card.background`, text newlines.
- **M2.7 Lists:** `list` state, `listAdd/Remove/Set/Clear`, `listLength/Item/Join`, `nextCard/prevCard`, GhostScript names and error lines, sentence blocks.
- **M2.8 (partial):** `.github/workflows/ci.yml`, axe scan (no serious or critical), safe-id validation, lazy `ScriptEditor` and routes, `npm run bundle:check`, Playwright browser projects through `GS_BROWSERS`.

## Verified on `main` (commands run 2026-11-27)

`npm run typecheck`, `lint`, `format:check` pass. `npm test`: 348 passed. `npm run build` passes, `npm run bundle:check` passes (entry 285 kB, player 107 kB). `npx playwright test` against a dev server I started: 70 passed, 2 skipped (`audit-screens` without `AUDIT_SHOTS`, one pre-existing skip).

## Contracts (read before M3)

- `docs/UI_CONTRACT.md` sections 1 to 8, briefs in `docs/handoffs/m2x/`, one handoff per worktree there.
- New commands: `SET_CARD_BACKGROUND`, `SET_VIEWPORT`, `REMOVE_ASSET`, `REPLACE_ASSET`. Ids must match `[A-Za-z0-9_-]{1,128}`.
- Data stores unchanged: IndexedDB `ghoststack` v2. No server, no env vars except `GS_PORT`, `GS_BROWSERS`, `GS_NO_WEBSERVER`.

## Gaps and caveats

- CI workflow was never run on a GitHub runner. Firefox and WebKit e2e were not run.
- `Inter` is not bundled (needs a dependency, owner approval).
- `importGsp` rejects a card id like `toString` with a duplicate error. Domain now blocks such ids, hand-built archives still hit it.
- Duplicate and paste do not copy behaviors. Deleting an asset cannot be undone for its bytes.
- Recipe and Inventory `.gsp` fixtures from the M2.7 brief are templates, not committed fixture files.
- `CardNavigator` lacks an `onReorder(order)` prop; reorder uses repeated single moves.
- Playwright-managed dev server dropped before; start the server yourself (`GS_PORT`) and run `npm run build` first for the web-export specs.

## Next (M3)

1. Validate the provider adapter and MCP bridge transport (T-013).
2. AI plan schema, approval UI, transactional apply with `applyCommand` and `StackSession.restore`, checkpoint rollback.
3. Run the CI workflow on GitHub and fix what it finds.
