# HANDOFF: M3.1 ai-core (`feature/m3-ai-core`)

## 1. Files touched

All inside `packages/ai-core/src/` (no central file edited):

- Product: `index.ts`, `plan.ts`, `dry-run.ts`, `summary.ts`, `context.ts`, `actions.ts`, `transaction.ts`, `provider-error.ts`, `util.ts`.
- Test support (never imported by product code): `testing.ts` (in-memory `StackSession`, plan builders, quiz and recipe fixture plans).
- Tests: `plan.test.ts`, `dry-run.test.ts`, `summary.test.ts`, `context.test.ts`, `provider-error.test.ts`, `transaction.test.ts`, `gsp.test.ts`, `properties.test.ts` (129 tests).
- This `HANDOFF.md` replaces the root `HANDOFF.md` of `main` inside this branch. Keep the `main` version when merging and move this text to `docs/handoffs/m3/`.

## 2. Exported entry points (`@ghoststack/ai-core`)

README table names:

- `parsePlan(input: unknown): Result<AIPlan>`: never throws; returns a fresh JSON copy.
- `dryRunPlan(stack, plan, now, options?): Result<DryRunResult, DryRunError>`.
- `summarizePlan(stack, plan): PlanSummary`.
- `buildContext(stack, scope, options?: { budget? }): Result<ProjectContext>`.
- `runTransaction(session, plan, options: TransactionOptions): Promise<Result<TransactionOutcome>>`.
- `revertOperation(session, report: OperationReport): Result<Stack>` (synchronous).
- `normalizeProviderError(failure: ProviderFailure, now: number | string): GhostError & { retryAfterMs? }`.
- `getRegisteredActions(): { type; description }[]`.
- Types `PlanSummary`, `TransactionOptions`, `DryRunResult`.

Additional exports (spec needs them or the UI needs them to use the above):

- Functions: `serializePlan`, `orderSteps`.
- Constants: `DEFAULT_CONTEXT_BUDGET` (24,000), `MAX_RETRY_AFTER_MS` (300,000).
- Types: `DryRunError`, `DryRunOptions`, `DryRunStepResult`, `CardChangeGroup`, `StackChangeGroup`, `CardChangeState`, `ContextOptions`, `TransactionProgress`, `TransactionOutcome`, `OperationReport`, `CheckpointWriter`, `ProviderFailure`, `NormalizedProviderError`.

Shapes the UI slice needs:

- `TransactionOptions = { approvedPlan: string; checkpoints: { put(Checkpoint) }; now: ISO string; newId: () => string; signal?; onProgress?(TransactionProgress); inject? }`. `approvedPlan` must be `serializePlan(plan)` taken when the user pressed Approve. A plan edited after that is refused.
- `TransactionOutcome = { state: 'done'; report: OperationReport } | { state: 'cancelled' }`. Failures are `err` with `CHECKPOINT_FAILED`, `TRANSACTION_FAILED`, `INVALID_PATCH_COMMAND` or `PROJECT_VALIDATION_FAILED`. Dry-run errors carry `stepId` and `stepIndex` when a step failed.
- `TransactionProgress` extends the contract's `AIOperationProgress` with `phase` (`checkpoint`, `step`, `validate`, `commit`, `finish`).
- `DryRunResult = { status: 'ok'; stack; steps } | { status: 'cancelled'; steps }`.
- `PlanSummary = { summary, stepCount, cards: CardChangeGroup[], stack: StackChangeGroup }`. Each group has plain `sentences` and `stepIds`; every step id is in exactly one group.
- Allowlist and limits are not redefined: use `AI_ALLOWED_COMMAND_TYPES`, `MAX_PLAN_STEPS`, `MAX_PLAN_BYTES` from `shared-contracts`.

## 3. Env, schema, dependency and contract changes requested

