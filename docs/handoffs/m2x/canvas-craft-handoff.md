# HANDOFF: canvas-craft (M2.5), branch feature/canvas-craft, GS_PORT 5198

## 1. Files touched

- `features/card-editor/`: `CardCanvas.tsx` (multi-select, marquee, group move, snap guides, in-place edit, F2, nudge), `ElementView.tsx` (`visibleText`, `elementLabel`, `assetVersion`), `Inspector.tsx` (multi hookup via `selectedIds`, one undo step per edit/delete), `geometry.ts`, new `canvas-actions.ts`, `clipboard.ts`, `assets-model.ts`, `AssetPanel.tsx`, `assets.css`; `card-editor.css` (old `.gs-ci*` removed, still-used `.gs-ci-section`, color input and width rules moved to `inspector.css`). Tests: `geometry-craft.test.ts`, `canvas-actions.test.ts` (property tests), `canvas-craft.test.tsx`; `card-editor.test.tsx` (regex name).
- `packages/project-format/src/`: new `orphans.ts` (+test); `gsp.ts`, `web-export.ts` prune unreferenced assets; `index.ts`; test fixtures in `gsp.test.ts`, `web-export.test.ts` now reference their assets.
- Shell (wiring): `workspace/index.tsx`, `menus.ts`, `shortcuts.ts`, `shortcuts.test.ts`.
- `tests/e2e/m2x-canvas.spec.ts`; `.kiro/specs/m2-5-canvas-craft/`.

## 2. Exported entry points

- `AssetPanel({ session, open, onClose })` from `card-editor/index.tsx`.
- `CardEditorCanvas` extra optional props `selectedIds`, `onSelectionChange`. `CardInspector` extra optional `selectedIds`. Old props keep working.
- `canvas-actions.ts`: `dispatchAll`, `moveElements`, `deleteElements`, `alignElements`, `distributeElements`, `duplicateElements`, `pasteElements`, `cloneElements`, `gestureKey`. `clipboard.ts`: in-memory only. `project-format`: `pruneOrphanAssets`, `referencedAssetIds`.
- Shortcuts added: Ctrl+C, Ctrl+V, Ctrl+D, Ctrl+A, F2, Shift+Click, Alt+Drag (snap off).

## 3. Requests and out-of-ownership edits (please review)

- No dependency, schema or command requests.
- Edited outside the listed ownership, all minimal: `workspace/menus.ts` and `shortcuts.ts` (menu items and shortcuts need them), `workspace/StatusBar.tsx` (aria-label `100%, Actual size`, the last axe name mismatch), `tests/e2e/m2x-a11y.spec.ts` (`KNOWN` emptied: the scan is clean), `packages/domain/src/safe-ids.test.ts` (fixture asset is now used by an image element, because exports drop orphans).
- Old stacks with unreferenced assets lose those entries in new exports (intended).

## 4. Caveats

- Behaviors are not copied by duplicate or paste (their targets belong to the originals). Images cannot be pasted into a different Stack.
- Undo and redo stamp a new `updatedAt` (session behavior), so "exact previous Stack" in tests ignores that one field.
- Delete in the asset manager removes the bytes; undo restores the registry entry but not the file (stated in the panel).
- Asset panel is a dialog opened from View > Asset manager, not a docked panel. No layer panel (dropped as allowed).
- Forward/Backward z-order stay single-selection; Front/Back work on several. Resize handles only with one selected. Marquee uses resolved rects, editing only at the design viewport.
- Snapping is against frame edges/center and other elements' edges/centers, threshold 6 screen px. No spacing guides.
- Firefox and WebKit not run. The `.gs-ci-section` rule was kept (still used by the inspector).

## 5. Next step needs

- Merge conflicts possible in `workspace/index.tsx`, `menus.ts`, `shortcuts.ts` with other shell edits.
- Optional: kit `MenuItem` shortcut column (menus still use the shell's own bar).

## 6. Commands run

- `npm run typecheck` (exit 0), `lint`, `format:check`, `npm test` (42 files, 348 tests), `npm run build`: all pass.
- Dev server on 5198 started by me; `GS_PORT=5198 GS_NO_WEBSERVER=1 npx playwright test`: 71 passed, 1 skipped (audit-screens), includes `m2x-canvas` (6 tests) and the axe scan with empty `KNOWN`.
- `playwright-cli -s=cc open ... --browser=msedge`: created a Stack, added 2 shapes, text and button, Ctrl+A, Arrange > Align left, screenshot: "Selected: 4 elements" with group outline and inspector "4 elements" shown. Screenshot not committed.
