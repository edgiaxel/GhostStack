# M2.2 Editor shell: design
- `features/workspace/EditorShell.tsx`: own grid (menu bar, tool rail, toolbar, navigator | canvas | inspector, console, status bar). `WorkspaceLayout` in `app/` is central and stays for loading and error states. Panels keep the base classes `gs-panel gs-area-*` so existing specs find them.
- `layoutPrefs.ts`: pure clamp and parse; `Splitter.tsx`: `role="separator"`, pointer and keyboard.
- `MenuBar.tsx`: kit `Menu` has no shortcut column or bar traversal, so the bar uses the kit CSS classes and `Kbd`. Request: add `shortcut` to kit `MenuItem`.
- `shortcuts.ts`: one table drives key handling, menu hints and the sheet.
- `card-editor/zoom.ts`: pure zoom math. `CardCanvas.tsx` gets optional props `zoom`, `onZoomChange`, `onScaleChange`, `panMode`, and exports `addElementToCard`. Selection, drag and resize are untouched.
- `export/`: `useExportActions` shared by the toolbar and the File menu.
## Tasks
1. zoom.ts + tests. 2. CardCanvas zoom, pan, addElementToCard. 3. layoutPrefs, Splitter, EditorShell. 4. MenuBar, shortcuts, sheet, tool rail, status bar, console. 5. Toolbar regroup. 6. e2e `m2x-shell.spec.ts`. 7. Gate.
