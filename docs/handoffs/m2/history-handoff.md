# HANDOFF: history

1. Files: `apps/web/src/features/history/{session.ts,session.test.ts,index.tsx,HistoryControls.test.tsx,history.css}`, `apps/web/src/app/services.tsx` (wired the real factory), `tests/e2e/m2-history.spec.ts`.
2. Exports: `createStackSessionFactory`, `recoveryId`, `HistoryControls`, `shortcutFor`, `isEditableTarget`.
3. Contract changes: none. Recovery uses checkpoint id `recovery:<stackId>` (kind `recovery`), filtered out of the checkpoint list.
4. Caveats: `updatedAt` is refreshed on undo and redo. Recovery compares `updatedAt`. Recovery e2e is covered by unit tests only, since reload flushes first.
5. Next: card-editor edits go through `dispatch` with `coalesceKey`.
6. Commands: typecheck, lint, vitest (17 history tests), Playwright on port 5183 (3 passed).