# GhostScript

Constrained text form of the canonical behavior AST. `parseGhostScript(printGhostScript(x))` equals `x` for every valid AST. With names, `parseGhostScript(printGhostScript(x, refs), refs)` equals `x` for every id that `refs` lists.

```
// comment
behavior "check" on element.click {
  when score >= 3 and not done
  set done = true
  if score >= 3 {
    go "Results"
  } else {
    text "Message" = "Try " + "again"
    hide "Answer"
  }
}

behavior "add" on element.click {
  list add items = "milk"
  list remove items at length(items) - 1
  list set items at 0 = item(items, 1)
  text "Shopping list" = join(items, "\n")
  next card
}
```

## Grammar

- `behavior "<id>" on <trigger> [disabled] { ... }`. Triggers: `card.enter`, `element.click`, `element.change`.
- `when <expr>` lines (zero or more, first) must all be truthy.
- Actions:
  - `go "<card>"`, `next card`, `previous card` (the last two do nothing at the end or the start of `cardOrder`)
  - `set <var> = <expr>` (scalar variables only)
  - `text "<element>" = <expr>`, `show "<element>"`, `hide "<element>"`
  - `list add <list> = <expr>`, `list remove <list> at <expr>`, `list set <list> at <expr> = <expr>`, `list clear <list>`
  - `if <expr> { ... } [else { ... }]`
- Expressions: numbers, strings, `true`, `false`, variable names, `not`, parentheses and `or`, `and`, `== != < <= > >=`, `+ -`, `* / %` in that precedence order, left associative.
- List expressions (the only calls): `length(<list>)`, `item(<list>, <expr>)`, `join(<list>, "<separator>")`. The separator is a string of at most 20 characters. Indexes start at 0.
- Variable names that are not plain identifiers or are keywords (`behavior on disabled when go set text show hide if else and or not true false next previous card list add remove clear at length item join`) are written `@"name"`.
- No other calls, no property access, no other syntax.

## References by name

`"<card>"` and `"<element>"` are quoted. The parser reads the text as an id when a card (or an element of the owning card) has that id, otherwise as a name (card title, element name) when exactly one has it. The AST always stores ids. The printer writes the name when the name is unique and reads back to the same id, else the id. Text that matches nothing stays as typed, and the domain reports it as unknown. Behavior ids are always written as is.

## Errors

`parseGhostScript` never throws. It returns the first problem with a 1-based line and column. A schema failure (for example a separator over 20 characters) is reported on the line of its behavior. `locateDomainIssue(source, message)` maps a domain rejection to the line that holds the offending reference, else to the behavior header.

## Runtime

Truthiness (`false`, `0`, `""` are falsy), `+` concatenates when either side is text, division by zero and type mismatches add an issue and leave the target unchanged, `go` ends the running event, 1000 actions or 20 card changes per event stops it. A list holds at most 1000 scalar items. An index outside the list adds an issue and changes nothing.
