# M2.2 Editor shell: requirements
Closes U8, U9, U17, U18. Scope: `docs/MILESTONE.md` M2.2. EARS form.
1. The workspace SHALL show a menu bar (File, Edit, Insert, Arrange, View, Help). Each item SHALL run a real command and show its shortcut, or be disabled with a reason in its state.
2. The workspace SHALL show a tool rail (Select, Hand, Text, Button, Input, Image, Shape, Line) in place of the "Add ..." row. Choosing an element tool SHALL add that element through `session.dispatch`.
3. The workspace SHALL show a status bar: card position, save state, selected element, zoom, viewport.
4. WHEN the creator drags a splitter or uses its arrow keys, the navigator, inspector or console SHALL resize within fixed limits. Each SHALL collapse and expand. Sizes SHALL persist in `localStorage` keys `gs.layout.navigator|inspector|drawer` (interface preferences only).
5. The console SHALL have tabs Behavior, Problems, Runtime. Problems SHALL show the `validateStack` result for the current Stack. Runtime SHALL show a read-only dry run of `createRuntime` on the current card.
6. The canvas SHALL zoom from 25% to 400%, with Fit, Actual size, ctrl/meta+wheel zoom about the cursor, wheel scroll, and pan by space-drag, middle button or the Hand tool. Fit SHALL consider both width and height (U9).
7. The shortcut sheet SHALL open from Help and from `?`, and list every shortcut the shell handles.
8. The toolbar SHALL group history, preview and export, with Preview as the primary action.
## Correctness properties
- P1 Zooming about a cursor keeps the design point under the cursor fixed (`zoom.test.ts`).
- P2 Zoom is always within 0.25 to 4; stepping up then down returns to the start for preset steps.
- P3 Panel sizes read back from storage are always inside their limits, whatever was stored (`layoutPrefs.test.ts`).
- P4 Every shortcut in the table is unique per key and is listed in the sheet.
