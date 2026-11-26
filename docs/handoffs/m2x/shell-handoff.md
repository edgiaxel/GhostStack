# HANDOFF: shell (M2.2), branch feature/shell, GS_PORT 5195

## 1. Files touched

- New in `features/workspace/`: `EditorShell`, `MenuBar`, `menus.ts`, `shortcuts.ts`, `ShortcutSheet`, `ToolRail`, `StatusBar`, `Splitter`, `ConsoleDrawer`, `layoutPrefs.ts`, `usePanels.ts` (+ tests for prefs and shortcuts). `index.tsx` and `workspace.css` rewired. `CardNavigator.tsx` untouched.
- `features/card-editor/`: `CardCanvas.tsx` (zoom, pan, wheel, Add row removed, exports `addElementToCard`, `isDesignViewport`), new `zoom.ts`, `zoom.test.ts`, `zoom.css`. `card-editor.test.tsx`: harness buttons call `addElementToCard` (the Add row is gone).
- `features/history/`: `index.tsx` (Undo/Redo as kit `Button` with icons, grouped), `history.css`.
- `features/export/`: `index.tsx` (`useExportActions`, `ExportMenu` takes optional `actions`; Preview is primary, exports grouped), new `export.css`.
- `tests/e2e/m2x-shell.spec.ts` (new); `tests/e2e/audit-flows.spec.ts` (one click position 600,350 -> 200,200, because the Fit stage is smaller now).
- `.kiro/specs/m2-2-editor-shell/`.

## 2. Exported entry points

- `CardEditorCanvas` props: `EditorSlotProps` plus optional `zoom: ZoomState`, `onZoomChange`, `onScaleChange(scale)`, `panMode`. Defaults to Fit, so the old call still works.
- `addElementToCard(session, cardId, type)` and `isDesignViewport(stack, viewport)` from `card-editor/CardCanvas` (not re-exported from `card-editor/index.tsx`, which is not mine).
- `zoom.ts`: `ZoomState`, `FIT`, `MIN_ZOOM`, `MAX_ZOOM`, `stepZoom`, `fitZoom`, `clampZoom`, `pointUnderCursor`, `scrollDeltaToPin`, `wheelFactor`.
- `useExportActions(session)` and `ExportMenu({..., actions?})`. `HistoryControls`, `ImportGspButton`, `CardInspector`, `CardNavigator`, `BehaviorEditorPanel` keep their names and props.
- localStorage (interface preferences only): `gs.layout.navigator|inspector|drawer` = `{"size":n,"collapsed":bool}`.

## 3. Contract changes requested

- Kit `MenuItem` needs `shortcut?` and a menu bar mode (left/right traversal). Until then `MenuBar.tsx` reuses the kit classes and `Kbd`. Switch to the kit when it has both.
- Kit `Icon` lacks chevron-left/up and tool icons. The shell flips `chevron-right/down` with CSS and keeps tool SVGs in `ToolRail.tsx`.
- Not in my files, reported: the canvas element `aria-label` is `Name (type)` and does not contain the visible text (label-content-name-mismatch). It sits in the element render of `CardCanvas.tsx` (selection area, canvas-craft) and `ElementView.tsx`. Not changed. The axe spec still passes on the workspace.
- Inspector `onOpenBehavior`: the console tab is controlled in `workspace/index.tsx` (`drawerTab`). Wiring is `setDrawerTab('behavior')` plus expanding the drawer with `panels.toggle`.

## 4. Caveats and known gaps

- Element tools add at once and stay in Select. There is no draw-a-rectangle placement. Hand tool, space-drag and middle-button drag pan.
- Zoom is not stored per Stack. Plain wheel scrolls; Ctrl/Cmd+wheel zooms at the pointer.
- Space pans only when focus is not on a button, input or link (native activation wins).
- Switching console tabs remounts the Behavior panel (kit `Tabs` renders only the active panel), so its inner tab resets to Blocks.
- Runtime tab is a read-only dry run of `card.enter` (`createRuntime`), not a live session. Problems tab shows `validateStack` and save errors.
- At 1280x720 Fit is about 37%. The floor is 25%, below which the card scrolls.
- Mobile (<=960px) stacks the panels and hides splitters. Verified only by the existing overflow spec, not by eye.
- Firefox and WebKit not run.
- Import .gsp is not in the File menu (library owns it).

## 5. What the next step needs

- Merge: `CardCanvas.tsx` may conflict with canvas-craft. My change is confined to props, zoom and pan hooks, the removed Add row and two exported helpers.
- library: keep `CardNavigator` props. The shell supplies the "Cards" heading and the collapse button around it.
- inspector: the shell renders the "Inspector" panel header, so the inspector can drop its own title.

## 6. Commands run

- `npm run typecheck`, `lint`, `format:check`, `test` (34 files, 284 tests), `build`: all exit 0.
- Dev server on port 5195 started by me; `GS_PORT=5195 GS_NO_WEBSERVER=1 npx playwright test`: 59 passed, 1 skipped (audit-screens needs `AUDIT_SHOTS`). `m2x-shell.spec.ts`: 5 passed.
- `playwright-cli -s=shell open ... --browser=msedge` at 1440x900: created a Stack, Insert > Button, tool rail Add shape, `?` sheet, Escape, read the status bar, took a screenshot. The shell rendered as designed.
