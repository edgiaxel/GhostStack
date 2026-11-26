# HANDOFF: library (M2.4), branch feature/library

## 1. Files touched
- `apps/web/src/features/templates/` (new): `build.ts`, `templates.ts`, `index.ts`, `templates.test.ts`
- `apps/web/src/features/project-library/`: `index.tsx`, `CardThumbnail.tsx` (+test), `library-helpers.ts` (+test), `project-library.css`
- `apps/web/src/features/workspace/CardNavigator.tsx`, new `CardNavigator.css`, new `CardNavigator.test.tsx`
- `tests/e2e/m2x-library.spec.ts` (new); `tests/e2e/audit-flows.spec.ts` (2 selector edits: `(entry)` -> `Entry`, `1 behavior(s) navigate to it` -> `1 behavior navigates to it`)
- `.kiro/specs/m2-4-library-templates/` (requirements, design, tasks)

## 2. Exported entry points
- `features/templates`: `TEMPLATES: TemplateDefinition[]` (blank, quiz, recipes, inventory, guide), `findTemplate(id)`, types `TemplateDefinition`, `TemplateInput { stackId, title, now, newId }`. `build` returns `Result<Stack>` built only with `createStack` + `applyCommand`.
- `features/project-library`: `ProjectLibraryPage` (unchanged), `CardThumbnail({ stack, cardId?, className? })`.
- `CardNavigator`: same name and props.

## 3. Requests / contract changes
- Optional: an `onReorder(order: string[])` prop on `CardNavigator` (workspace `index.tsx`, shell-owned). Today drag reorder is carried out as repeated `onMove(id, +-1)` calls, one per order change, because `onMove` reads a stale `stack` in a loop.
- `CardNavigator.css` is a new file in the workspace folder. Shell should keep it.
- `project-library` imports `../export/files` (`downloadBytes`, `safeFileName`) for card export. Suggest re-exporting them from `features/export/index`.
- UI_CONTRACT section 8 already covers templates; no doc edit made (docs are central).
- No dependency, schema or package.json changes.

## 4. Caveats
- Navigator secondary actions are hidden with opacity until hover, focus or selection (always visible on touch). Move buttons now read "Up" / "Down" (text) instead of arrows.
- Thumbnails show images as grey boxes and only the first text line (no asset loading by design). Library loads every Stack via `stacks.get` for thumbnails (fine for small libraries; no pagination).
- Drag reorder verified in Chromium only. Drag must start on the thumbnail (buttons do not start drags in Chromium).
- Template sample content (quiz question, guide steps) is editable placeholder text, created only on pick.
- Remove-last in list templates guards an empty list; there is no "remove selected item".
- Not run: Firefox/WebKit e2e.

## 5. Next step needs
- Orchestrator merge; shell may wire `onReorder`. Re-take library screenshots if wanted (`docs/audit/` untouched).

## 6. Commands run (all in the worktree)
- `npm run typecheck`, `npm run lint`, `npm run format:check`: pass
- `npx vitest run`: 34 files, 292 tests pass (includes template property tests: valid, deterministic, `.gsp` round trip; runtime start without errors; inventory add/remove)
- `npm run build`: pass
- `GS_PORT=5197 GS_NO_WEBSERVER=1 npx playwright test` against `GS_PORT=5197 npm run dev`: 59 passed (all existing specs + 5 in m2x-library)
- `playwright-cli --browser=msedge` (Chrome missing): opened library, created Recipe collection from its template, viewed the grid screenshot, opened the Stack, hovered a card and opened its delete confirmation (names 1 reference). 
