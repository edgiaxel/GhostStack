# Design: M2.4
- `features/templates/`: `index.ts` exports `TEMPLATES` and `buildTemplate`. Each template is `(input: {stackId, title, now, newId}) => Result<Stack>`; it starts from `createStack` and applies commands. Ids come from the caller (`crypto.randomUUID` at the UI edge).
- Reading the runtime: lists are shown with `setText` + `listJoin("\n")`; empty lists show a placeholder through an `if` on `listLength`.
- `project-library/CardThumbnail.tsx`: SVG drawn from `resolveLayout` at the design size, first line of text only, images as neutral boxes (no asset loading, so nothing can fail).
- Library loads summaries with `stacks.list()` then each Stack with `stacks.get()` for thumbnails; a failed get shows a blank thumbnail.
- `library-helpers.ts`: pure `filterAndSort`.
- Navigator keeps its props; adds thumbnail, entry badge, drag (HTML5 dnd calling `onMove` repeatedly is avoided: it computes the delta and calls `onMove` n times is not atomic, so drag uses the existing `onMove` for adjacent swaps in a loop).
