# GhostScript

Constrained text form of the canonical behavior AST. `parseGhostScript(printGhostScript(x))` equals `x` for every valid AST.

```
// comment
behavior "check" on element.click {
  when score >= 3 and not done
  set done = true
  if score >= 3 {
    go "card-2"
  } else {
    text "label" = "Try " + "again"
    hide "button"
  }
}
```

- `behavior "<id>" on <trigger> [disabled] { ... }`. Triggers: `card.enter`, `element.click`, `element.change`.
- `when <expr>` lines (zero or more, first) must all be truthy.
- Actions: `go "<cardId>"`, `set <var> = <expr>`, `text "<elementId>" = <expr>`, `show "<elementId>"`, `hide "<elementId>"`, `if <expr> { ... } [else { ... }]`.
- Expressions: numbers, strings, `true`, `false`, variable names, `not`, parentheses and `or`, `and`, `== != < <= > >=`, `+ -`, `* / %` in that precedence order, left associative.
- Variable names that are not plain identifiers or are keywords are written `@"name"`.
- Ids are quoted strings. Elements are referenced by id.
- No calls, no property access, no other syntax.

Runtime rules: truthiness (`false`, `0`, `""` are falsy), `+` concatenates when either side is text, division by zero and type mismatches add an issue and leave the target unchanged, `go` ends the running event, 1000 actions or 20 card changes per event stops it.
