# M2.5 Canvas craft: requirements
Scope: `docs/MILESTONE.md` M2.5, finding U10 and the axe `label-content-name-mismatch` finding. EARS form.
1. WHEN the creator shift-clicks an element, or drags a marquee on empty canvas, the canvas SHALL add to or replace the selection. Escape and a click on empty canvas SHALL clear it.
2. WHILE several elements are selected, dragging, arrow keys and Delete SHALL act on all of them. Each gesture SHALL be one undo step.
3. Ctrl+D SHALL duplicate the selection. Ctrl+C and Ctrl+V SHALL copy and paste through an in-memory clipboard, also onto another card. Pasted elements SHALL get new ids, appear on top, and be one undo step. Behaviors are not copied.
4. Align (left, center, right, top, middle, bottom) SHALL work on two or more elements. Distribute (horizontal, vertical) SHALL work on three or more. Both are in the Arrange menu.
5. WHEN an element is dragged, its edges and center SHALL snap to the frame and to other elements within 6 design pixels, with visible guides. Holding Alt SHALL disable snapping.
6. Double-click on a text or button element SHALL edit its text in place. Enter or blur commits, Escape cancels.
7. The asset manager SHALL list every registered asset with thumbnail, size and usage count, replace a file (`REPLACE_ASSET` plus `assets.put`), delete an unused asset (`REMOVE_ASSET` plus delete bytes) and remove all orphans.
8. `.gsp` and web exports SHALL NOT contain assets that no element references.
9. The accessible name of a canvas element SHALL contain its visible text.
10. The Edit and Arrange menus SHALL expose every action above with its shortcut. No item is a placeholder.
## Correctness properties
- P1 Move, resize, align, distribute, paste and delete keep the Stack valid (`validateStack`).
- P2 After any of them, one undo returns the exact previous Stack.
- P3 Align leaves sizes unchanged. Distribute keeps the outer two elements fixed and makes gaps equal.
- P4 Snapping never moves an element by more than the threshold.
- P5 `pruneOrphanAssets` keeps exactly the referenced assets.
