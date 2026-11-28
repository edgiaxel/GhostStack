# Requirements: M2.6 Responsive defaults (closes U13)

Source: PRD F-003, F-014, F-026; AUDIT-M2 U13; MILESTONE M2.6. Scope is limited to the five checklist items there.

## Requirements

1. New elements are created with `DEFAULT_ELEMENT_PLACEMENT` (anchor `top-left`, scale mode `scale`). Existing Stacks are not changed.
2. The editor offers "Apply scaling to all elements" on the current card. It dispatches one `UPDATE_ELEMENT` per element that is not yet `scale`, all under one coalesce key, so one undo restores the card. It is disabled when nothing needs changing.
3. Preview defaults to Fit: the whole design frame scales uniformly, is centered and letterboxed, and is never cropped. "Window size" (layout resolved against the window) and Desktop, Tablet, Mobile device frames remain options.
4. Text size, line width, shape stroke and corner radius follow the element scale in editor, preview and web export.
5. The player paints `Card.background` (fallback `RENDER_DEFAULTS.cardBackground`) and renders text with `white-space: pre-wrap`. The editor canvas paints the same background.
6. Failure cases: an unmeasured container (0 size) falls back to the design size; a missing or invalid background falls back to the default; an invalid color never reaches `style`.

## Correctness properties (`resolveLayout`, fast-check)

- P1 Identity: at the design size every mode and anchor returns the authored rect.
- P2 Proportions: in `scale` mode width/height ratio is preserved for any viewport.
- P3 Edge distances: for an end anchor the distance to that edge, scaled by `s`, is preserved.
- P4 Monotonic: growing the viewport on both axes never shrinks a `scale` rect.
- P5 Fit: in `scale` mode the rect stays inside the view when the authored rect is inside the design frame.
