# HANDOFF: M0 and M1 (2026-11-25)

## Completed

- M0 audit closed. License Apache-2.0. Stale spike branch deleted.
- VS-00 foundation, VS-01 create/persist/list/rename/delete Stack, VS-02 Card add/rename/duplicate/reorder/delete/select, VS-06 `.gsp` library.
- Verified on `main`: `npm run typecheck`, `lint`, `test` (53 passed), `build`, `format:check`, `test:e2e` (2 passed: create, reload persistence, card commands, theme, rename and delete Stack, unknown id).

## Contracts (read before M2)

- `docs/UI_CONTRACT.md`: central files, UI rules, worktree ownership, HANDOFF format. Still binding.
- `packages/shared-contracts`: `Stack`, `Card`, `Element`, `Asset` (zod), `ProjectCommand`, `StackRepository`, `Result`, `ErrorCode`.
- Data: IndexedDB `ghoststack` v1, store `stacks` keyed by `stackId`. No server, no env vars.
- Routes: `/library`, `/stack/:stackId`, `/stack/:stackId/card/:cardId`.
- Packages: `domain` (`createStack`, `validateStack`, `applyCommand`), `storage` (`createIdbStackRepository`), `project-format` (`exportGsp`, `importGsp`).
- Per-slice reports: `docs/handoffs/{domain,format,library,workspace}.md`.

## Orchestrator fixes during merge

- Moved per-worktree `HANDOFF.md` to `docs/handoffs/`.
- Added `zod` to `project-format` (missing declared dependency).
- Added Playwright config and `tests/e2e`.

## Gaps and caveats

- No `.gsp` import/export UI (UI-07). Library only.
- No jsdom: component tests absent; helpers and e2e cover UI.
- Deleting a Card does not warn about navigation references (no navigation actions exist yet).
- No CI workflow yet.
- Element and behavior commands are not in `ProjectCommand`; the contract owner adds them when VS-03 and VS-04 start.
- `project-format` size limits trust ZIP header sizes before extraction.
- `workspace` and `library` assume `ADD_CARD` appends and `DELETE_CARD` keeps entry rules; e2e confirms.

## Next (M2)

1. Orchestrator: extend `shared-contracts` with element commands and the behavior AST types; add `packages/behavior` skeleton; install any approved deps (jsdom, CodeMirror, fast-check).
2. Worktrees: `card-editor` (VS-03), `behavior` (VS-04), `import-export` (UI-07 + standalone export), `history` (autosave, undo, VS-07).
3. Add GitHub Actions CI.
