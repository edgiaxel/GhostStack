# HANDOFF: M3.3 AI panel and approval workflow (`feature/m3-ai-ui`)

This file replaces the M2 `HANDOFF.md` of `main` inside this branch. On merge keep the `main` version and move this text to `docs/handoffs/m3/m3-3-result.md`.

## 1. Files touched

All inside `apps/web/src/features/ai/` (except `bridge/**`, not touched) plus `tests/e2e/m3-ai.spec.ts`.

- Entry: `index.tsx` (replaces the placeholder bodies; `AIPanelProps`, `AIStatusChipProps` unchanged), `AIPanel.tsx`, `ai.css`.
- Views: `SettingsView.tsx`, `PromptView.tsx`, `ReviewView.tsx`, `StatusViews.tsx` (planning, applying, report, reverted, consent dialog), `ErrorPanel.tsx`, `ProposalsList.tsx`, `ProviderBadge.tsx`.
- Logic: `store.ts` (provider settings, in-memory key, connection state, session consent), `settings.ts` (`gs.ai.settings` in localStorage, sanitizer), `operation.ts` (controller: submit, consent, cancel, review, approve, reject, revise, revert, proposals; `evaluatePlan`), `errors.ts` (copy and next action for every `ErrorCode`).
- Not changed: `proposals.ts` (locked), `features/workspace/**`, every central file.
- Tests: `settings.test.ts`, `errors.test.ts`, `store.test.ts`, `operation.test.ts`, `AIPanel.test.tsx`, `testing.ts` (test support, never imported by product code).

## 2. Exported entry points

- `AIPanel`, `AIStatusChip`, types `AIPanelProps`, `AIStatusChipProps` from `features/ai/index.tsx`.
- Internal but importable: `providerStore`, `createProviderStore`, `useProviderState` (`store.ts`); `getOperationController`, `createOperationController`, `evaluatePlan` (`operation.ts`); `presentError` (`errors.ts`).
  Behavior:
- Prompt plans go `generatePlan` then `parsePlan` then review. Review re-runs `dryRunPlan` against the live Stack on every Stack change; Approve is disabled while any step fails, and `approve()` re-checks in code.
- Approve calls `runTransaction` with `approvedPlan: serializePlan(plan)`, the real `useServices().checkpoints`, and the real session. Revert calls `revertOperation`.
- Proposals from `proposals.ts` render in the Assistant tab, open in the same review UI (no Revise), apply only after Approve, and leave the queue on apply, Reject or Dismiss.
- Remote consent: any adapter with `capabilities.local === false` needs a per-session confirmation (dialog lists what is sent) before `generatePlan`. The gate is in the controller, not only in the dialog. Loopback hosts count as local, so the mock server in e2e does not trigger it; the dialog is covered by a component test.
- Settings: Demo, Ollama, OpenAI-compatible. Key is a password field held in module memory only. Non-secret settings persist at `gs.ai.settings`.
- Controllers are kept per Stack id, so a plan under review or a report survives closing the panel and opening the preview (which reopens the session).

## 3. Contract, dependency and config changes requested (not made)

1. `apps/web/package.json`: add `"@ghoststack/ai-core": "^0.0.0"` and `"@ghoststack/ai-providers": "^0.0.0"` to `dependencies`. They resolve today through the root workspace symlinks; the lockfile and `npm ci` need the entries.
2. `apps/web/package.json` or `eslint`: none. No new runtime dependency.
3. Optional, ai-core: `revertOperation` compares the Stack with `report.resultStack` by deep equality including `updatedAt`. Undo then redo changes `updatedAt`, so Revert is refused ("edited after the AI change") although content is equal. Ignoring `updatedAt` in that comparison would allow it.
4. Optional, shared-contracts: `GhostError.retryAfterMs` (the UI reads it as an extra property today). No cancel error code; the UI detects cancel through its own `AbortController`.
5. Optional, workspace: the dock is `position: fixed` and covers the Inspector while open. A grid column would avoid that.

## 4. Caveats and known gaps

- No live provider call was made. OpenAI-compatible was exercised against a local Node mock in e2e; Ollama only through unit tests of other packages and the settings form. Real Ollama (`OLLAMA_ORIGINS`) is unverified.
- E2E cannot reach the remote consent dialog (a remote host would need network). Covered by `AIPanel.test.tsx` with a stubbed `fetch` that must not be called before consent.
- "Panel throws" in e2e is simulated by aborting the lazy chunk request; the error boundary shown is the workspace `AIBoundary`. A render-time throw inside a loaded panel was not injected.
- Navigating to the preview reopens the session, so undo history is empty afterward. The AI report and Revert survive; manual undo of the AI step does not. Revert in that state restores the pre-AI Stack.
- Cancel while applying only takes effect before the commit; the commit is synchronous.
- Per-step failure text is the dry-run message, shown inside the collapsed command details, bounded to 240 characters. Error copy for codes that may echo model text (`INVALID_AI_PLAN`, `INVALID_PATCH_COMMAND`, `PROJECT_VALIDATION_FAILED`) shows fixed text and puts the bounded message under "Details".
- Connection state `not tested` is shown after saving until Test connection is pressed; no automatic network call is made.
- Decisions taken (recommended option): settings in localStorage `gs.ai.settings`; consent keyed by provider id plus base URL; no automatic connection test; Demo needs an explicit Save or Test to count as configured.
- Not covered by a test: Ollama form flow, keyboard-only walk of every state (axe scan covers provider tab, assistant tab, review and report).

## 5. What the next step needs

- Apply 3.1, then merge M3.3 after M3.1 and M3.2 (already on `main`). M3.5 only calls `enqueueProposal`; its proposals show in the Assistant tab.
- M3.4: rerun `audit-flows`, `m2-full-flow` and the M2.x specs; check preview and web export parity of demo quiz and recipe Stacks.
- M3.6: live run against a real OpenAI-compatible endpoint and Ollama.

## 6. Commands run and results (worktree `.worktrees/m3-ai-ui`)

- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0.
- `npm run format:check`: exit 0.
- `npm test`: 64 files, 730 tests passed.
- `npm run build`: exit 0. `npm run bundle:check`: initial entry chunk 285.4 kB (budget 350), player 108.6 kB (budget 140). The AI code is its own lazy chunk (about 66 kB).
- `GS_NO_WEBSERVER=1 GS_PORT=5203 npx playwright test tests/e2e/m3-ai.spec.ts` against `GS_PORT=5203 npm run dev`: 13 passed (Chromium).
- `playwright-cli`: opened the library, created a Stack, opened the panel with `a`, saved Demo, tested the connection, asked for a quiz plan (review screenshot), then asked for a recipe plan with Ctrl+Enter and approved (report with Revert shown, Cards (2)).
- Not run: the other e2e specs, other browsers, any live provider.
