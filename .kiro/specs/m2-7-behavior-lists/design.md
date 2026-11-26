# M2.7 Behavior lists: design

## Parser (`packages/behavior/src/ghostscript.ts`)

- New keywords: `next previous card list add remove clear at length item join`. A variable with one of these names prints as `@"name"`, so existing Stacks stay readable.
- `,` joins the operator set. `length`, `item` and `join` are list calls only when followed by `(`.
- `parseGhostScript(source, refs?)` and `printGhostScript(behaviors, refs?)` take `GhostScriptRefs { cards, elements }` (`{ id, name }`). The resolver reads an exact id first, then a unique name. The printer writes a name only if the resolver maps it back to the same id, which keeps the round trip exact. Unknown ids are written as is.
- `locateDomainIssue(source, message)` maps `validateStack` messages to `{ line, column }`: find the behavior header named in the message, then the first line in that behavior that holds the subject extracted from the message. Fallback: the header line, then line 1.

## Editor (`apps/web/src/features/behavior-editor`)

- `EditorContext` splits `stateKeys` (scalars) from `listKeys`. Expression kind and action pickers offer list kinds only when a list exists.
- `describeBehavior` / `describeAction` / `describeExpr` (pure, in `model.ts`) build the sentences.
- `BehaviorBlocks`: a summary row (Collapse / Expand button with `aria-expanded` plus the sentence). Collapsed bodies stay mounted with `hidden`, so drafts survive. Actions come from a grouped select (Cards, Elements, Variables, Lists, Logic).
- `ScalarEditor` (new, shared by expressions and list items). `StateEditor` gains `list` and a `ListItems` group.
- The script tab passes `refs` to print, parse and check, so scripts show names and diagnostics land on the right line.

## Correctness properties

- P1: `parse(print(x)) = x` over ASTs with list actions and expressions and keyword-like variable names.
- P2: `parse(print(x, refs), refs) = x` for ids that `refs` knows.
- P3: the parser never throws on arbitrary text.
- P4: list actions never throw in the runtime and never exceed 1000 items (`lists.test.ts`).
