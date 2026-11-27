# UI and Worktree Contract: GhostStack

Locked on `main` by the orchestrator. Worktrees inherit it; they do not change it. To request a change, say so in `HANDOFF.md`. Last revised for M2 on 2026-11-26.

## 1. Central files (orchestrator only)

Worktrees must not edit these:

- Every `package.json`, `package-lock.json`, `tsconfig*.json`, `eslint.config.js`, `vitest.config.ts`, `playwright.config.ts`, `apps/web/vite.config.ts`, `.prettierrc.json`
- `apps/web/src/App.tsx`, `main.tsx`
- `apps/web/src/app/**` (AppShell, router, routes, services, session hooks, asset helpers, theme)
- `apps/web/src/themes/**`
- `apps/web/src/features/workspace/**` and `apps/web/src/features/project-library/**` (the orchestrator mounts feature slots there)
- `packages/shared-contracts/**`, `packages/domain/**`, `packages/storage/**` (except where section 5 gives a worktree ownership)
- `docs/**` (except your own `HANDOFF.md`)

Need a dependency, a new export, a new command or a schema change? List it in `HANDOFF.md` with the reason and size. The orchestrator installs or adds it. Do not edit `package-lock.json`. Do not create a new workspace package: every package M2 needs already exists.

## 2. UI rules

- One navbar: `AppShell`. One workspace grid: `WorkspaceLayout` (slots: navigator, toolbar, canvas, inspector, drawer). Never render your own navbar, global layout or `<html>`/`<body>` styles. The toolbar slot is an action row above the canvas, not a navbar.
- Style with the CSS variables in `themes/tokens.css` and the classes in `themes/base.css` (`gs-btn`, `gs-btn--primary`, `gs-btn--danger`, `gs-input`, `gs-panel-title`, `gs-empty`, `gs-error`). No hardcoded colors in editor chrome, no new theme, no UI library. User-authored element colors are data and come from `Element.properties`.
- Feature CSS lives in a file next to the component, class prefix `gs-<feature>-`. It may not restyle `gs-*` base classes.
- Each feature exports the components named in section 5 from `features/<name>/index.tsx`. Names and props are fixed. Slot components receive `EditorSlotProps` from `app/editorContext.ts`.
- Every async or data view has loading, empty, error (`gs-error`, with a next step) and success states. The empty and error text names the cause and the action.
- Accessibility (antislop R-25, R-32, R-39): every control is a real `<button>` or `<a href>`, has an accessible name (icon-only buttons get `aria-label`), shows a visible focus ring, has `cursor: pointer` (set in base CSS), hover, active and disabled states, and is at least 32px high. Every input has a visible label. Canvas elements are keyboard selectable and movable. Text meets 4.5:1 contrast. Respect `prefers-reduced-motion`.
- No decorative emoji, no placeholder marketing copy, no em dashes in UI text. Every control works or is not rendered.
- Routes (hash): `/library`, `/stack/:stackId`, `/stack/:stackId/card/:cardId`, `/stack/:stackId/preview`. Navigate with `navigate()` or `Link` from `app/router`.

## 3. State and data rules

- Stack changes go through the session: `useStackSession(stackId)` (opened once by `WorkspacePage`) hands every slot a `StackSession`. Read with `useSessionStack(session)` and `useSessionStatus(session)`. Write only with `session.dispatch(command, { coalesceKey? })`. Features never call `stacks.save` or persist through `applyCommand`. A read-only `applyCommand` dry run for diagnostics is allowed. Only the Project Library uses `stacks` directly (create, rename, delete a Stack).
- Use a `coalesceKey` for continuous edits (drag, resize, typing) so one gesture is one undo step.
- Binary data lives in IndexedDB through `AssetRepository` (`useServices().assets`). Metadata lives in `Stack.assetRegistry`. A registered asset whose bytes are missing is a normal state: render the fallback and never throw. Use `useAssetUrl` and `describeAssetFile` from `app/assets.ts`.
- Persistence is IndexedDB database `ghoststack` version 2: stores `stacks` (key `stackId`), `assets` (key `[stackId, assetId]`), `checkpoints` (key `checkpointId`, index `byStack`). Features never import `idb`. Deleting a Stack removes its assets and checkpoints. A schema change needs the orchestrator.
- The domain-side packages (`domain`, `shared-contracts`, `project-format`, `behavior`) import no React, DOM, `idb` or Vite. `player` imports no React or storage.
- Ids: `crypto.randomUUID()` at the UI edge. Timestamps: `new Date().toISOString()` at the UI edge. Pass them into the domain.
- No mock data, no hardcoded sample rows, no seeded Stacks, no `localStorage` for project data. Test fixtures live next to tests only. `fake-indexeddb` is allowed in unit tests only. E2E tests create their data through the UI.
- No `eval`, `new Function` or generated JavaScript. Lint enforces it. Behavior runs only through the registered-action interpreter.
- Element `properties` follow the per-type schemas in `shared-contracts/src/elements.ts`. Colors are hex or `transparent`. Layout placement for every renderer (canvas, preview, export) is `resolveLayout` from `shared-contracts/src/layout.ts`. Do not reimplement it.
- No secrets in code, logs or fixtures.

