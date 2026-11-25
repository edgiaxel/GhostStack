# HANDOFF: workspace (VS-02 UI)

## 1. Files touched

All under `apps/web/src/features/workspace/`: `index.tsx`, `CardNavigator.tsx`, `cardSelection.ts`, `cardSelection.test.ts`, `workspace.css`. Plus this file.

## 2. Exported entry points

`WorkspacePage({ stackId: string; cardId?: string })` from `features/workspace/index.tsx`.

## 3. Env, schema, dependency changes requested

None.

## 4. Caveats and known gaps

- `applyCommand` is still the stub on this branch, so every mutation (add, rename, duplicate, reorder, delete) shows `INVALID_PATCH_COMMAND: applyCommand is not implemented yet (VS-02)` in a `gs-error` alert. No workaround was added. Mutation success paths are untested end to end until the `domain` worktree merges.
- Assumes domain: ADD_CARD appends when `index` is omitted; DELETE_CARD refuses entry/last card and cleans navigation references (errors shown as-is). The UI does not show the "affected references" warning from DESIGN UI-02; that needs a domain query helper. Undo not implemented (not required).
- After add/duplicate the UI navigates to the new card. After deleting the selected card it navigates to the next neighbour, else the previous.
- A missing `cardId` in the URL falls back to the entry card without rewriting the URL.
- Canvas shows the card title only; inspector is an empty state. Drawer slot unused.
- Only pure helpers are unit tested (no jsdom). Component behaviour was checked manually in a browser.

## 5. What the next step needs

Merge `domain`, then re-check add/rename/duplicate/reorder/delete in the browser. The M2 card editor replaces the canvas slot content.

## 6. Commands run and results

- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run format:check`: all pass.
- Browser (playwright-cli, dev server on port 5181, Stack seeded via raw IndexedDB in the page, nothing committed): not-found state, list render, entry fallback for a bad cardId, selecting a card sets the URL to `#/stack/s1/card/c2`, Add card shows the stub error. Rename/duplicate/reorder/delete success paths not run (blocked by stub).
