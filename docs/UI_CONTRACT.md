# UI and Worktree Contract — GhostStack

Locked on `main` by the orchestrator. Worktrees inherit it; they do not change it. To request a change, say so in `HANDOFF.md`.

## 1. Central files (orchestrator only)

Worktrees must not edit these:

- `package.json`, `package-lock.json`, `tsconfig*.json`, `eslint.config.js`, `vitest.config.ts`, `.prettierrc.json`
- `apps/web/src/App.tsx`, `main.tsx`
- `apps/web/src/app/**` (AppShell, router, routes, services, theme)
- `apps/web/src/themes/**`
- `packages/shared-contracts/**`
- `docs/**` (except your own `HANDOFF.md`)

Need a dependency? List it in `HANDOFF.md` with reason and size. The orchestrator installs it. Do not edit `package-lock.json`.

## 2. UI rules

- One navbar: `AppShell`. One workspace grid: `WorkspaceLayout` (slots: navigator, canvas, inspector, drawer). Never render your own toolbar, global layout or `<html>`/`<body>` styles.
- Style with the CSS variables in `themes/tokens.css` and the classes in `themes/base.css` (`gs-btn`, `gs-btn--primary`, `gs-btn--danger`, `gs-input`, `gs-panel-title`, `gs-empty`, `gs-error`). No hardcoded colors, no new theme, no UI library.
- Feature CSS lives in a file next to the component, class prefix `gs-<feature>-`. It may not restyle `gs-*` base classes.
- Each feature exports one page from `features/<name>/index.tsx`. Names and props are fixed in `routes.tsx`.
- States required for every async view: loading, empty, error (`gs-error`, actionable text), success. Visible focus, keyboard reachable, 32px minimum target height, labels on every input.
- Routes (hash): `/library`, `/stack/:stackId`, `/stack/:stackId/card/:cardId`. Navigate with `navigate()` or `Link` from `app/router`.

## 3. State and data rules

- Persisted data lives in IndexedDB through `StackRepository` (`@ghoststack/shared-contracts`). Get it with `useServices().stacks`. Features never import `idb`.
- Every Stack change goes through `applyCommand` from `@ghoststack/domain`, then `stacks.save`. No ad hoc object mutation.
- The domain-side packages (`domain`, `shared-contracts`, `project-format`) import no React, DOM, `idb`, or Vite.
- Ids: `crypto.randomUUID()` at the UI edge. Timestamps: `new Date().toISOString()` at the UI edge. Pass them into the domain.
- No mock data, no hardcoded sample rows, no `localStorage` for project data. Test fixtures live next to tests only. `fake-indexeddb` is allowed in unit tests only.
- No `eval`, `new Function`, or generated JavaScript. Lint enforces it.
- No secrets in code, logs or fixtures.

## 4. Shared types and entry points

Source of truth: `packages/shared-contracts/src`.

| Export | Meaning |
|---|---|
| `Stack`, `Card`, `Element`, `Asset`, `*Schema`, `FORMAT_VERSION` | Project model (zod) |
| `ProjectCommand`, `ApplyCommand` | Command union and signature |
| `StackRepository`, `StackSummary` | Storage port |
| `Result`, `ok`, `err`, `GhostError`, `ErrorCode` | Error handling |

Package entry points:

| Package | Exports | Status on `main` |
|---|---|---|
| `@ghoststack/domain` | `createStack`, `validateStack`, `applyCommand` | `applyCommand` returns `INVALID_PATCH_COMMAND` (stub). Worktree `domain` implements it |
| `@ghoststack/storage` | `createIdbStackRepository`, `StorageError` | Implemented, tested |
| `@ghoststack/project-format` | none yet | Worktree `format` implements `exportGsp`, `importGsp` |

## 5. Worktrees for M1 and early M2

Branch `feature/<name>`, worktree at `.worktrees/<name>`. Folder ownership is exclusive.

| Worktree | Slice | Owns | Must deliver |
|---|---|---|---|
| `domain` | VS-02 domain | `packages/domain/**` | `applyCommand` for all `ProjectCommand`s, deletion safety (entry card, last card), invariants kept, tests |
| `format` | VS-06 | `packages/project-format/**` | `exportGsp(stack): Uint8Array`, `importGsp(bytes): Result<Stack>`, manifest and checksum validation, round-trip tests. Needs approval for an archive library (see HANDOFF) |
| `library` | VS-01 | `apps/web/src/features/project-library/**` | List, create, rename, delete Stacks via `useServices().stacks`; open navigates to `/stack/:id`. Import and export buttons wait for `format` |
| `workspace` | VS-02 UI | `apps/web/src/features/workspace/**` | Card navigator (add, rename, duplicate, reorder, delete, select) via `applyCommand` + `save`; selected card in URL; canvas slot shows card title only |

No worktree writes outside its owned folder. Cross-worktree needs go through the contract above.

## 6. HANDOFF.md (required, at worktree root, short)

1. Files touched
2. Exported entry points
3. Env, schema, dependency changes requested
4. Caveats and known gaps
5. What the next step needs
6. Commands run and results

## 7. Done means

`npm run typecheck`, `npm run lint`, `npm test`, `npm run build` pass in your worktree, with tests for what you added. Report only commands you ran.
