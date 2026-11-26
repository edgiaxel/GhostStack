# M2.x worktree briefs

Shared rules for every M2.1 to M2.8 worktree. `docs/UI_CONTRACT.md` is binding (sections 1 to 4 and 8). `docs/handoffs/m2/README.md` "Non-negotiable" applies unchanged. If a brief and the contract disagree, the contract wins and you say so in `HANDOFF.md`. Findings U1 to U18 are in `docs/AUDIT-M2.md`. Chunk text is in `docs/MILESTONE.md` section 3 (M2.x).

## Locked on `main` before any worktree (do not redo, do not change)

- Lists: state type `list` (`initial` is an array of scalars); expressions `listLength`, `listItem`, `listJoin`; actions `nextCard`, `prevCard`, `listAdd`, `listRemove`, `listSet`, `listClear`. Domain validation and the runtime are done and tested (`packages/behavior/src/lists.test.ts`). The GhostScript printer is done. The parser, block editor and state editor are not.
- GhostScript syntax for lists (locked, the parser must accept exactly what the printer writes): `next card`, `previous card`, `list add KEY = expr`, `list remove KEY at expr`, `list set KEY at expr = expr`, `list clear KEY`; expressions `length(KEY)`, `item(KEY, expr)`, `join(KEY, "sep")`.
- Show a list on a card: `setText` with a `listJoin` expression (separator `"\n"`). Text elements must render newlines (`white-space: pre-wrap`).
- `Card.background` (optional hex) with command `SET_CARD_BACKGROUND { cardId, background | null }`.
- `SET_VIEWPORT { width, height }` (120 to 8000), `REMOVE_ASSET { assetId }` (rejected while an element uses it), `REPLACE_ASSET { asset }` (same id, new metadata).
- `DEFAULT_ELEMENT_PLACEMENT` (`{ anchor: 'top-left', scaleMode: 'scale' }`) in `shared-contracts`: new elements use it. Existing Stacks are not migrated.
- Dev dependency `@axe-core/playwright` is installed on `main`.

## Worktrees

Branch `feature/<name>`, folder `.worktrees/<name>`, `npm ci` inside it, own port with `GS_PORT`.

| Wave | Worktree | Port | Owns (exclusive) |
|---|---|---|---|
| 1 | `design-system` (M2.1) | 5191 | `apps/web/src/themes/**`, `apps/web/src/components/**` (new kit), `apps/web/src/app/AppShell.tsx`, `apps/web/src/app/theme.ts`, a gallery route in `apps/web/src/app/routes.tsx` (add only), `scripts/brand/**`, `apps/web/public/brand/**`, `tests/e2e/m2x-design.spec.ts`, `tests/e2e/audit-themes.spec.ts` |
| 1 | `behavior-lists` (M2.7) | 5192 | `packages/behavior/**`, `apps/web/src/features/behavior-editor/**`, `tests/e2e/m2x-behavior.spec.ts` |
| 1 | `responsive` (M2.6) | 5193 | `apps/web/src/features/card-editor/**` (element creation and canvas rendering only), `apps/web/src/features/preview/**`, `packages/player/**`, `packages/project-format/**`, `tests/e2e/m2x-responsive.spec.ts` |
| 1 | `quality` (M2.8, part 1) | 5194 | `.github/**`, `playwright.config.ts`, `packages/domain/src/validate.ts` (id checks only), `tests/e2e/m2x-a11y.spec.ts`, `docs/handoffs/m2x/quality-*` |
| 2 | `shell` (M2.2) | 5195 | `apps/web/src/features/workspace/**` except `CardNavigator.tsx`, `apps/web/src/features/history/**`, `apps/web/src/features/export/**`, `CardCanvas.tsx` zoom and pan only, `tests/e2e/m2x-shell.spec.ts` |
| 2 | `inspector` (M2.3) | 5196 | `apps/web/src/features/card-editor/Inspector.tsx`, `fields.tsx`, inspector CSS, `tests/e2e/m2x-inspector.spec.ts` |
| 2 | `library` (M2.4) | 5197 | `apps/web/src/features/project-library/**`, `apps/web/src/features/workspace/CardNavigator.tsx`, `apps/web/src/features/templates/**` (new), `tests/e2e/m2x-library.spec.ts` |
| 3 | `canvas-craft` (M2.5) | 5198 | `apps/web/src/features/card-editor/**` (canvas, geometry, clipboard, asset panel), `tests/e2e/m2x-canvas.spec.ts` |

Wave 2 starts only after wave 1 is merged (it needs the kit, the lists and the scaling default). Wave 3 starts after wave 2 is merged.

## Rules between worktrees

