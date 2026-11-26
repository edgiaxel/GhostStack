# Requirements: M2.4 Library, Navigator and Templates (closes U7, U11)
Source: MILESTONE M2.4, UI_CONTRACT section 8 (templates exception).
1. The library shows Stacks as a grid of cards: generated thumbnail of the first card, title, card count, updated time. Loading, empty, error and success states exist.
2. Search filters by title. Sort by updated, title or card count. An empty search result names the query and offers to clear it.
3. Each Stack card offers Open, Rename, Duplicate, Export (.gsp) and Delete (confirm first). Duplicate copies the Stack and its asset bytes under a new id.
4. First run (no Stacks) offers: create blank, choose a template, import a .gsp.
5. Templates: Blank, Branching quiz, Recipe collection, Inventory list, Interactive guide. Each is a function that builds a Stack through `createStack` and `applyCommand` only when the creator picks it. Nothing is stored or shown as a Stack before that.
6. Recipe and Inventory use list state, `listAdd`, `listRemove`, `listJoin`, `setText`.
7. Navigator: thumbnails, entry badge, drag reorder plus the keyboard move buttons, secondary actions revealed on hover or focus, delete confirmation names the number of references from `findCardReferences` (via the existing `referenceCount` prop).
8. Failure paths: thumbnail never throws on missing assets or bad layout; a failed create, duplicate, export or delete shows `gs-error` text with the next step.
## Correctness properties
- P1 Every template, for any title and any id source, yields a Stack that passes `validateStack`.
- P2 `importGsp(exportGsp(template))` returns an equal Stack.
- P3 A template needs no state beyond its arguments: same ids and time give the same Stack.
- P4 Library filtering and sorting never lose or invent items (output is a permutation of a subset of the input).
