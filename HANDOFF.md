# HANDOFF: behavior-lists (M2.7), branch feature/behavior-lists

This file replaces the M2 `HANDOFF.md` on `main` in this branch. Keep main's version when merging; take this content for the M2.7 record.

## 1. Files touched

- `packages/behavior/src/ghostscript.ts` (parser, printer, names, `locateDomainIssue`), `index.ts`, `GHOSTSCRIPT.md`
- Tests: `ghostscript.test.ts`, `ghostscript-lists.test.ts` (new), `lists.test.ts` (type fix only)
- `apps/web/src/features/behavior-editor/`: `BehaviorBlocks.tsx`, `StateEditor.tsx`, `ScalarEditor.tsx` (new), `model.ts`, `index.tsx`, `behavior.css`, `model.test.ts`, `BehaviorEditorPanel.test.tsx`
- `tests/e2e/m2x-behavior.spec.ts` (new)
- `.kiro/specs/m2-7-behavior-lists/` (requirements, design, tasks)

## 2. Exported entry points

- `@ghoststack/behavior`: `parseGhostScript(source, refs?)`, `printGhostScript(behaviors, refs?)`, `locateDomainIssue(source, message)`, types `GhostScriptRef`, `GhostScriptRefs`. `KEYWORDS` now includes `next previous card list add remove clear at length item join`.
- `refs` is `{ cards?: {id,name}[]; elements?: {id,name}[] }`. Omitted `refs` keeps the old behavior exactly (ids only).
- `BehaviorEditorPanel` is unchanged (same props). `BehaviorBlocks` gains the prop `ownerName`; `EditorContext` gains `listKeys`, and `stateKeys` now lists scalar variables only.
- Library worktree: build a template's behaviors with `UPDATE_BEHAVIOR`/`UPDATE_STATE_SCHEMA`. An inventory recipe is in the e2e spec (input saves into text variable `draft`; Add: `list add items = draft`, `text "Text 1" = join(items, "\n")`; Remove first: `list remove items at 0`).

## 3. Contract changes requested

None. No `package.json`, lockfile, `shared-contracts`, `domain` or central file touched.

Observation for the orchestrator (not blocking): the runtime handles `element.change` for an input whose `stateKey` is a `list` variable as if it were boolean (no list branch in `runtime.ts` lines near 288). The Inspector offers every variable, including lists, in "Save typed value in variable". Suggest the Inspector offers scalar variables only, or the domain rejects a list `stateKey`. I did not change either.

## 4. Caveats and known gaps

- Names resolve for cards (by title) and for elements of the card that owns the behavior. A name used twice stays as typed and the domain reports it as unknown; the block editor always stores ids.
- `locateDomainIssue` parses the English text of domain messages (seven message shapes). If `validateStack` wording changes, the line falls back to the behavior header. It is covered by tests, not by a shared error type.
- The state editor commits one undo step per keystroke when typing list items (same as the existing starting-value inputs). Not coalesced.
- Existing e2e specs (`audit-flows`, `m2-full-flow`) read the "Cards and elements you can name" list as `Name (type): "id"`; I kept that format. The summary text changed.
- Block text for moves is now "Move up" / "Move down" (aria labels unchanged).
- Sentence descriptions use element names and card titles; no i18n.
- The shared component kit from `design-system` is not used (told not to wait). The new UI uses `gs-*` classes and the `gs-beh-` CSS in `behavior.css`.
- Not verified: Firefox and WebKit, screen reader behavior of the collapse button beyond `aria-expanded`.

## 5. What the next step needs

- Orchestrator: merge, then decide the list-`stateKey` question above.
- Library worktree: templates "Inventory list" and "Recipe collection" can call the same commands the e2e uses. Text elements that show a list rely on `white-space: pre-wrap` (already in the player).
- Quality worktree: the new blocks use native `select`/`button` with labels; run the axe scan on the behavior drawer.

## 6. Commands run and results (in `.worktrees/behavior-lists`)

- `npx prettier --write packages/behavior apps/web/src/features/behavior-editor tests/e2e/m2x-behavior.spec.ts`
- `npm run typecheck`: passed
- `npm run lint`: passed
- `npm run format:check`: passed
- `npm test`: 26 files, 211 tests passed (includes the extended round-trip property at 300 runs, the name round-trip property at 300 runs, parser never throws, list actions never throw)
- `npm run build`: passed (existing chunk-size warning only)
- `$env:GS_PORT='5192'; npm run test:e2e`: 31 passed, 1 skipped (the skip is pre-existing; first run had 2 failures in `audit-flows` and `m2-full-flow` caused by my change to the ids list text, fixed and re-run green)
- `playwright-cli` (`npx playwright cli open --browser=chromium`, dev server on 5192): created a Stack, added a list variable `stock` with an item, added text and button elements, added a behavior, chose "Add to list" and "Go to next card" from the grouped action select, read the sentence and the GhostScript tab (`list add stock = ""`, `next card`). The session ran some steps twice because of my shell quoting, so the Stack had duplicate behaviors; this was a test-session artifact, not a product defect. Chromium only. The `chrome` channel is not installed here, so I used `--browser=chromium`. Screenshots were not kept (the folder `docs/audit` is not mine).
- Commit on `feature/behavior-lists`; nothing pushed or merged.
