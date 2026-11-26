---
inclusion: auto
name: property-testing
description: Use when writing or reviewing property-based tests, spec correctness properties, or invariants for domain commands, layout math, GhostScript, behavior runtime, undo and redo, storage or the .gsp format.
---

# GhostStack: Property-Based Testing

Use `fast-check` (already a dev dependency) next to the example tests. In the Kiro IDE, spec Correctness can extract properties from EARS requirements; ask for them in the spec for any chunk that defines an invariant. Property tests are written as universal rules, not examples.

## Properties already in the repository (extend these, do not duplicate)

| Area | Property | File |
|---|---|---|
| GhostScript | `parse(print(ast))` equals `ast` for generated ASTs; the parser never throws on arbitrary text | `packages/behavior/src/ghostscript.test.ts` |
| Runtime | Never throws for random valid behaviors; never mutates the Stack | `packages/behavior/src/runtime.test.ts` |
| Layout | Identity at the design size; anchors keep edge distances | `packages/shared-contracts/src/layout.test.ts` |
| Z-order | `zIndex` stays a permutation of `0..n-1` after any placement sequence | `packages/domain/src/elements.test.ts` |
| Canvas geometry | Resizing keeps the opposite edge fixed and respects the minimum size | `apps/web/src/features/card-editor/geometry.test.ts` |
| History | Undoing every step returns the original Stack; redoing returns the final one | `apps/web/src/features/history/session.test.ts` |
| `.gsp` | Export then import returns an equal Stack and assets | `packages/project-format/src/gsp.test.ts` |

## Rules

- State the invariant in one sentence in the test name. Use `numRuns` of at least 100 for pure functions, fewer when each run touches IndexedDB.
- Constrain generators to inputs the contract allows (for example path-safe card ids for `.gsp`), and say why in a comment. A failing property is either a bug or a missing constraint; decide which and record it.
- Do not weaken a property to make it pass. If a counterexample is harmless, document it where the behavior is defined.
- Candidates for the next chunks: M2.5 move, align, paste and delete keep every element valid and undo restores the exact Stack; M2.6 `scale` mode preserves proportions; M2.7 list operations never throw and keep the print and parse round trip.
