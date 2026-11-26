# HANDOFF: responsive (M2.6, branch feature/responsive, port 5193)

## 1. Files touched
- `packages/player/src/index.ts` (`fit` option, frame mode, `Card.background`, scaled strokes and radius), `player.test.ts`, new `layout.property.test.ts`
- `packages/project-format/src/web-export.ts` (+ test): letterbox page background `#e5e7eb`
- `apps/web/src/features/preview/index.tsx`, `preview.css`: modes Fit (default), Window size, Desktop/Tablet/Mobile
- `apps/web/src/features/card-editor/CardCanvas.tsx` (new elements use `DEFAULT_ELEMENT_PLACEMENT`, card background, apply-scaling row), `ElementView.tsx` (stroke and radius follow scale), `card-editor.css`, `card-editor.test.tsx`, new `ApplyScalingButton.tsx`
- `tests/e2e/m2x-responsive.spec.ts`; `.kiro/specs/m2-6-responsive-defaults/` (requirements, design, tasks)
- `docs/audit/10-preview.png`, `11-preview-phone-window.png` re-taken (other audit shots left as on main)

## 2. Exported entry points
- `mountPlayer({ ..., fit?: 'frame' | 'window' })`, default `frame`: whole design frame scaled uniformly, centered, letterboxed. `window`: `resolveLayout` against the container.
- `ApplyScalingButton({ session, cardId, disabled? })` in `features/card-editor/ApplyScalingButton.tsx` (not re-exported from `index.tsx`; used inside `CardEditorCanvas`). One `UPDATE_ELEMENT` per element not yet `scale`, one unique `coalesceKey` per click, so one undo step.

## 3. Contract changes requested
None. `packages/shared-contracts/src/layout.test.ts` is central, so the new `resolveLayout` property tests live in `packages/player/src/layout.property.test.ts` (identity, proportions, edge distances, fixed mode, monotonic, containment). Move them if preferred.

## 4. Caveats
- Root `npm run typecheck` fails in `packages/behavior/src/lists.test.ts` (lines 120, 135, `ActionNode` generic). That file belongs to behavior-lists and is untouched here. `tsc -p` passes for player, project-format, shared-contracts, domain and apps/web.
- Fit mode uses CSS `transform: scale` on the whole frame, so fonts and strokes follow by construction. Window and device modes scale font, stroke and radius through `resolveFontScale`. 1px input and button borders are not scaled.
- Existing Stacks keep their stored scale modes.
- The editor canvas has no fit toggle; it still shows the selected viewport preset.
- The apply-scaling button sits in a row below the canvas bar. In the bar it shifted the viewport radios under the open Checkpoints popover and blocked `audit-screens`.
- The click-through was done by the Playwright e2e (`m2x-responsive`) and the audit screenshots, not with the `playwright-cli` tool.

## 5. What the next step needs
- Inspector worktree: a per-card background control (`SET_CARD_BACKGROUND`). Canvas and player already honor `Card.background`.
- Shell worktree: keep `.gs-ce-row` and the `card-stage` background logic when adding zoom.

## 6. Commands run
- `npx vitest run packages/player packages/project-format`: 48 passed. `npx vitest run apps/web/src/features/card-editor`: 12 passed.
- `npm run lint`: pass. `npm run format:check`: pass. `npm test`: 200 passed. `npm run build`: pass.
- `npm run typecheck`: FAIL (pre-existing behavior test file, see section 4). `npx tsc -p` for player, project-format, shared-contracts, domain, apps/web: pass.
- `GS_PORT=5193 npx playwright test` against my own dev server: 31 passed, 1 skipped (audit-screens without `AUDIT_SHOTS`). Includes audit-flows, m2-full-flow, m2x-responsive.
- `AUDIT_SHOTS=1 GS_PORT=5193 npx playwright test tests/e2e/audit-screens.spec.ts`: passed. I reverted every shot except 10 and 11.
