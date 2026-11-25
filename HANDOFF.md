# HANDOFF: domain (VS-02)

## 1. Files touched
- `packages/domain/src/apply-command.ts` (+ `.test.ts`): command reducer
- `packages/domain/src/validate.ts`: `validateStack` moved out of `index.ts` (avoids an import cycle)
- `packages/domain/src/deep-clone.ts`: plain-data deep copy (no DOM lib, so no `structuredClone`)
- `packages/domain/src/index.ts`: re-exports

## 2. Exported entry points
`@ghoststack/domain`: `createStack`, `validateStack`, `applyCommand` (unchanged names and signature).

## 3. Env, schema, dependency changes requested
None.

## 4. Caveats and known gaps
- Empty or whitespace-only titles are rejected for RENAME_STACK, ADD_CARD, RENAME_CARD.
- ADD_CARD `index` must be an integer in 0..cardOrder.length.
- DUPLICATE_CARD keeps element ids as-is (scoped per card); title is `"<title> copy"`.
- If the input stack is already invalid, the result is `PROJECT_VALIDATION_FAILED`.
- Property check is a hand-rolled seeded loop (40 seeds x 60 steps); fast-check not needed.

## 5. What the next step needs
`workspace` calls `applyCommand(stack, cmd, new Date().toISOString())` then `stacks.save`, passing new ids from `crypto.randomUUID()`.

## 6. Commands run and results
In the worktree: `npm run typecheck`, `npm run lint`, `npm test` (20 passed), `npm run format:check`, `npm run build`: all passed.
