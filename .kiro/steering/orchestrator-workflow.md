---
inclusion: manual
---

# GhostStack: Orchestrator Workflow (manual: run as `/orchestrator-workflow`)

Use this when one milestone chunk is split across parallel worktrees. It is the codified form of the project owner's orchestration prompt; the original wording stays at the top of `docs/MILESTONE.md`.

## Phase 1: Prep and shared contract (on `main`, before any worktree)

1. Read `docs/PRD.md`, `docs/ARCHITECTURE.md`, `HANDOFF.md`, `docs/CHANGELOG.md` and inspect the code. Check `git status`, stale worktrees and branches. Run the full gate on `main`.
2. Lock what every slice shares: `docs/UI_CONTRACT.md`, shared types and schemas, theme tokens, shell and layout, router and routes. Placeholders are better than missing exports. Commit.
3. Write one brief per worktree in `docs/handoffs/<milestone>/`: owned folders, exports with fixed names, acceptance criteria, tests, port. Add a README with the rules every slice shares.

## Phase 2: Plan and isolate

- `git worktree add .worktrees/<name> -b feature/<name>`, then `npm ci` in each. One dev server port per worktree (`GS_PORT`).
- Exclusive folder ownership. No second navbar, layout or theme. Central files are read-only for worktrees; the `guard-writes` hook enforces it.
- Real storage and real commands only. No mock data, no hardcoded rows.
- Every slice ends with a `HANDOFF.md`: files touched, exported entry points, contract changes requested, caveats, what the next step needs, commands actually run.

## Phase 3: Merge, wire and verify

- Review each handoff against the diff, not against its claims. Merge into `main` with `--no-ff`. Wire the pieces in the central files.
- Audit for mock or hardcoded data with a search. Run the full gate: typecheck, lint, format check, unit tests, build, end-to-end tests (start the dev server yourself first).
- Drive the app with Playwright for the real user flows, persistence and navigation. Fix regressions, then rerun everything.

## Phase 4: Docs sync and handoff

- Update CHANGELOG, ARCHITECTURE, MILESTONE and `docs/KIRO-USAGE.md` where they changed. Run `npm run evidence` (regenerates `docs/KIRO-EVIDENCE.md` from the hook log, specs and git history) and fold what actually happened into `docs/KIRO-USAGE.md` sections 4.2 to 4.4. Remove worktrees and merged branches.
- Write a short root `HANDOFF.md` for the next fresh session: completed work, contracts, caveats, next steps. The `session-brief` hook reads the repository state at the start of that session.

Report only what was run. Say plainly what was skipped or could not be verified.
