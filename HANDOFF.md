# HANDOFF: M2 (2026-11-26)

## Completed

- Core creation workflow without AI: Stack and Card management, card editor (text, button, input, image, shape, line; select, move, resize by pointer and keyboard; z-order; inspector; anchoring and scaling; Desktop, Tablet and Mobile viewport switcher; image upload with missing-file fallback).
- Behavior system: canonical AST, safe runtime (no `eval`), GhostScript parser and printer, block editor and CodeMirror 6 editor over the same AST, application state variables.
- Editing session: undo and redo, debounced autosave, crash recovery, checkpoints.
- Preview and standalone web export share one player and one runtime. `.gsp` export and import validate references and assets.
- Verified on `main`: `npm run typecheck`, `lint`, `format:check`, `test` (178 passed), `build`, `test:e2e` (7 passed, including `m2-full-flow`: build a two-card quiz with behavior, reload, undo, preview, web export from `file://`, `.gsp` round trip).

## Contracts (read before M3)

- `docs/UI_CONTRACT.md`: central files, UI and data rules, worktree ownership. Briefs and per-worktree handoffs: `docs/handoffs/m2/`.
- `packages/shared-contracts`: `Stack`, `Card`, `Element` (strict per-type properties), `Behavior` AST, `ProjectCommand` (13 commands), `StackSession`, `StackRepository`, `AssetRepository`, `CheckpointRepository`, `resolveLayout`, `RENDER_DEFAULTS`.
- Data: IndexedDB `ghoststack` v2. Stores `stacks` (key `stackId`), `assets` (key `[stackId, assetId]`), `checkpoints` (key `checkpointId`, index `byStack`). No server, no env vars. `GS_PORT` changes the dev and e2e port.
- Every Stack change goes through `StackSession.dispatch` then `applyCommand` then `validateStack`. `validateStack` rejects dangling card, element, state and asset references. Deleting a Card or element removes actions that point at it.
- Packages: `domain`, `storage` (`createIdbStorage`), `project-format` (`exportGsp`, `importGsp`, `exportWebApp`), `behavior` (`createRuntime`, `parseGhostScript`, `printGhostScript`), `player` (`mountPlayer`, standalone `boot`).
- Standalone bundle: `npm run build:player` writes `apps/web/public/player.standalone.js` (git-ignored; run by `dev` and `build`).

## Gaps and caveats

- No CI workflow yet.
- Crash recovery is covered by unit tests only (a Playwright reload flushes first).
- Editing is enabled only at the Desktop viewport (1280x720). Tablet and Mobile preview anchoring.
- The web build is one 829 kB chunk (CodeMirror, zod). Code splitting is not done.
- The standalone player bundle includes zod through `shared-contracts` (107 kB, 31 kB gzip).
- `.gsp` export needs path-safe Card ids (UI ids are UUIDs) and refuses when image bytes are missing. Web export continues with placeholders and lists them.
- GhostScript diagnostics from domain rejections point at line 1.
- Passthrough session (`app/passthroughSession.ts`) is kept only as a test baseline. `services.tsx` uses the history session.

## Next (M3)

1. Validate the provider adapter and the MCP bridge transport (T-013) before building the workflow.
2. AI plan schema, approval UI and transactional apply on an isolated copy using `applyCommand` and `StackSession.restore`; reuse checkpoints for rollback.
3. Add CI (GitHub Actions) running typecheck, lint, format, test, build and e2e.
