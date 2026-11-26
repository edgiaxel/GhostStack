# HANDOFF: inspector (M2.3), branch feature/inspector, GS_PORT 5196
## 1. Files touched
- `apps/web/src/features/card-editor/`: `Inspector.tsx` (rebuilt), `fields.tsx` (rebuilt on the kit), new `inspector-model.ts`, `inspector-extras.tsx`, `inspector.css`, `inspector.test.tsx`; `card-editor.test.tsx` (tab clicks added).
- `tests/e2e/m2x-inspector.spec.ts` (new). Updated for the tabs: `m2-card-editor.spec.ts`, `audit-flows.spec.ts` (two Layout tab clicks), `m2x-responsive.spec.ts` (one Layout tab click).
- `.kiro/specs/m2-3-inspector/` (requirements, design).
## 2. Exported entry points
- `CardInspector(props: EditorSlotProps & { onOpenBehavior?: () => void })` from `features/card-editor/index.tsx` (unchanged name). "Edit behaviors" renders only when `onOpenBehavior` is set.
- `Inspector.tsx` also exports `ElementInspector({session, stack, cardId, elements: Element[], tab, onTab, onOpenBehavior})`, which handles shared and mixed values; the slot passes one element.
- Tabs: Content, Layout, Appearance, Behavior. The tab choice persists across selections but resets on reload. No element selected: card section (Title, Background, Frame width, Frame height).
- Labels kept: Text, Label, X, Y, Width, Height, Anchor, Scaling, Fill, Alternative text, Save typed value in variable, Text color, Default, Delete element, Bring to front, `input[type=file]`.
## 3. Requests
- None for dependencies, schema or contract. The shell may pass `onOpenBehavior` to `CardInspector`.
- Kit has no minus icon; the decrease stepper uses a text minus.
- Do not add a label containing "Size", "Scaling", "Anchor" or "Label" elsewhere in the inspector: specs use non-exact `getByLabel` on them.
## 4. Caveats
- Domain errors show beside the field with a hint; only the colour field uses `role="alert"`, the others use the kit error text.
- Multi-selection is prepared but untested in the UI (unit tests cover single selection and `sharedValue`). Several elements: dry-run first, then dispatch one per element; undo is one step per element.
- Frame width and height are limited to 120..8000 (domain rule). While the frame differs from the canvas preset, the canvas locks editing (existing canvas behavior).
- Token swatches resolve theme tokens to hex at render. In jsdom they are skipped.
- `card-editor.css` still holds old `.gs-ci*` rules; `inspector.css` overrides them. Cleanup left to canvas-craft.
- `m2-history.spec.ts` failed once in a full run (2 s timeout on a status assertion) and passed alone and in the next run.
## 5. What the next step needs
- Shell: pass `onOpenBehavior`. canvas-craft: remove old `.gs-ci*` rules from `card-editor.css`. Run `npm run build` before e2e, since web export specs need the built player.
## 6. Commands run
- `npm run typecheck`, `lint`, `format:check`, `test` (32 files, 282 tests), `build`: all exit 0.
- Dev server on 5196; `GS_PORT=5196 GS_NO_WEBSERVER=1 npx playwright test`: 54 passed, 1 skipped, 1 flaky failure (m2-history, passes alone). An earlier full run failed `m2x-responsive` because my group labels contained "size"; fixed by renaming them.
- `playwright-cli -s=insp open ... --browser=msedge`, `run-code`: added a button, set Label, set Text color #ff0000 (rendered rgb(255,0,0)), Layout tab, pinned bottom right, switched to Mobile (button moved), screenshot checked. 0 console errors.
