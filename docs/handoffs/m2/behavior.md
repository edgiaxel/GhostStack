# Brief: behavior (VS-04)

Branch `feature/behavior`, port 5182. PRD F-006, F-007, F-008, F-013. DESIGN: DQ-002 (vertical slot-based action stack), DQ-003 (CodeMirror 6 with highlighting, autocomplete, live diagnostics).

## Own

`packages/behavior/**`, `apps/web/src/features/behavior-editor/**`, `tests/e2e/m2-behavior.spec.ts`. Replace the skeleton in `packages/behavior/src/index.ts` and the placeholder `BehaviorEditorPanel`. Keep exported names and the `EditorSlotProps` props.

## The AST is fixed

`packages/shared-contracts/src/behavior.ts` defines triggers (`card.enter`, `element.click`, `element.change`), actions (`navigate`, `setState`, `setText`, `show`, `hide`, `if`) and expressions (`literal`, `state`, `not`, `binary`). Do not extend it. Need something new? Write it in `HANDOFF.md` section 3 and use what exists.

## Build: runtime (`createRuntime`)

- `start()`: state from `stack.stateSchema` initials, element state (`visible` from `properties.visible !== false`), then run `card.enter` behaviors of the start Card.
- `dispatch(event)`: run enabled behaviors of the target with the matching trigger in array order. All `conditions` must be truthy. Run `actions` in order.
- `element.change`: first write the typed value to the input's `properties.stateKey` when set (the value must satisfy the variable type, else report an issue), then run the behaviors.
- `navigate`: switch `cardId`, reset element state for the new Card, run its `card.enter` behaviors. Guard against loops with limits (actions per dispatch, chained navigations) and report an issue when hit.
- Expressions: numbers support `+ - * / %` and comparisons. `+` on strings concatenates. `and`, `or`, `not` use truthiness (`false`, `0`, `''` are falsy). Division by zero and type mismatches add an issue and leave the target unchanged. `setState` must keep the declared variable type.
- `setText` works on text and button elements only. `show` and `hide` set `visible`. Unknown ids add an issue.
- Errors never throw and never mutate the Stack. They go to `snapshot.errors` (cap the list). The Stack passed in must stay deep-equal after any run (test with a deep freeze).
- Pure: no DOM, no timers, no I/O. Never `eval` or `new Function`.

## Build: GhostScript (`parseGhostScript`, `printGhostScript`)

- Line-oriented, readable, constrained text for exactly the AST above. You design the grammar and document it in `packages/behavior/GHOSTSCRIPT.md` with examples.
- Elements are referenced by `elementId`. The editor may show element names as comments, but parsing must not depend on them.
- `parse(print(behaviors))` deep-equals `behaviors` for every valid AST, including nested `if`, empty branches, disabled behaviors and string escapes. Prove it with a `fast-check` property test over generated ASTs.
- Parse errors carry 1-based line and column. Reject anything outside the grammar. No expressions beyond the AST, no calls, no identifiers other than state keys.

## Build: editor (`BehaviorEditorPanel`)

Renders in the drawer for the selected element, or for the Card when nothing is selected.
- Tabs: Blocks and GhostScript. Both edit the same working `Behavior[]`. Switching tabs prints or parses from the current AST. The panel writes with `UPDATE_BEHAVIOR`.
- Blocks: per behavior a trigger select (only triggers valid for the owner), enabled toggle, conditions, and an ordered action stack with add, remove and move up or down. Forms per action type. `if` nests then and else stacks. An expression editor for conditions and values (literal, state variable, not, binary with operator select).
- GhostScript: CodeMirror 6 (`codemirror`, `@codemirror/state`, `@codemirror/view`, `@codemirror/language`, `@codemirror/lint` are installed). Syntax highlighting through `StreamLanguage`, autocomplete for keywords, state keys, card ids and element ids, live diagnostics from the parser and from a dry run of `applyCommand(stack, UPDATE_BEHAVIOR...)`. Dispatch only when the script parses and the dry run passes. Keep the editor text when it is invalid.
- State variables: add, rename-by-recreate, delete, type and initial value through `UPDATE_STATE_SCHEMA`. The domain rejects removal of a key still in use, so show that message.
- Dispatch with `coalesceKey` while typing.
- States: no owner behaviors (empty with a next step), invalid script (diagnostics list), domain rejection (message).

## Acceptance

- A creator builds "button click, if score >= 3 then go to Card 2 else set label text" with blocks, switches to GhostScript, sees equivalent text, edits it, switches back and sees the change.
- Invalid navigate targets and unknown state keys are reported before dispatch.
- The runtime never throws for any `Stack` that passes `validateStack`.

## Tests

- Unit: every action and trigger, conditions, branching, navigation chain, loop guard, type mismatch, division by zero, immutability, determinism.
- Property: AST round trip through print and parse, runtime does not throw on generated valid Stacks.
- jsdom: blocks editor dispatches the expected `UPDATE_BEHAVIOR`, GhostScript diagnostics.
- `tests/e2e/m2-behavior.spec.ts`: the acceptance scenario above. Your branch has no element palette yet, so the spec writes its starting Stack (Cards plus elements) into the real `ghoststack` IndexedDB through `page.evaluate`, then drives the editor through the UI. The fixture lives in the spec file. Check that behaviors survive a reload.

## Other worktrees you rely on

Elements come from `card-editor`. On your branch the canvas is a placeholder, so tests use Stacks built with the real domain package and stored in the real IndexedDB, never mocks of either.