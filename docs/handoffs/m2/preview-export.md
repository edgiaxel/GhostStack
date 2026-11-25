# Brief: preview-export (VS-05 and UI-07)

Branch `feature/preview-export`, port 5184. PRD F-014, F-018, F-019, F-020. ARCHITECTURE 4.5, 4.6, H (preview and export must not interpret behavior differently).

## Own

`apps/web/src/features/preview/**`, `apps/web/src/features/export/**`, `packages/player/**`, `packages/project-format/**`, `tests/e2e/m2-preview-export.spec.ts`. Replace the placeholders `PreviewPage`, `ExportMenu`, `ImportGspButton`, and the skeletons `mountPlayer` and `boot` in `packages/player`. Keep exported names and props. `ExportMenu` takes `EditorSlotProps`.

## Build: player (`@ghoststack/player`)

`mountPlayer({ container, stack, resolveAssetUrl, createRuntime, startCardId, onError })` renders a Stack as a running application and returns `{ destroy() }`. Preview and the standalone export both call it, so they cannot drift.
- DOM built with `createElement`, `textContent` and `style.setProperty`. Never `innerHTML`, never inline event attributes. Colors are already restricted by the schema, but still set them only through `style`.
- Layout: `resolveLayout(layout, stack.viewportDefaults, containerSize)`, recomputed with `ResizeObserver`.
- Elements: text (div), button (`<button>`), input (`<input>`, emits `element.change`, shows `defaultValue`, bound to `stateKey` through the runtime), image (`<img>` from `resolveAssetUrl`, labelled fallback box when it returns undefined or the image errors), shape (rect, ellipse), line (SVG).
- Runtime: `createRuntime(stack, { startCardId })`, `start()`, then render from `snapshot()` after every `dispatch`. Click handlers dispatch `element.click`. Re-render on card change. `snapshot.errors` go to `onError`.
- Honor `visible` and `opacity`, focus order by z-order, keyboard operable buttons and inputs, `aria-label` from `alt` and names.
- `@ghoststack/behavior` is a skeleton on `main` until the `behavior` worktree merges. Your player must work with the real contract and show static content now. Say in `HANDOFF.md` that behavior is unverified until merge.
- `packages/player/src/standalone.ts` is the entry of the standalone bundle (`npm run build:player` writes `apps/web/public/player.standalone.js`, global `GhostStackPlayer`). Implement `boot()`: read the embedded Stack JSON, resolve assets as relative URLs, call `mountPlayer`. The bundle imports no React, storage or editor code. Keep it small.

## Build: preview

`PreviewPage` at `/stack/:stackId/preview`. Loads the Stack with `useServices().stacks.get` (the toolbar flushes the session before navigating) and assets with `assets.getAll`, turns bytes into object URLs and revokes them on unmount. Shows the player, a Restart button, a viewport preset select, a runtime issues list (from `onError`), and a link back to the editor. States: loading, Stack not found, error with retry, empty Stack (no Cards or no elements) with a next step. Missing asset bytes show the fallback, not an error page.

## Build: `.gsp` import and export

- `ExportMenu` (workspace toolbar): Preview (calls `session.flush()` then navigates), Export `.gsp`, Export web app. Disabled with a reason while saving. Show success and error messages with the cause.
- Export `.gsp`: `session.flush()`, `assets.getAll(stackId)`, `exportGsp(stack, assets)`, download as `<title>.gsp` (sanitize the file name). When registered assets have no bytes, `exportGsp` returns `ASSET_MISSING`: show which assets and how to fix it. Do not export a broken archive.
- `ImportGspButton`: file input, `importGsp(bytes)`, then a fresh `stackId` from `crypto.randomUUID()` so an import never overwrites a Stack, `validateStack` from the domain, `stacks.save`, `assets.put` for each asset, navigate to `/stack/<new id>`. If any step fails, delete the new Stack (this removes its assets) and report the error. The currently open Stack is never touched. The orchestrator mounts the button in the library at merge.
- Extend `importGsp` and `exportGsp` in `packages/project-format` to run the domain integrity checks (`@ghoststack/domain` is already a dependency): behavior references, element properties, asset references. Add tests for each rejection. Keep the existing archive safety limits.

## Build: standalone web export

- Output: a `.zip` named `<title>-web.zip` containing `index.html`, `player.js` (the contents of `/player.standalone.js` fetched at export time), and `assets/*`. The Stack JSON is embedded in `index.html` in a `<script type="application/json">` with `<` escaped, so it runs from `file://` and any static host. Assets are relative files.
- The export contains no editor code, no storage code, no API keys, no `.kiro` paths, and no authoring-only data (checkpoints, history). A `startCardId` and the runtime state start fresh on every load.
- Missing asset bytes: the export still works and shows the fallback box for those images. Tell the creator which assets were missing.
- If `/player.standalone.js` cannot be fetched (stale dev build), fail with a clear message, never a broken zip.
- Add a test that unzips the export, checks the file list and that the HTML parses and embeds the Stack that was exported.

## Acceptance

- A creator previews the Stack, sees the layout the editor shows, and a missing image shows the fallback.
- `.gsp` export then import gives an equal Stack under a new id with all assets, and a corrupt, oversized or unsafe archive is rejected with a message and no partial Stack.
- The exported web zip opens in a browser from `file://` with no network and renders the same Cards and layout as preview. With the real behavior runtime merged it also behaves the same.

## Tests

- Unit: player DOM output per element type (jsdom), layout recompute on resize, fallback for missing assets, escaping (a text value `<img onerror=...>` stays text), import ordering and cleanup on failure, export zip contents, filename sanitizing.
- Property (`fast-check`): `exportGsp` then `importGsp` returns an equal Stack and assets for generated valid Stacks.
- `tests/e2e/m2-preview-export.spec.ts`: create a Stack with the UI, write a richer fixture Stack and an image asset into the real IndexedDB through `page.evaluate` (the editor palette is not on your branch), preview it, export `.gsp`, import it from the library flow or via your own import control, check a second Stack appears, export the web zip and open its `index.html` through Playwright with `file://`.

## Other worktrees you rely on

`behavior` provides `createRuntime` (skeleton on `main`). `card-editor` provides the editing UI. Do not wait for either.