## 4. Shared types and entry points

Source of truth: `packages/shared-contracts/src`.

| Export | Meaning |
|---|---|
| `Stack`, `Card`, `Element`, `Layout`, `Asset`, `*Schema`, `FORMAT_VERSION` | Project model (zod). Stack `formatVersion` stays 1 |
| `Behavior`, `ActionNode`, `Expr`, `Trigger`, `StateVariable`, `*Schema` | Canonical behavior AST (zod) |
| `BehaviorRuntime`, `CreateRuntime`, `RuntimeEvent`, `RuntimeSnapshot` | Runtime contract |
| `ELEMENT_DEFAULTS`, `validateElementProperties`, `ColorSchema` | Per-type element properties |
| `resolveLayout`, `ANCHORS`, `SCALE_MODES`, `VIEWPORT_PRESETS` | Anchoring, scaling, viewport presets |
| `ProjectCommand`, `ElementPatch`, `ApplyCommand` | Command union |
| `StackSession`, `StackSessionFactory`, `SessionStatus` | Editing handle, undo, autosave |
| `StackRepository`, `AssetRepository`, `CheckpointRepository` | Storage ports |
| `Result`, `ok`, `err`, `GhostError`, `ErrorCode` | Error handling |

Package entry points on `main`:

| Package | Exports | Status |
|---|---|---|
| `@ghoststack/domain` | `createStack`, `validateStack`, `applyCommand`, `findCardReferences`, `listBehaviors`, `walkActions`, `walkExpr` | Complete for all `ProjectCommand`s, with tests |
| `@ghoststack/storage` | `createIdbStorage`, `createIdbStackRepository`, `StorageError` | Complete (stacks, assets, checkpoints), with tests |
| `@ghoststack/project-format` | `exportGsp`, `importGsp` | Complete: `.gsp` with integrity checks, `exportWebApp` |
| `@ghoststack/behavior` | `createRuntime`, `parseGhostScript`, `printGhostScript` | Complete (runtime, GhostScript), with tests |
| `@ghoststack/player` | `mountPlayer`, `boot` (standalone entry, built by `npm run build:player`) | Complete (DOM player, standalone bundle), with tests |

Validation: `applyCommand` runs `validateStack` on every result. `validateStack` enforces: card and element ids, per-type element properties, asset references, input `stateKey`, behavior trigger placement, and that every `navigate` target, element target and state key exists. Deleting a Card removes `navigate` actions that point at it. Deleting an Element removes actions that target it.

## 5. M2 worktrees

Per-worktree briefs with acceptance criteria and tests: [docs/handoffs/m2/README.md](handoffs/m2/README.md).

Branch `feature/<name>`, worktree at `.worktrees/<name>`, then `npm ci` inside it. Folder ownership is exclusive. Each worktree runs its dev server and e2e on its own port with `GS_PORT`.

