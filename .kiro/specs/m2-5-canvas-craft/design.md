# M2.5 Canvas craft: design
- `geometry.ts` (pure): `boundsOf`, `alignBoxes`, `distributeBoxes`, `snapMove`, `marqueeHits`.
- `clipboard.ts`: module-level in-memory clipboard. `cloneForPaste` gives fresh ids (passed in by the caller from `crypto.randomUUID()`), offset, no behaviors.
- `canvas-actions.ts`: session operations (`moveElements`, `deleteElements`, `alignElements`, `distributeElements`, `pasteElements`, `duplicateElements`). Each uses one shared `coalesceKey` per gesture so it is one undo step. Callers never touch `stacks`.
- `CardCanvas.tsx`: selection set (`selectedIds`, `onSelectionChange` optional props; falls back to `selectedElementId`), marquee, snap guides, in-place edit, keyboard.
- `AssetPanel.tsx`: dialog opened from View > Asset manager. Image bytes are written before the registry command, and removed again when the command fails.
- `packages/project-format/src/orphans.ts`: `pruneOrphanAssets` used by both exports.
- Workspace keeps the selection (`ids` per card) and wires menus, shortcuts Ctrl+C/V/D, and the asset dialog.