1. `packages/ai-core/package.json`: add `"@ghoststack/project-format": "^0.0.0"` under `devDependencies` (used by `gsp.test.ts` only). It resolves today through the workspace symlink, so nothing fails without it. Not edited here (central file).
2. Optional: export `deepClone` from `@ghoststack/domain`. `ai-core/src/util.ts` has a 6-line local `clone` because the domain does not export one.
3. Optional: add an `omittedSections: string[]` field to `ProjectContext`. The spec asked for a list of omitted sections; the locked contract has only `truncated: boolean`, so only that is set.
4. Spec naming differences, README names win: spec says `normalizeProviderFailure`, exported as `normalizeProviderError`.
5. No new runtime dependency. `zod` is not imported directly; schemas come from `shared-contracts`.

## 4. Caveats and known gaps

- Decisions taken where the spec was open:
  - Approval marker is the serialized plan text (`approvedPlan`), compared with `serializePlan(plan)`.
  - `orderSteps` returns `Result` (a cyclic or dangling plan that skipped `parsePlan` is an error, not a silent order).
  - Step `dependsOn` is explicit only; unconstrained steps keep array order.
  - Pre-operation checkpoint: kind `recovery`, label `Before AI: <summary>` cut at 160 characters.
  - A cancelled operation (before commit) leaves the checkpoint it already wrote. Not deleted.
  - `revertOperation` compares the current Stack to `report.resultStack` by deep equality.
  - `normalizeProviderError` takes `now` as epoch ms or ISO string; Retry-After cap is 5 minutes.
- `buildContext` truncation order: detail Cards from the end, behaviors to summaries, detail dropped, Card list and `cardOrder` cut from the end, `stateSchema` emptied. Title and registered actions are never cut, so a budget below their size (about 1.7k characters) is not met; the result is then flagged `truncated` and `charCount` shows the true size. In card scope, the scoped Card can fall off the Card list in the last cuts.
- Context strings are cut at 400 characters and data URLs are replaced by `[data omitted]` (values and keys).
- `parsePlan` messages include model-supplied text (command type, step id, schema path) cut to 80 to 120 characters. They never include keys: ai-core has no key input.
- The summary says "Adds a card named X ..." in plain sentences. English only, no localisation.
- The in-memory session in `testing.ts` follows the `StackSession` contract but is not the real session from `storage`. The real `createStackSessionFactory` `restore` was not exercised from ai-core (storage import is out of bounds); M3.4 wiring must check `restore` plus undo with the real session.
- Not verified: behavior in a browser (no UI in this slice), no e2e (none in the brief).
- Test-flake note: the first full `npm test` showed one failure in a Testing Library `waitFor` timeout inside an `apps/web` test, not in ai-core. Three later full runs were green (484 tests). I did not investigate the web test.

## 5. What the next step needs

- M3.3 (UI): `parsePlan` then `dryRunPlan` then `summarizePlan` for review; disable Approve while the dry run is an `err` (use `error.stepId` to mark the step). On Approve, call `runTransaction` with `approvedPlan: serializePlan(plan)`, a `CheckpointRepository` (`put` only) and `newId`. Show `onProgress` messages. Use `revertOperation` for "Revert AI change".
- M3.2 adapters do not import `ai-core`. The UI runs `parsePlan` on adapter output. For transport failures the UI can call `normalizeProviderError` with a `ProviderFailure`, or the adapter can keep its own mapping.
- M3.5 (MCP) uses `parsePlan` and `dryRunPlan` directly.

## 6. Commands run and results (worktree `.worktrees/m3-ai-core`)

- `npx vitest run packages/ai-core`: 8 files, 129 tests passed.
- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0.
- `npm run format:check`: exit 0 ("All matched files use Prettier code style!").
- `npm test`: first run 483 of 484 passed (1 `apps/web` waitFor timeout, see section 4); three reruns: 51 files, 484 tests, all passed.
- `npm run build`: exit 0.
- Not run: Playwright e2e, `playwright-cli` (no UI in this slice).