| Worktree | Port | Owns | Must deliver (exports are fixed) |
|---|---|---|---|
| `card-editor` | 5181 | `apps/web/src/features/card-editor/**`, `tests/e2e/m2-card-editor.spec.ts` | `CardEditorCanvas`, `CardInspector` (both take `EditorSlotProps`). Responsive authoring canvas rendered with `resolveLayout` at the selected viewport preset. Viewport switcher (`VIEWPORT_PRESETS`) in the canvas header. Element palette (text, button, input, image, shape, line), select, move, resize (pointer and keyboard), delete, z-order, inspector for every property of every type, anchor and scale controls, image upload through `describeAssetFile` + `assets.put` + `REGISTER_ASSET`, missing-asset fallback |
| `behavior` | 5182 | `packages/behavior/**`, `apps/web/src/features/behavior-editor/**`, `tests/e2e/m2-behavior.spec.ts` | `createRuntime` (interpreter, safe evaluator, branching, step limit against loops, errors reported in the snapshot, never mutating the Stack), `parseGhostScript`, `printGhostScript` (documented grammar in `packages/behavior/GHOSTSCRIPT.md`), `BehaviorEditorPanel` (takes `EditorSlotProps`): visual action stack plus CodeMirror GhostScript editor with live diagnostics. Both read and write the same `Behavior[]` through `UPDATE_BEHAVIOR`. Includes state schema editing through `UPDATE_STATE_SCHEMA`. Property tests: `parse(print(x)) = x`, evaluator never throws on valid AST |
| `history` | 5183 | `apps/web/src/features/history/**`, `packages/storage/**` additions, `tests/e2e/m2-history.spec.ts` | `createStackSessionFactory({ stacks, checkpoints })` in `features/history/session.ts` implementing `StackSessionFactory`: validated dispatch, coalesced undo and redo, debounced autosave, `flush`, interrupted-session recovery (use a `recovery` checkpoint), `canUndo`/`canRedo`, status. `HistoryControls` (takes `EditorSlotProps`): undo, redo, save state, manual checkpoint create and restore. Asset lookup helper if needed. Unit tests with fake timers |
| `preview-export` | 5184 | `apps/web/src/features/preview/**`, `apps/web/src/features/export/**`, `packages/player/**`, `packages/project-format/**`, `tests/e2e/m2-preview-export.spec.ts` | `mountPlayer` (DOM renderer on `resolveLayout` plus `createRuntime`), `PreviewPage`, `ExportMenu` (Preview, Export .gsp, Export web app; calls `session.flush()` first), `ImportGspButton`, `.gsp` import that registers assets through `assets.put`, asset reference validation using `validateStack`, standalone web export (a zip with `index.html`, the bundled player, `stack.json`, assets; works from `file://` or any static host; no editor, storage or AI code; no authoring ids or credentials) |

Rules between worktrees:

- A worktree codes against the contract types, never against another worktree's files. `preview-export` uses `@ghoststack/behavior` (skeleton today), so its preview shows no behavior until `behavior` merges. Say so in its `HANDOFF.md`.
- `behavior-editor` does not own the canvas. It reads the selected element from `EditorSlotProps`.
- The orchestrator wires at merge: the real `createStackSessionFactory` into `app/services.tsx`, `ImportGspButton` into the Project Library, missing e2e glue, and the final workspace layout.
- Cross-worktree requests (a new command, a new element property, a new export) go in `HANDOFF.md` section 3. Do not work around a missing contract by duplicating it.

## 6. HANDOFF.md (required, at worktree root, short)

1. Files touched
2. Exported entry points
3. Env, schema, dependency and contract changes requested
4. Caveats and known gaps (be explicit about anything stubbed or unverified)
5. What the next step needs
6. Commands run and results (only commands you ran)

## 7. Done means

