# M2.7 Behavior lists: requirements

Closes U14 (docs/AUDIT-M2.md). Contract and runtime for lists are on `main` (commit 3821118). This spec covers the GhostScript parser, name references, error line mapping and the editors. Owner paths: `packages/behavior/**`, `apps/web/src/features/behavior-editor/**`, `tests/e2e/m2x-behavior.spec.ts`.

## Requirements

1. **Parser accepts the printer's lists.** The parser accepts exactly the locked syntax: `next card`, `previous card`, `list add K = e`, `list remove K at e`, `list set K at e = e`, `list clear K`, `length(K)`, `item(K, e)`, `join(K, "sep")`.
   - Anything else (missing `at`, missing separator, `length(1)`) is a parse error with line and column.
2. **Round trip.** For every valid AST, including the new actions and expressions, `parse(print(x))` equals `x`.
3. **Names.** A quoted card or element reference is read as an id when one matches, else as a name when exactly one entry has it. The printer writes a name only when reading it back gives the same id. The stored AST holds ids.
4. **Error lines.** A domain rejection (unknown card, element or variable, non-list use, duplicate id, trigger placement) is reported on the script line that holds the offending reference, else on the behavior header. Schema failures are reported on the line of their behavior.
5. **Blocks read as sentences.** Each behavior shows one sentence ("When Button 1 is clicked, add "a" to items, then go to the next card") and can collapse. Move and remove controls have visible text.
6. **Blocks for every new action and expression.** `nextCard`, `prevCard`, `listAdd`, `listRemove`, `listSet`, `listClear`, `listLength`, `listItem`, `listJoin` (with a separator choice). List actions are disabled with a reason until a list variable exists.
7. **State editor.** A variable can have type `list`. Its starting items can be added, edited (text, number, true / false) and removed, up to 1000.
8. **Inventory works.** In the editor and in preview: type in an input, press Add, the list shows on a text element through `setText` + `listJoin`, press Remove and the last item disappears.
9. **No new contract.** No change to `shared-contracts`, `domain`, any `package.json` or lockfile.

## Failure cases

- Malformed list syntax gives a diagnostic, never a throw.
- A name used by two elements stays as typed and the domain reports it as unknown.
- A list action on a scalar variable, or `setState` on a list, shows the domain message on the right line.
