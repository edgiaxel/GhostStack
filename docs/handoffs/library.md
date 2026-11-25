# HANDOFF — library (VS-01)

1. **Files touched** (all in `apps/web/src/features/project-library/`): `index.tsx`, `library-helpers.ts`, `library-helpers.test.ts`, `project-library.css` (`gs-library-` prefix). Plus this file.
2. **Exports**: `ProjectLibraryPage` (no props) from `features/project-library/index.tsx`.
3. **Requests**: none (no dependency, schema or env changes).
4. **Caveats**:
   - Rename calls `applyCommand(stack, RENAME_STACK)`, then `stacks.save`. On `main` `applyCommand` is a stub, so rename shows the `INVALID_PATCH_COMMAND` message in `gs-error`. It works once the `domain` worktree merges. No workaround was added.
   - Delete uses an inline confirm (no `window.confirm`).
   - No import/export buttons (wait for `format`).
   - No component tests (no jsdom); helper tests only. UI verified in a browser.
   - The project-recovery and invalid-file states from UI-01 are not covered; they belong to import.
5. **Next step needs**: merge `domain` so rename works; add import/export buttons after `format`. Open navigates to `/stack/:id`, which `workspace` renders.
6. **Commands run (in this worktree)**: `npm run typecheck` pass; `npm run lint` pass (after fixing a set-state-in-effect error); `npm test` pass (5 files, 10 tests); `npm run build` pass; `npm run format:check` pass.
   Browser check: vite on port 5180 driven by playwright-cli. Empty state showed. I typed "Quiz Demo" and clicked Create. After reloading `#/library`, the list showed "Quiz Demo, 1 card, Updated 11/25/2026, 4:20:57 PM" with Open, Rename and Delete buttons. I did not click-test rename or delete in the browser, and I did not check the redirect to `/stack/:id` (the `location.hash` output was cut off).