- Never edit a folder another worktree owns. If you need it, write it in `HANDOFF.md` section 3.
- Never edit central files (contract section 1). The orchestrator grants exceptions only in the table above.
- Every worktree names, in its `HANDOFF.md`, the exported components and props it adds, so the next wave and the orchestrator know the entry points.
- Every worktree reads the other briefs in this file so it knows who does what.
- Real data only. No mocks, no hardcoded rows. E2E data is created through the UI.
- Commit on your branch. Do not merge, push or touch `main`. Write `HANDOFF.md` at the worktree root (contract section 6).

## Briefs

### design-system (M2.1) closes U5, U6, U16
Tokens v2 in `themes/tokens.css` (keep the variable names already used; add spacing, type scale, radius, elevation, motion, focus ring, semantic status colors). Accent presets (at least 5) selectable independently of the theme (`data-accent` on `<html>`, stored as an interface preference in `localStorage`, key `gs.accent`). Every theme and accent pair passes 4.5:1 for text and 3:1 for UI borders and focus (compute in a unit test with a contrast helper, not by eye). Midnight primary accent stays `#7C3AED` unless an accent replaces it with an AA variant. Brand: a logo mark and wordmark generated from code (`scripts/brand/generate.mjs` writes SVG and favicon into `apps/web/public/brand/`, deterministic, unit test that two runs are byte-identical), used in `AppShell`. Component kit in `apps/web/src/components/` (`Button`, `IconButton`, `Field`, `NumberField`, `Select`, `Tabs`, `Menu`, `Dialog`, `Tooltip`, `Panel`, `Toolbar`, `Toast`, `EmptyState`, `Swatch`, `Kbd`, `Icon` set as inline SVG) exported from `components/index.ts`, built on the existing `gs-*` base classes, accessible by default, each with a jsdom test. A gallery route `/design` (hash) shows every component in every state. A Spec (`.kiro/specs/m2-1-design-foundations/`) is written first with correctness properties: every accent keeps AA contrast, the brand generator is deterministic. Do not restyle feature folders: features adopt the kit in later waves.

### behavior-lists (M2.7) closes U14
Build on the locked list contract. GhostScript parser for the locked syntax; element and card references by name when the name is unique (parser resolves names to ids so the stored AST is unchanged; the printer writes names where unique); domain error line mapping to the right script line; blocks editor reads as sentences, collapsible, clearer add and move controls; list variables in the state editor (add, edit and remove items, with type `list`); block editing for every new action and expression; `nextCard` and `prevCard` blocks. Document the grammar in `packages/behavior/GHOSTSCRIPT.md`. Property tests: `parse(print(x)) = x` over the extended AST, list operations never throw. Two examples built with the real editor are exported later as fixtures by the library worktree; here, prove with an e2e that an inventory (input, add, list shown, remove) works in the editor and preview. Spec: `.kiro/specs/m2-7-behavior-lists/`.

### responsive (M2.6) closes U13
New elements are created with `DEFAULT_ELEMENT_PLACEMENT`. An "apply scaling to all elements on this card" action (a dispatch of `UPDATE_ELEMENT` per element, one undo step by shared `coalesceKey`). Preview default is Fit: the whole reference frame scales uniformly, centered, letterboxed; window-size and device-frame modes stay as options. Text size and line widths follow the element scale in editor, preview and web export (`resolveFontScale`). The player honors `Card.background` (`RENDER_DEFAULTS.cardBackground` fallback) and `white-space: pre-wrap` for text. Property tests on `resolveLayout`: scale keeps proportions, anchors keep edge distances, identity at design size, monotonic in the viewport. Re-take `docs/audit/10-preview.png` and `11-preview-phone-window.png`. Spec: `.kiro/specs/m2-6-responsive-defaults/`.

### quality (M2.8 part 1)
GitHub Actions workflow `.github/workflows/ci.yml`: `npm ci`, typecheck, lint, format:check, test, build, Playwright Chromium with the dev server started by the workflow (not by Playwright). `playwright.config.ts`: keep Chromium default, add Firefox and WebKit projects selectable with an env var. Axe scan e2e (`@axe-core/playwright`, already installed) on library, workspace, preview and design screens: no serious or critical violations; fix violations that are in your reach, list the rest. Reject path-unsafe ids at the domain boundary (card, element, asset and behavior ids) in `validateStack` with a property test that exports and re-imports generated ids. Do not do code splitting yet (wave 3). Do not edit `package.json` files.

### shell, inspector, library, canvas-craft
Wave 2 and 3 briefs are copied from `docs/MILESTONE.md` M2.2 to M2.5 and amended after wave 1 merges. Not started.
