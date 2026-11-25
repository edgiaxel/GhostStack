# Brief: history (VS-07)

Branch `feature/history`, port 5183. PRD F-015, F-016, F-017, F-019 (lookup side). ARCHITECTURE 4.4 (autosave and recovery).

## Own

`apps/web/src/features/history/**`, `packages/storage/**` additions only (the v2 schema and the three repositories are final), `tests/e2e/m2-history.spec.ts`. Replace the placeholder `HistoryControls` and add `features/history/session.ts` exporting `createStackSessionFactory`.

## Build: `createStackSessionFactory`

Signature: `createStackSessionFactory(deps: { stacks: StackRepository; checkpoints: CheckpointRepository; debounceMs?: number; now?: () => string }): StackSessionFactory`. Implements `StackSession` exactly as documented in `packages/shared-contracts/src/session.ts`. The orchestrator swaps it for `createPassthroughSessionFactory` in `app/services.tsx` at merge. Use `apps/web/src/app/passthroughSession.ts` as the behavioral baseline.

- `open(stackId)`: load the Stack, `STACK_NOT_FOUND` when absent, `STORAGE_FAILED` on read errors. Check for a `recovery` checkpoint and restore it when it is newer than the saved Stack (see recovery).
- `dispatch(command, { coalesceKey })`: validate through `applyCommand`, record one undo entry, schedule the save. A failed command changes nothing and records nothing. Dispatches with the same `coalesceKey` in a row become one entry.
- Undo and redo: snapshot based, bounded (100 entries), redo cleared by a new dispatch, `canUndo` and `canRedo` in the status, `undo()` and `redo()` return false when empty. Restored Stacks get a fresh `updatedAt`.
- `restore(snapshot)`: one undoable step, same checks as the passthrough.
- Autosave: debounced (default 600 ms). Status moves `saved` to `dirty` to `saving` to `saved` or `error`. A failed save keeps the data in memory, shows the error, and retries on the next change or on `flush()`. Saves never overlap and the last state always wins. `flush()` saves immediately and resolves when durable.
- Recovery: after each dispatch write a `recovery` checkpoint with id `recovery:<stackId>` (kind `recovery`, overwrite) so a closed or crashed tab loses nothing. After a durable main save, delete it. On `open`, a recovery checkpoint newer than the stored Stack is applied, saved, and flagged with `recovered: true` in the status. The recovered Stack must pass `validateStack`, otherwise discard it and keep the saved Stack.
- `dispose()` clears timers and listeners without losing data (the host calls `flush()` first).
- Referentially stable `getStack()` and `getStatus()` between changes.

## Build: `HistoryControls`

Takes `EditorSlotProps` and renders in the workspace toolbar.
- Undo and Redo buttons (disabled with reason when empty) and shortcuts Ctrl or Cmd+Z and Ctrl+Shift+Z or Ctrl+Y that do not fire inside text inputs.
- Save status text with a retry action on error. A `beforeunload` guard while `dirty` or `saving`, and a flush on `visibilitychange` to hidden.
- Recovered notice: "Restored unsaved changes from your last session" with a dismiss.
- Checkpoints: "Save checkpoint" with a label (`checkpoints.put`, kind `manual`), a list from `checkpoints.list(stackId)` newest first, and Restore with a confirmation that calls `session.restore(checkpoint.stack)`. Also create an `auto` checkpoint before a restore so restore is itself reversible. Keep at most 20 `auto` checkpoints per Stack.
- Missing assets: when `stack.assetRegistry` lists assets whose bytes are absent from `assets` (use `useServices().assets.get`), show a count and the names so the creator knows what to re-upload.
- Every control labelled, loading, empty and error states present.

## Acceptance

- Edit, wait, reload: the edit persists. Edit and reload within the debounce window: the edit comes back with the recovered notice.
- Undo and redo work for every `ProjectCommand`, including Card delete (restores Cards and their references), element commands and state schema.
- Restoring a checkpoint replaces the Stack and can be undone.
- A save failure is visible and recoverable.

## Tests

- Unit with fake timers and `fake-indexeddb`: debounce, coalescing, undo and redo bounds, save ordering, failed save then retry, recovery on reopen after an abandoned session, invalid recovery discarded, checkpoint prune.
- Property (`fast-check`): for any valid command sequence, undoing every step returns the original Stack and redoing every step returns the final Stack; `getStack()` always passes `validateStack`.
- jsdom: `HistoryControls` buttons, shortcuts ignored in inputs, checkpoint list.
- `tests/e2e/m2-history.spec.ts`: create a Stack, add and rename and delete Cards (these are the edits available through the navigator), undo and redo through the buttons and shortcuts, reload recovery within the debounce window, save a checkpoint, make an edit, restore, undo the restore.

## Other worktrees you rely on

None. Element edits arrive from `card-editor` later. Test them at the session level with `applyCommand`-valid commands.