In your worktree: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` and `npm run format:check` pass, with tests for what you added. Run `GS_PORT=<your port> npm run test:e2e` for UI work (PowerShell: `$env:GS_PORT='5181'; npm run test:e2e`). A UI worktree also clicks through its flow in the browser with `playwright-cli` and reports what it did. Zero mock data. Commit on your branch; do not merge, push or touch `main`.
## 8. M2.x amendments (locked 2026-11-27)

Briefs, ownership and waves: [docs/handoffs/m2x/README.md](handoffs/m2x/README.md). Sections 1 to 7 stay in force; this section adds to them.

- **Components kit.** `apps/web/src/components/` is the only home for shared UI components, built in M2.1 and exported from `components/index.ts`. After M2.1 merges, feature code uses the kit and does not hand-roll buttons, menus, tabs, dialogs or fields. Feature CSS still uses the `gs-<feature>-` prefix. Tokens come from `themes/tokens.css`; accents are chosen with `data-accent` on `<html>`.
- **Templates exception (amends the "no seeded Stacks" rule).** A template is a function that issues real `applyCommand` or `session.dispatch` commands when the creator picks it. Nothing is present, seeded or stored until the creator chooses it. Templates live in `features/templates/**`. A template output must pass `validateStack` and survive `.gsp` export and import unchanged.
- **Interface preferences.** `localStorage` may hold interface preferences only (theme, accent, panel sizes, zoom, last tool). Never project data.
- **New commands** (`SET_CARD_BACKGROUND`, `SET_VIEWPORT`, `REMOVE_ASSET`, `REPLACE_ASSET`) and the list model (state type `list`, list expressions and actions, `nextCard`, `prevCard`) are part of the contract. New elements start with `DEFAULT_ELEMENT_PLACEMENT`.
- **Central-file exceptions** for M2.x are listed in the ownership table of the m2x README only. Anything else needs a request in `HANDOFF.md` section 3.
- **Gate per worktree:** `typecheck`, `lint`, `format:check`, `test`, `build`, and the worktree's own e2e spec on its own port, plus a `playwright-cli` click-through reported in `HANDOFF.md`.

## 9. M3 amendments (locked 2026-11-27)

Briefs, ownership and waves: [docs/handoffs/m3/README.md](handoffs/m3/README.md). Sections 1 to 8 stay in force.

- **Contract.** `packages/shared-contracts/src/ai.ts` is the only definition of `AIPlan`, `AIPlanCommand`, the command allowlist (`AI_ALLOWED_COMMAND_TYPES`), `ProjectContext`, `AIProviderAdapter`, `ProviderConfig`, `PersistedProviderSettings` and `AIOperationState`. Plan limits: 50 steps, 64 kB. Allowed: card, element, behavior, state schema and card background commands. Rejected: `REGISTER_ASSET`, `REPLACE_ASSET`, `REMOVE_ASSET`, `SET_VIEWPORT`, `RENAME_STACK`.
- **New packages (owner decision D1).** `ai-core` (pure: parse, dry run, summary, context, transaction), `ai-providers` (adapters over `fetch`), `mcp-server` (Node only). `ai-core` imports `shared-contracts`, `domain`, `behavior`. `ai-providers` imports `shared-contracts` only. No package imports React, `idb` or the web app, except `apps/web`.
- **Only `StackSession` mutates the Stack.** An AI or MCP plan is applied by `ai-core.runTransaction` through `session.restore(resultStack)` after approval: one undo step, preceded by a `Before AI: ...` checkpoint. Nothing else calls `restore` or `dispatch` on behalf of AI.
- **Approval gate.** No code path applies a plan before an explicit user Approve. Approve is disabled while any step fails the dry run.
- **Keys.** `ProviderConfig.apiKey` exists in memory only. Never in IndexedDB, `localStorage`, `.gsp`, exports, logs, error messages, fixtures or e2e artifacts. Non-secret `PersistedProviderSettings` may persist in `interfacePrefs`.
- **No silent fallback.** The active provider, a local or remote badge and the connection state are always visible (status-bar chip). A remote send needs a per-session consent that lists what is sent. A failing provider is reported, never replaced.
- **Shell slot.** The AI panel mounts in a right-side panel slot wired by the orchestrator in `features/workspace/**`. The feature exports `AIPanel` and `AIStatusChip` from `features/ai/index.tsx`, both taking `EditorSlotProps`, lazy-loaded behind an error boundary. A crash in the panel must not affect canvas, inspector, undo or autosave.
- **Plan wording.** Plain sentences about the creator's Stack ("Adds a card named Result with 2 elements"). No command names, ids or JSON outside a collapsed "details" area. No em dashes.
- **Untrusted input.** AI output, MCP input and imported plan files pass `AIPlanSchema`, then `parsePlan`, then `dryRunPlan`, then review. Stack text inside the context is data and never widens the allowlist.
- **MCP.** The server never mutates a Stack. `propose_stack_patch` only enqueues a validated plan for the approval UI. Loopback bind, per-launch token, `Origin` and `Host` checks, payload limit.
- **Dependencies.** `@modelcontextprotocol/sdk` and `ws` may be added to `packages/mcp-server` only (D2). Nothing new for the web bundle; providers use `fetch`.
