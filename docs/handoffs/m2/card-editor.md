# Brief: card-editor (VS-03)

Branch `feature/card-editor`, port 5181. PRD F-003, F-004. DESIGN: workspace canvas and inspector.

## Own

`apps/web/src/features/card-editor/**` and `tests/e2e/m2-card-editor.spec.ts`. Replace the placeholder `CardEditorCanvas` and `CardInspector` in `features/card-editor/index.tsx`. Keep both names and the `EditorSlotProps` props.

## Build

Authoring canvas:
- Render the selected Card at the active viewport preset (`VIEWPORT_PRESETS`) scaled to fit the canvas area. Place every element with `resolveLayout(layout, stack.viewportDefaults, presetSize)`. Never reimplement placement.
- Editing (add, move, resize) is enabled only when the preset equals `stack.viewportDefaults`. Other presets preview anchoring and scaling and say so in a visible note. Selection and inspector edits work in every preset.
- Viewport switcher in the canvas header, driven by `viewport` and `onViewportChange`.
- Empty Card state with the next step. Elements render inert: no behavior runs in the editor.
- Render each type from its properties: text, button (a styled non-interactive box), input (a styled non-interactive box), image, shape (rect, ellipse), line (`flipY`). Honor `visible` (show dimmed with a hidden marker, never remove) and `opacity`.

Elements:
- Palette to add text, button, input, image, shape and line using `ELEMENT_DEFAULTS`. Ids from `crypto.randomUUID()`. Dispatch `ADD_ELEMENT` (zIndex is assigned by the domain). Offset new elements so they do not stack exactly.
- Select by click or Tab and Enter. Deselect by clicking empty canvas or pressing Escape.
- Move by pointer drag and by arrow keys (1px, Shift 10px). Resize by corner and edge handles, and by Alt+arrow keys. Clamp to a minimum size of 1 and keep values finite integers or one decimal at most. Use `coalesceKey` (`move:<id>`, `resize:<id>`) so one gesture is one undo step. Dispatch on each change so autosave and undo see it, not only on pointer up.
- Delete by Delete or Backspace and by a button. Z-order buttons for `REORDER_ELEMENT` (front, forward, backward, back).

Inspector for the selected element:
- Name, x, y, width, height, anchor (`ANCHORS`), scale mode (`SCALE_MODES`), visible, opacity.
- Per-type properties: text (text, fontSize, fontWeight, align, color), button (text, fontSize, color, background), input (placeholder, defaultValue, fontSize, `stateKey` chosen from `stack.stateSchema` or none), image (alt, fit, image source), shape (shape, fill, stroke, strokeWidth, radius), line (stroke, strokeWidth, flipY).
- Dispatch `UPDATE_ELEMENT`. When the domain rejects a value, show its message next to the field and keep the field value the user typed. Never write a value the schema rejects.
- Nothing selected: show Card info and the empty prompt.

Images:
- File input accepts `image/png, image/jpeg, image/gif, image/webp`. Convert with `describeAssetFile` (`app/assets.ts`), `assets.put(stackId, asset, bytes)`, then `REGISTER_ASSET`, then `UPDATE_ELEMENT` with `assetId`. If a later step fails, delete the stored bytes and show the error.
- Render with `useAssetUrl`. A registered asset whose bytes are missing renders a labelled fallback box ("Image file missing" plus the alt text). It never throws and the creator can pick a new file.
- Size limit 5 MB per file with a clear message.

## Acceptance

- A creator builds a Card with every element type, moves, resizes, reorders and edits it, reloads, and sees the same Card.
- Switching to Tablet or Mobile shows a bottom-right anchored element keeping its distance to the edges.
- Keyboard-only editing works for select, move, resize, delete.
- Missing image bytes do not crash the editor.

## Tests

- Unit: pointer-to-layout math, clamping, keyboard deltas, fit-to-area scale.
- jsdom: canvas renders each type, selection, inspector shows domain errors.
- `tests/e2e/m2-card-editor.spec.ts`: create a Stack, add each type, keyboard move and resize, inspector edit, z-order, image upload with a real small file, reload persistence, viewport switch with anchoring, delete.

## Other worktrees you rely on

None. The session is the passthrough on `main` (no undo yet). `behavior` owns the drawer, `history` owns the toolbar controls and `preview-export` owns Preview and Export.