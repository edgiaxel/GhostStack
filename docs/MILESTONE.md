
# Milestones — GhostStack

> **Current milestone:** M4 (Release and Demo). M2.1 to M2.8 and M3 done on `main` 2026-11-27, except a live Ollama run.  
> **Overall status:** The editor, preview, both exports, templates, lists, the AI workflow (demo, OpenAI-compatible, Ollama adapters) and the MCP bridge are on `main`, with CI green. A hosted provider and an MCP client were verified live. Next: deployment, demo video and submission.  
> **Deadline:** December 4, 2026 — 2:00 PM Pacific  
> **Last updated:** November 27, 2026  
> **Repository:** `edgiaxel/GhostStack`

---

**Important:** Dont replace these, this is my template prompt.

/antislop /antislop-code /antislop-human /antislop-ui   

/caveman /ultracave be brief, use less token

Read PRD, architecture, latest milestone handoff/changelog and inspect existing project code before acting.

Role: **Main Orchestrator** managing a multi-agent Git worktree workflow. Execute strictly in these phases:

1. **Prep & Shared Contract (on `main` BEFORE worktrees):**
   - Clean up stale worktrees/branches and verify `main` builds clean.
   - Lock shared contracts (`UI_CONTRACT.md`, shared types, API schemas, global theme, Navigation/Layout, and central router skeleton) on `main` so all worktrees inherit identical UI/navigation/state rules.
2. **Plan & Isolate:**
   - Plan to split this milestone into isolated worktrees with strict, non-overlapping folder ownership.
   - Ban subagents from creating duplicate navbars, global layouts, custom themes, or editing central shared files directly.
   - Require every subagent to connect real DB/backend logic (zero mocks/hardcoded data) and output a brief `HANDOFF.md` (files touched, exported entry points, env/schema changes, caveats, what needs to do next) upon completion.
3. **Merge, Wire & Verify:**
   - Review subagent `HANDOFF.md` reports, merge branches into `main`, and centrally integrate all new features from each worktree.
   - Audit for zero mock/hardcoded data—everything must hit real database and backend endpoints.
   - Run Playwright CLI against localhost to verify end-to-end user flows, navigation consistency, and DB persistence. Fix any regressions.
4. **Docs Sync & Milestone Handoff:**
   - Update necessary documentation and remove temporary worktrees.
   - Write a concise HANDOFF.md for each milestone summarizing completed features, DB/API contracts, touched files, and next-milestone readiness for the next fresh session.

Remember check again to make sure theres a shared contract before doing the execution, each subagents can execute with the same rule, dont invent different rule from one another, make sure each subagents know each other what they do and you as the main orchestrator need to know what each subagents did. You as the orchestrator act as the audit to see works for each subagents and check their work if its aligned with the current project. If not you are alllowed to edit/fix/change so every work synced wth the current project.

### Current Milestone Target:

### M2.1 — Design Foundations

**Target:** November 27

**Outcome:** One coherent, intentional look for GhostStack and a small shared component kit, so every later UI chunk builds on the same foundation. Source: `docs/AUDIT-M2.md` findings U5, U6, U16 and the DESIGN section 9 visual direction.

**Read first:** `docs/AUDIT-M2.md` (sections 6 and 10), `docs/DESIGN.md` (sections 9 and 10), `docs/UI_CONTRACT.md`, `HANDOFF.md`. The Stitch prototypes in `docs/design/prototypes/` are reference only. Follow DESIGN.md; do not copy a prototype one to one, and do not adopt prototype features that are outside the PRD.

**Brand and identity (owner decision 2026-11-26: the agent designs it)**
- [x] Design the GhostStack mark, wordmark and lockups in SVG, written as code (a generator script under `scripts/brand/`, run by an npm script), so every version comes from one source.
- [x] Versions from the same source: mark only, horizontal lockup, stacked lockup, monochrome, light-background and dark-background variants, app icon, favicon set (`.svg`, `.ico`, PNG sizes), and a social preview image.
- [x] The name is written the same way everywhere (`GhostStack`). Colors come from the theme tokens, not from new hex values.
- [x] Identity follows DESIGN section 9: modern, minimal, editor-oriented, a subtle Halloween character in Spectral Workstation without decorative clutter. Record the one-line reason for each major choice (shape, color, type) in `docs/DESIGN.md`.
- [x] Wire the favicon, app title and the shell brand slot (`AppShell`) to the generated assets.

**Design tokens v2**
- [x] Spacing, radius, elevation, border, motion (with `prefers-reduced-motion`) and a type scale, as CSS variables.
- [x] Decide and load the fonts (bundled, with the size cost stated). Remove the unloaded `Inter` declaration if it is not used.
- [x] Accent presets per theme and an independent accent color (DESIGN section 9). The text color on the accent is chosen so every preset passes WCAG AA.
- [x] Border and control-boundary contrast reaches 3:1 for non-text UI (audit U5).
- [x] Decide the icon approach (small purpose-made set or a library) and record why.

**Shared component kit (`apps/web/src/components/`)**
- [x] Button (primary, secondary, danger, icon-only), text field, number field with stepper, select, tabs, toolbar, toggle, tooltip, toast, dialog, empty state.
- [x] Every component has hover, active, focus, disabled and error states, an accessible name, and is keyboard operable.
- [x] The existing `gs-*` base classes keep working while features migrate to the kit.

**Exit criteria**
- [x] All three themes pass the contrast test, including every accent preset (extend `tests/e2e/audit-themes.spec.ts`).
- [x] The brand generator is reproducible: running it twice produces identical files.
- [x] A kit gallery route or test page shows every component in every state (used by tests, not linked from the product navigation).
- [x] `npm run typecheck`, `lint`, `format:check`, `test`, `build` and `test:e2e` pass.
- [x] `docs/DESIGN.md`, `docs/UI_CONTRACT.md` and `HANDOFF.md` are updated.

---

## 1. Project at a Glance

### Goal

Build a modern, local-first, HyperCard-inspired application editor with a visual Card workspace, controlled behavior runtime, portable project format, and optional AI-assisted authoring.

### MVP outcome

A creator can:
- Create and edit a Stack containing multiple Cards.
- Arrange visual elements on a responsive canvas.
- Define basic application behavior.
- Save and reopen projects locally.
- Import and export `.gsp` files.
- Preview and export standalone web applications.
- Optionally use AI to plan, approve, execute, and revert project changes.
- Connect at least one real AI provider and demonstrate a controlled MCP integration path.

### Current state

- Clean-slate restart (2026-11-25). The earlier work, its specs and its reports were removed by the owner and are not to be restored.
- PRD, DESIGN, and ARCHITECTURE are the approved plans (Product Owner, Nov 15, 2026). T-013 (MCP bridge transport) stays open until the AI integration milestone (M3). Plans do not prove implementation.
- Planning documents live in `docs/`. Stitch UI prototypes are stored in `docs/design/prototypes/` as reference only. Follow DESIGN.md; do not copy a prototype one to one.
- Remote `origin` is `git@github.com:edgiaxel/GhostStack.git`. Local `main` is ahead of it; nothing from M1, M2 or the audit has been pushed.
- M0, M1 and M2 are closed and merged on local `main`. The core editor works without AI: card editor, behavior runtime and editors, undo and autosave, checkpoints, preview, `.gsp` and web export. 178 unit tests and 30 Playwright flows pass. See `HANDOFF.md` and `docs/AUDIT-M2.md`.
- The post-M2 audit found no logic bugs but a plain UI, a rigid editor, a preview that does not match the editor by default, and no way to build the recipe or inventory demo. The owner approved chunks M2.1 to M2.8 to address them.
- Not started: AI (F-009 to F-011), CI, deployment, brand identity, templates.
- Kiro credits are reserved for implementation.

### Owner decisions (2026-11-26)

| # | Decision |
|---|---|
| 1 | Focus on the core app first. AI work (M3) comes after the M2.x chunks and is re-cut at the Dec 1 checkpoint. PRD priorities for F-009 to F-011 are unchanged until the owner edits the PRD. |
| 2 | Stick to the original documents. The Stitch prototypes are reference only and are not copied one to one. |
| 3 | The agent designs the brand. All logo, wordmark, favicon and name variants are SVG generated from code and exported from one source, so they stay consistent. |
| 4 | Templates are wanted. They are started by the user and built through real commands, not seeded or mock data (`docs/UI_CONTRACT.md` is amended for this in M2.4). |
| 5 | New elements scale with the window by default (M2.6). |
| 6 | The recipe or inventory demo stays in the MVP because the PRD lists it as the second demonstration. It requires list support (M2.7). |
| 7 | Accent presets and an independent accent color are in scope for the polish pass (M2.1). The Midnight primary accent stays `#7C3AED` unless an accent preset replaces it with a variant that passes AA. |
| 8 | Chunks M2.1 to M2.8 in docs/AUDIT-M2.md are approved. |
| 9 | Hackathon category: **Resurrection** (HyperCard). Design quality still counts under the Design criterion, so polish stays in scope. |
| 10 | The earlier Kiro spec (m1-foundation) is restored to .kiro/specs/ to document Kiro use. IDE is the primary Kiro surface; CLI, Web and Crew are optional (docs/KIRO-USAGE.md section 3). |

### Next action

Start a new session. As orchestrator, lock the shared contract on `main` for the first wave (see section 6), then run M2.1 through Kiro's Spec workflow. Read `HANDOFF.md`, `docs/AUDIT-M2.md` and `docs/UI_CONTRACT.md` first.

### Links

- Repository: `https://github.com/edgiaxel/GhostStack`
- `docs/PRD.md`
- `docs/DESIGN.md`
- `docs/ARCHITECTURE.md`
- `docs/MILESTONE.md`
- `docs/AUDIT-M2.md` (state of M0 to M2, UI audit, evidence)
- `docs/UI_CONTRACT.md` and `docs/handoffs/` (shared rules and per-slice handoffs)
- `docs/KIRO-USAGE.md` (how Kiro is used in this project, for the hackathon write-up)
- GitHub Project: Not created or verified.

---

## 2. Milestone Overview

| ID | Milestone | Outcome | Planned dates | Status | Exit criteria |
|---|---|---|---|---|---|
| M0 | Audit & Preparation | Verified starting point and implementation boundaries | Nov 13–14 | Complete (2026-11-25) | Repository, docs, risks, and first slice reconciled |
| M1 | Foundation | Running browser application and shared project core | Nov 14–16 | Complete (2026-11-25) | Application builds and project model works |
| M2 | Core Creation Workflow | Complete usable Card-based application authoring workflow | Nov 19–27 | Complete (2026-11-26) | Create, edit, save, behavior, preview, and export work |
| M2.1 | Design Foundations | Brand, tokens v2, accent presets, shared component kit | Nov 27 | Done (2026-11-27) | Brand generated from code; all themes and accents pass AA; kit gallery tested |
| M2.2 | Editor Shell | An editor-like workspace: menu bar, tool rail, status bar, resizable panels, zoom | Nov 28–29 | Done (2026-11-27) | U8, U9, U17, U18 closed; every menu item works |
| M2.3 | Inspector | Tabbed, readable property editing | Nov 28–29 | Done (2026-11-27) | U12 closed; every property editable from the inspector tabs |
| M2.4 | Library, Navigator and Templates | A strong first screen and fast card handling | Nov 28–29 | Done (2026-11-27) | U7, U11 closed; quiz and recipe templates create real Stacks |
| M2.5 | Canvas Craft | Flexible authoring | Nov 30–Dec 1 | Done (2026-11-27) | Multi-select, copy, align, snap, card background, in-place text, asset panel |
| M2.6 | Responsive Defaults | Authoring equals preview | Nov 27–28 | Done (2026-11-27) | U13 closed; preview Fit mode and scaling default verified |
| M2.7 | Behavior Breadth and UX | Both MVP demos buildable | Nov 28–30 | Done (2026-11-27) | Lists work in runtime, editors and both exports; U14 closed |
| M2.8 | Quality | Safe to ship | Nov 28–Dec 2 (rolling) | Partial: CI file, a11y scan, split bundle and bundle budget done; CI not run on a runner, Firefox and WebKit not run | CI green, split bundle, a11y scan, three browsers |
| M3 | AI Integration & Quality | Integrated AI workflow and verified MVP | Dec 2–3 (re-cut Dec 1) | M3.0 to M3.5 merged on `main` 2026-11-27; M3.6 manual verification with real providers open | AI plan, approval, execution, rollback, and regression tests pass |
| M4 | Release & Demo | Public working application and hackathon submission | Dec 3–4 (before 2:00 PM PT) | Pending | Deployment, documentation, video, and submission complete |

Dates are targets, not promises. If a milestone slips, remove lower-priority scope before compressing validation and release testing.

**Schedule reality (written 2026-11-26):** the deadline is 8 calendar days away. M4 must start no later than Dec 3. Kiro credits can be requested only until Dec 1, 12:00 PM Pacific.

**Cut order if time runs short** (cut from the top first):
1. M2.5 extras: layer panel, align and distribute, snap guides. Keep multi-select, duplicate, card background, in-place text and the asset panel.
2. M2.8 extras: visual regression baselines, WebKit runs. Keep CI, code splitting and the accessibility scan.
3. M2.4 extras: card drag reorder, storage meter. Keep thumbnails, search and templates.
4. M3 scope: MCP bridge first, then the OpenAI-compatible adapter. Keep the offline demo adapter, plan review, approval and rollback.

**Checkpoint, Dec 1:** decide the final M3 scope and whether the PRD priority of F-009 to F-011 is changed. The PRD is the authority for scope, so any demotion is made there, not here.

---

## 3. Milestone Details

### M0 — Audit & Preparation

**Target:** November 13–14

**Outcome:** A trustworthy, verified starting point.

Tasks:
- [x] Verify the GitHub repository, default branch, and repository contents.
- [x] Verify local Git status, remotes, SSH access, and working directory.
- [x] Confirm whether any existing files or branches need preservation. (Owner removed the earlier code and specs; do not restore them.)
- [x] Review PRD, DESIGN, ARCHITECTURE, and MILESTONE consistency.
- [x] Confirm `.kiro/` will be committed at the repository root.
- [x] Establish the initial dependency and runtime choices.
- [x] Identify the owner of shared domain contracts.
- [x] Record technical risks and implementation boundaries.
- [x] Select the first vertical slice.
- [x] Prepare Kiro implementation instructions without spending credits on planning.

**Exit criteria:**
- [x] Local repository is clean and synchronized (committed with the M0 closing change).
- [x] Product and technical documents are aligned.
- [x] No unresolved blocker prevents the foundation from starting.
- [x] Initial project structure is agreed upon.
- [x] First implementation slice is ready.

**Owner decisions (resolved 2026-11-25):**
- License: Apache-2.0 (`LICENSE`).
- Shared domain contracts owner: Product Owner (`edgiaxel`); the main orchestrator enforces them. Contracts live in `packages/shared-contracts` and `docs/UI_CONTRACT.md`; worktrees must not edit them.
- First slice: VS-00, then VS-01 and VS-02 in parallel worktrees.

**Issues:** Draft only; GitHub issues have not been created.

### M1 — Foundation

**Target:** November 14–16

**Outcome:** A running browser application with a shared project model and reliable build workflow.

Included:
- [x] Initialize the React + TypeScript + Vite application.
- [x] Establish npm workspace structure where needed.
- [x] Configure linting, formatting, type checking, and tests.
- [x] Establish the shared domain model.
- [x] Define Stack, Card, Element, and Asset types.
- [x] Implement basic project validation.
- [x] Establish the storage interface.
- [x] Implement basic IndexedDB persistence.
- [x] Establish the initial `.gsp` archive structure (library only; no import/export UI yet).
- [x] Create the GhostStack workspace shell.
- [x] Implement the default Spectral Workstation theme (plus Studio Paper and Midnight Terminal tokens).
- [x] Verify development and production builds.

**Exit criteria:**
- [x] Application runs in a modern desktop browser.
- [x] A Stack can be created and persisted.
- [x] A project can be loaded after a browser reload.
- [x] Shared domain types are usable independently of React.
- [x] Lint, type check, tests, and build work.
- [x] The project format has a tested initial round-trip.

**Issues:** Draft only.

### M2 — Core Creation Workflow

**Target:** November 19–27

**Outcome:** A usable GhostStack editor that works independently of AI.

#### Stack and Card workflow

- [x] Create, open, rename, and delete Stacks.
- [x] Create, rename, duplicate, reorder, and delete Cards.
- [x] Implement Card navigation list.
- [x] Handle deleted Card references safely.
- [x] Implement project-level state schema.

#### Card editor

- [x] Implement responsive authoring canvas.
- [x] Add element selection and transformation.
- [x] Add text elements.
- [x] Add buttons.
- [x] Add input fields.
- [x] Add image elements.
- [x] Add basic shapes and lines.
- [x] Implement basic z-order.
- [x] Implement inspector properties.
- [x] Add layout anchoring and scaling controls.
- [x] Implement the initial viewport switcher.

#### Behavior system

- [x] Implement canonical behavior AST.
- [x] Implement supported triggers.
- [x] Implement registered actions.
- [x] Implement safe expression evaluation.
- [x] Implement basic conditions and branching.
- [x] Implement Card navigation behavior.
- [x] Implement the visual action-stack editor.
- [x] Implement GhostScript parsing and validation.
- [x] Verify both editors use the same AST.

#### Persistence and history

- [x] Implement debounced local autosave.
- [x] Implement recovery after interrupted sessions.
- [x] Implement undo and redo.
- [x] Implement basic recovery checkpoints.
- [x] Implement asset registration and lookup.
- [x] Implement missing-asset fallback.

#### Preview and export

- [x] Implement application preview.
- [x] Use the shared behavior runtime in preview.
- [x] Implement `.gsp` export.
- [x] Implement `.gsp` import.
- [x] Validate project and asset references.
- [x] Implement standalone web export.
- [x] Verify exported application data is independent of the authoring project.

**Exit criteria:**
- [x] A creator can build a small interactive application without AI.
- [x] Project data survives reload.
- [x] Undo and redo work for supported edits.
- [x] `.gsp` can be exported and re-imported.
- [x] Preview and exported behavior are consistent.
- [x] Missing assets do not crash the application.
- [x] The exported web application runs independently.

**Issues:** Draft only.

### M2.x — Polish and flexibility chunks (approved 2026-11-26)

These chunks come from `docs/AUDIT-M2.md`. Each one is a bounded vertical slice and goes through Kiro's Spec workflow in the IDE (requirements, design, tasks, with review at each phase). Finding IDs (U1 to U18) refer to that audit. Sizes are relative (S, M, L), not time estimates.

**How the chunks run**
- The orchestrator locks the shared contract on `main` first (section 6), then each chunk runs in its own worktree with exclusive folder ownership, as in M2. Each worktree writes a handoff in `docs/handoffs/`.
- Every chunk: loading, empty, error and success states; keyboard operation; WCAG AA; no mock data; real storage; no `eval`; reasons for major visual decisions written down (antislop R-31).
- Every chunk ends with the full gate (`typecheck`, `lint`, `format:check`, `test`, `build`, `test:e2e`) and updates the audit evidence for the findings it closes.
- Property-based tests (`fast-check`, and Kiro's spec correctness properties in the IDE) are required where a chunk defines an invariant: M2.5 geometry and clipboard, M2.6 layout, M2.7 list operations and GhostScript round trip.

#### M2.1 — Design Foundations (size M)

See "Current Milestone Target" at the top of this file. Closes U5, U6, U16. Depends on the owner decisions above. Not parallel: everything else builds on it.

#### M2.2 — Editor Shell (size L)

**Outcome:** A workspace that feels like an editor. Closes U8, U9, U17, U18. Depends on M2.1.

- [x] Menu bar (File, Edit, Insert, Arrange, View, Help). Every item runs a real command or is not shown. Shortcuts shown in the menu.
- [x] Tool rail for select, text, button, input, image, shape and line. The "Add ..." button row is removed.
- [x] Status bar: card position, save state, selected element, zoom, viewport.
- [x] Resizable and collapsible navigator, inspector and drawer. Sizes persist as interface preferences in `localStorage` (allowed for UI preferences by ARCHITECTURE 6.4).
- [x] Bottom drawer becomes a Console and Validation drawer with tabs (Behavior, Problems, Runtime). Collapsible. Fixes the canvas being squeezed (U9).
- [x] Canvas zoom (25% to 400%), Fit, Actual size, pan with space-drag and wheel.
- [x] Keyboard shortcut sheet (opened from Help and from `?`).
- [x] Toolbar redesign: grouped, icon plus label where it helps, clear hierarchy between history, preview and export.

**Exit criteria:** the 20 audit flows and the 7 M2 flows still pass; new flows cover the menu bar, tool rail, panel resize and persistence, zoom and the shortcut sheet; no dead control anywhere.

#### M2.3 — Inspector (size M)

**Outcome:** Fast, readable property editing. Closes U12. Depends on M2.1. Parallel with M2.4.

- [x] Tabs: Content, Layout, Appearance, Behavior (a readable summary with a button that opens the behavior editor).
- [x] 3 by 3 anchor picker with a live preview of what it does at Tablet and Mobile.
- [x] Color swatches from the theme plus a color field. Number fields with steppers, units and sensible ranges.
- [x] Scaling modes explained in plain words with a small diagram.
- [x] Multi-selection shows shared properties (prepared here, enabled by M2.5).
- [x] Domain errors show next to the field with the message and a fix hint.

**Exit criteria:** every property editable before is editable now; keyboard-only editing works; the inspector never clips (extend the overflow flow).

#### M2.4 — Library, Navigator and Templates (size M)

**Outcome:** A strong first screen and quick card handling. Closes U7, U11. Depends on M2.1. Parallel with M2.3.

- [x] Library as a grid of stack cards with a generated thumbnail of the first card, title, card count and updated time.
- [x] Search and sort (updated, title, card count). Duplicate stack. Export a stack from its card.
- [x] First-run and empty states that start the creator: create blank, choose a template, import.
- [x] Templates (owner decision 4): Blank, Branching quiz, Recipe collection (needs M2.7), Inventory list (needs M2.7), Interactive guide. A template is a function that issues real domain commands when the creator picks it. Nothing is seeded automatically.
- [x] Amend `docs/UI_CONTRACT.md`: templates are user-initiated, built through `applyCommand`, never present until chosen.
- [x] Navigator: card thumbnails, entry badge, drag reorder (keep the buttons for keyboard use), hidden-until-hover secondary actions, safer delete.
- [x] Category is Resurrection (owner decision 9), so no second application folder is needed. The two demos are templates inside the one app.

**Exit criteria:** a new user creates a quiz from a template in under a minute with no manual setup; templates create ordinary Stacks that export and re-import; thumbnails never throw on missing assets.

#### M2.5 — Canvas Craft (size L)

**Outcome:** Flexible authoring. Closes U10 and the F-003 and F-019 gaps. Depends on M2.2. Largest chunk and the first to cut down (see cut order).

- [x] Multi-select (shift-click, marquee), move and delete together.
- [x] Duplicate (Ctrl+D) and copy and paste elements, also across cards.
- [x] Align, distribute, snap to edges, centers and other elements, with visible guides. Nudge keys.
- [x] Card background color (new command and schema field; the player and the web export honor it).
- [x] In-place text editing (double-click on a text or button element).
- [x] Asset panel: list with thumbnails and usage count, replace a file, delete, and remove orphans. Removing an image no longer leaves orphaned bytes in exports.
- [x] Editable reference frame size (new `SET_VIEWPORT` command) with presets.
- [ ] Layer panel (F-025, P1) only if time allows. Cut (cut order item 1).
- [x] Property tests: move, resize, align and paste keep every element valid and undo restores the exact previous Stack.

**Exit criteria:** a creator can lay out a card without opening the inspector for position; asset orphans cannot reach an export; all new commands are undoable.

#### M2.6 — Responsive Defaults (size S)

**Outcome:** What you author is what previews. Closes U13. Decision made (owner decision 5). Can run first.

- [x] New elements are created with scaling mode `scale`. Existing projects are not changed. An "apply to all elements on this card" action is offered.
- [x] Preview default is Fit: the whole reference frame scales uniformly and is centered with letterboxing. Window-size and device-frame modes remain as options.
- [x] Text and line widths follow the element scale in the editor, preview and web export.
- [x] Property tests on `resolveLayout`: scale mode keeps proportions, anchors keep edge distances, identity at the design size, monotonic in the viewport.
- [x] Re-take `10-preview.png` and `11-preview-phone-window.png`; content is no longer cropped.

**Exit criteria:** editor, preview and web export agree at the same size (screenshot comparison on one fixture); a phone-width window shows the whole card.

#### M2.7 — Behavior Breadth and UX (size L)

**Outcome:** Both MVP demos are buildable and the behavior editor is friendlier. Closes U14. Depends on a contract change locked by the orchestrator. Parallel with M2.2 to M2.4.

- [x] Lists (owner decision 6): a list variable type, with actions to add, remove and set an item, and expressions for item at index, length and join. Keep the AST closed and safe: no calls, no arbitrary code. The exact shape is decided in the spec.
- [x] A way to show list content on a card (for example a text element bound to a joined list, or a repeating row element). Decided in the spec; the smaller option wins if it builds both demos.
- [x] Card navigation helpers: go to next card, go to previous card.
- [x] GhostScript references elements and cards by name when the name is unique, resolved to ids by the parser, so the stored AST is unchanged. The printer writes names where they are unique.
- [x] Domain errors point at the right line of the script (map errors to behavior and action position).
- [x] Blocks editor: each behavior and action reads as a sentence ("When Button 1 is clicked, set score to score + 1"), collapsible, with clearer add and move controls.
- [ ] Recipe collection and inventory examples built with the editor (not hardcoded) and exported as `.gsp` fixtures for the templates in M2.4. Superseded: the Recipe and Inventory templates build these through real commands, and a property test exports and re-imports every template unchanged.
- [x] Property tests: list operations never throw on valid Stacks, and `parse(print(x))` still equals `x` for the extended AST.

**Exit criteria:** a creator builds an inventory (add an item from an input, see the list, remove an item) and a recipe collection with the editor alone; preview and web export behave the same; the runtime still never throws.

#### M2.8 — Quality (size M, rolling)

**Outcome:** Safe to ship. Depends on nothing; runs alongside the others.

- [x] GitHub Actions CI: typecheck, lint, format, unit tests, build, e2e on Chromium, with the dev server started by the workflow (the Playwright-managed server dropped twice in the audit). Green on a GitHub runner on 2026-11-27.
- [x] Code splitting: lazy-load CodeMirror and the behavior editor; budget for the initial bundle, checked in CI. Keep the standalone player small.
- [x] Automated accessibility scan in e2e on every main screen (propose `@axe-core/playwright` as a dev dependency; state its cost before adding).
- [x] Firefox and WebKit runs of the core flows. Core flows pass on both (2026-11-27), with `GS_BROWSERS=firefox,webkit`.
- [ ] A real crash test for recovery if it can be made reliable; otherwise keep the seeded-checkpoint flow and document the limit. Decision: keep the seeded-checkpoint flow; a real tab crash cannot be triggered reliably because closing a tab flushes the save.
- [ ] Visual regression baselines for the main screens (cut candidate). Cut (cut order item 2).
- [x] Reject path-unsafe ids at the domain boundary (card, element, asset and behavior ids in `validateStack`), with a property test that exports and re-imports generated ids. Found by a property test; see `docs/AUDIT-M2.md` section 9, item 10. Needed before AI or MCP can create cards.
- [x] Re-run the full audit flows after each merged chunk.

**Exit criteria:** CI is green on `main`; a11y scan has no serious or critical violations; the web bundle is split and within budget.

**Issues:** Draft only.

### M3 — AI Integration & Quality

**Target:** December 2–3 (scope re-cut at the Dec 1 checkpoint)

**Sequencing (owner decision 1):** starts after the M2.x chunks. If time is short, follow the cut order in section 2. The building blocks already on `main` are `StackSession.restore` (one undoable step), `StackSession.dispatch`, checkpoints, `applyCommand` (pure, validated, returns `Result`), `validateStack`, safe-id validation and the full `ProjectCommand` set. The plan schema, adapters, approval UI, transaction manager and MCP transport are not built.

**Outcome:** The validated AI workflow is integrated into the working editor.

**Plan status:** Implemented and verified on `main` 2026-11-27. Only the live Ollama run is open.

**M3 status tracker (updated 2026-11-27; the repository outranks this table):**

| Slice | Status | Evidence | Next action |
|---|---|---|---|
| M3.0 Contract lock | Done | `shared-contracts/src/ai.ts`, UI_CONTRACT section 9, briefs in `docs/handoffs/m3/` | None |
| M3.1 AI core | Done | `packages/ai-core`, 129 tests plus properties; `docs/handoffs/m3/m3-1-result.md` | None |
| M3.2 Providers | Done; hosted verified live | `packages/ai-providers`; `m3-2-result.md`; `tests/e2e/m3-live-openrouter.spec.ts` (OpenRouter, 2026-11-27) | Live Ollama run (owner) |
| M3.3 AI panel UI | Done | `features/ai`, `tests/e2e/m3-ai.spec.ts` (13 pass); `m3-3-result.md` | Remote consent dialog has a component test only |
| M3.4 Integration | Done | Wiring in `features/workspace/AIDock.tsx`; full gate and e2e (85 passed, 2 skipped) | None |
| M3.5 MCP | Done, spike passed | `packages/mcp-server`, `features/ai/bridge`, `docs/MCP.md`; the SDK stdio client builds and exports an app (`tests/e2e/m3-mcp-build-app.spec.ts`) | Optional: a desktop MCP client for the demo video |
| M3.6 Hardening | Done except live Ollama | Offline critical journey, live hosted provider, MCP app build, Firefox and WebKit, security sweep, CI green on GitHub | Live Ollama run (owner) |

Packages on `main`: `behavior`, `domain`, `player`, `project-format`, `shared-contracts`, `storage`. `ai-core`, `ai-providers` and `mcp-server` now exist.

#### M3 principles (apply to every slice)

- AI output and MCP input are untrusted. Parse with Zod, then dry-run on an isolated copy, then show the plan, then apply only after approval.
- A plan contains `ProjectCommand`s only. No JavaScript, no free-form patches, no file access. Behavior changes go through `UPDATE_BEHAVIOR` and are validated by the existing behavior validator.
- One approved plan is one transaction: pre-operation checkpoint, apply on a copy, `validateStack`, commit with `StackSession.restore` (one undo step), or discard. A failed or cancelled operation leaves the open Stack byte-identical.
- No silent fallback from local to hosted. The active provider and its local or remote label are always visible. First send to a remote provider needs an explicit consent that shows what data is sent.
- Keys live in memory for the session only. Never written to IndexedDB, `.gsp`, exports, logs, error messages or e2e artifacts.
- The editor works with AI absent, offline, misconfigured or crashed. The AI feature is lazy-loaded and wrapped in an error boundary.
- No new runtime dependency for providers: use `fetch`. The only candidate new dependencies are the MCP SDK and a WebSocket library for the bridge (owner approval, M3.0).

#### M3.0 — Contract lock and approvals (orchestrator, on `main`, before any worktree; size S)

**Outcome:** Every worktree inherits one AI contract and the same rules.

- [x] Add `packages/shared-contracts/src/ai.ts`: `AIPlan` v1 (Zod schema, `schemaVersion`, `summary`, `affectedCardIds`, ordered `steps[]`, each step `{ id, cardId?, rationale, command: ProjectCommand, dependsOn?: string[] }`, optional `providerMeta`), `ProjectContext`, `AIProviderAdapter` (ARCHITECTURE 7.3 plus `capabilities: { structuredOutput, jsonMode, streaming, local }`), `ProviderConfig`, `AIOperation` state (`planning`, `review`, `applying`, `done`, `failed`, `cancelled`, `reverted`).
- [x] Add a pure allowlist of commands an AI plan may contain (proposal: all card, element, behavior and state-schema commands; excluded: `REGISTER_ASSET`, `REPLACE_ASSET`, `REMOVE_ASSET`, `SET_VIEWPORT`, `RENAME_STACK`). Limits: at most 50 steps and 64 kB per plan.
- [x] Confirm all ARCHITECTURE 7.8 error codes exist in `ERROR_CODES` (they do today); add `AI_OPERATION_CANCELLED` only if the owner agrees.
- [x] Amend `docs/UI_CONTRACT.md` with section 9, M3 amendments: AI panel slot in the shell, status-bar provider indicator, ownership table below, rule that only `StackSession` mutates the Stack, key-handling rule, plan wording rules.
- [x] Amend `docs/ARCHITECTURE.md`: add `ai-core`, `ai-providers`, `mcp-server` to section 5, and record T-013 once validated (M3.5).
- [x] Update `docs/PRD.md` only if the Dec 1 checkpoint changes F-009 to F-011 priority (owner edits it). No priority change was made, so the PRD is unchanged.
- [ ] Create one Kiro spec per slice in `.kiro/specs/` (requirements, design, tasks) and review each before execution. Partial: specs exist for M3.1 and M3.2; M3.3 and M3.5 ran from the briefs in `docs/handoffs/m3/`.
- [x] Gate on `main`: `typecheck`, `lint`, `format:check`, `test`, `build`, `bundle:check`, `test:hooks`, and e2e green before branching.

**Owner decisions (D1 to D6 approved 2026-11-27 with the recommendations below; D4 key supplied by the owner at test time, never committed):**

| # | Decision | Recommendation |
|---|---|---|
| D1 | Create packages `ai-core`, `ai-providers`, `mcp-server` (structure rule says only when the first slice needs them) | Yes, three packages with the boundaries in the table below |
| D2 | Add `@modelcontextprotocol/sdk` (and `ws` if WebSocket is chosen) to `mcp-server` only | Yes, confined to `packages/mcp-server`; verify the current stable version at install time and report bundle impact (none: it never enters the web bundle) |
| D3 | Command allowlist for AI plans (list above) | Accept the proposal |
| D4 | Hosted provider to verify for the exit criterion "one real provider" | Any OpenAI-compatible endpoint the owner has a key for (OpenAI, Groq or OpenRouter). The owner supplies the key at test time; it is never committed |
| D5 | MCP transport fallback if the bridge spike fails (M3.5) | File-based proposal inbox (below), documented as a limitation |
| D6 | Plan size limits (50 steps, 64 kB) | Accept |

#### Package boundaries and ownership (one worktree per row, exclusive folders)

| Slice | Worktree branch | Owns (exclusive) | May import | Must not touch |
|---|---|---|---|---|
| M3.1 | `feature/m3-ai-core` | `packages/ai-core/**` | `shared-contracts`, `domain`, `behavior` | `apps/web`, `storage` |
| M3.2 | `feature/m3-ai-providers` | `packages/ai-providers/**` | `shared-contracts`, `ai-core` types only | `apps/web`, `domain` internals |
| M3.3 | `feature/m3-ai-ui` | `apps/web/src/features/ai/**`, its e2e spec | `ai-core`, `ai-providers`, session hooks | central shell files (orchestrator wires the slot) |
| M3.5 | `feature/m3-mcp` | `packages/mcp-server/**`, `apps/web/src/features/ai/bridge/**`, its e2e spec | `shared-contracts`, `ai-core` | everything else |

Central files stay orchestrator-only (see `docs/UI_CONTRACT.md` section 1): shared contracts, router, shell slot, root `package.json`, CI. Each worktree writes `HANDOFF.md` (files touched, entry points, env changes, caveats, next step).

#### M3.1 — AI core: plan validation, context, transaction (size M)

**Outcome:** A pure, tested engine that turns an untrusted plan into a validated, reviewable, atomically appliable change.

- [x] `parsePlan(unknown)` returns `Result<AIPlan>` with `INVALID_AI_PLAN`; rejects unknown command types, disallowed commands, oversize plans, duplicate step ids, cyclic `dependsOn`.
- [x] `dryRunPlan(stack, plan)` applies steps in dependency order to a deep copy with `applyCommand`, then `validateStack`; returns per-step results and the resulting Stack, or the first failing step as `INVALID_PATCH_COMMAND` or `PROJECT_VALIDATION_FAILED`. Never mutates the input.
- [x] `summarizePlan(stack, plan)` groups steps by Card (new, changed, removed elements; behavior changes; state variables) for review. Pure data, no React.
- [x] `buildContext(stack, scope)`: selected Card, element ids and types, state schema, card list and navigation, registered action names and schemas. Excludes asset bytes and anything outside scope; has a character budget with deterministic truncation. Redaction test: no data URLs or asset bytes appear.
- [x] `runTransaction(session, plan, { onProgress, signal })`: create checkpoint `Before AI: <summary>`, dry-run, commit via `session.restore(resultStack)` as one undo step, report progress per step, honor cancellation before commit. Failure injection hooks for tests (fail at step N, fail validation, fail checkpoint, fail restore).
- [x] `revertOperation`: restore the pre-operation snapshot (also reachable as ordinary undo).
- [x] Error normalizer for provider HTTP errors and malformed JSON into section 7.8 categories, honoring `Retry-After`.
- [x] Tests: unit; `fast-check` properties (dry-run never mutates input; any plan that passes `dryRunPlan` yields a Stack that passes `validateStack`; failed transaction leaves Stack deep-equal to the original; apply then revert equals the original; plan parse is total, never throws on arbitrary JSON); a `.gsp` export and re-import round trip of a Stack changed by a plan.

**Exit criteria:** all of the above pass with no browser globals and no React in the package.

#### M3.2 — Provider adapters (size M)

**Outcome:** Three adapters behind one interface, each testable without a network.

- [x] Deterministic demo adapter (T-011): rule-based, offline, repeatable. Must produce real plans for the two demos, for example "add a quiz question card with three answers and branch to a result card" and "add a recipe card with an ingredients list and an add-item button". Same input gives the same plan (snapshot tests).
- [x] OpenAI-compatible adapter (T-010): `fetch` to a configurable base URL, `/chat/completions`, JSON schema or JSON-mode output where capabilities say so, otherwise prompt-and-parse; one bounded repair retry for invalid JSON; no retry for anything that mutates; timeout and `AbortSignal`; normalized errors (401 → `PROVIDER_AUTH_FAILED`, 429 → `PROVIDER_RATE_LIMIT`, network or CORS → `PROVIDER_UNAVAILABLE`, schema failure → `INVALID_AI_PLAN`). `testConnection` calls `/models`.
- [x] Ollama adapter (T-010): `/api/chat` with `format` set to the plan JSON schema, `/api/tags` for connection test and model list, default `http://127.0.0.1:11434`, labelled local. Document `OLLAMA_ORIGINS` for browser access.
- [x] Provider registry returning capabilities; no fallback between providers unless configured (F-012 is P1, not built; a failure is reported, never rerouted).
- [x] The system prompt and output schema live in one module, with the allowed command list generated from the allowlist (single source of truth).
- [x] Tests with a local mock HTTP server: success, 401, 429 with `Retry-After`, 500, timeout, truncated JSON, valid JSON with a disallowed command, prompt-injection text inside Stack content (must not widen the allowlist), and key never appearing in any thrown error or logged string.

**Exit criteria:** adapters pass the shared contract test suite; zero network calls in `npm test`.

#### M3.3 — AI panel UI and approval workflow (size L)

**Outcome:** A creator configures a provider, asks for a change, reviews a Card-grouped plan, approves or rejects, watches progress, reads the report and can revert.

- [x] Shell integration: dockable AI panel (right side, same resize and persistence rules as other panels), menu item and shortcut, status-bar chip showing provider name, local or remote badge and connection state (`not configured`, `testing`, `ready`, `error`). Lazy chunk; initial bundle budget unchanged (`bundle:check`).
- [x] Provider settings: choose Demo, Ollama or OpenAI-compatible; base URL, model, API key field (password type, in memory only, cleared on tab close; non-secret settings may persist in IndexedDB under `interfacePrefs`, never the key); Test connection with clear result text.
- [x] Remote consent dialog on first send per session: names the provider, lists what is sent (Stack title, selected Card, element summaries, state schema; no assets), requires an explicit action.
- [x] Prompt box with scope selector (whole Stack or selected Card) and context preview ("what will be sent").
- [x] Plan review: grouped by Card, each step with plain-language description and a collapsible command detail; validation status per step; Approve, Reject, Revise request (returns to the prompt with the previous text). Approve is disabled while any step fails dry-run.
- [x] Progress and cancel while applying; completion report (counts and a per-Card change list); Revert button; the operation also appears in undo history as one step.
- [x] Error display for every section 7.8 AI category with a next action (check key, check Ollama, retry, edit request); never shows raw provider bodies or keys.
- [x] Accessibility: keyboard flow for the whole panel, focus management in dialogs, live region for progress, axe scan with no serious or critical findings on the panel open.
- [x] Verify that an AI failure (provider down, invalid plan, thrown error in the panel) does not affect manual editing, undo or autosave.
- [x] Tests: component tests; e2e with the demo adapter (full journey: prompt, review, approve, see changes on canvas, preview, revert, undo); e2e with a local mock OpenAI-compatible server for failures (401, 429, invalid JSON, slow response with cancel); e2e proving no key in IndexedDB, in an exported `.gsp` or in a web export.

**Exit criteria:** the demo-adapter journey and the mock-server failure flows pass in Chromium; axe is clean.

#### M3.4 — Integration and wiring (orchestrator, size S)

- [x] Merge M3.1, M3.2, M3.3 in that order; wire the panel into the shell slot; run the full gate after each merge.
- [x] Re-run `audit-flows`, `m2-full-flow` and the M2.x specs to prove manual editing is unchanged.
- [x] Verify preview and web-export parity for a Stack built by the demo adapter (quiz and recipe).

#### M3.5 — MCP server and bridge (size L, high risk, T-013)

**Outcome:** An external agent can inspect a Stack and submit a proposal that appears in the same approval queue; it cannot change the project on its own.

**Step 1: T-013 validation spike (time-box 3 hours, do first).** Browser state lives in IndexedDB of an open tab, so a stdio MCP process cannot read it directly. Candidate design:

- `packages/mcp-server` runs as a stdio MCP server launched by the agent (`node` entry). It also opens a loopback-only WebSocket listener (`127.0.0.1`, random port, printed to stderr) that the browser tab connects to as a client after the user pastes or scans a one-time pairing token. The tab answers read requests from the live `StackSession` and enqueues proposals into the approval queue.
- Security (ARCHITECTURE 8.4): bind loopback only, per-launch random token, `Origin` and `Host` validation, no wildcard CORS, tool allowlist, payload size limit, one paired tab at a time, pairing visible in the UI with a Disconnect button.
- Spike pass criteria: an agent calls `get_stack_summary` and gets the live Stack; `propose_stack_patch` produces a plan in the review UI; a wrong token and a wrong `Origin` are rejected.
- **Fallback (decision D5) if the spike fails or runs over:** file-based inbox. The MCP server holds no live state; `propose_stack_patch` writes a validated `AIPlan` JSON file, and the user opens it in the AI panel with an Import plan action. Read tools then work from an exported `.gsp` path the agent is given. This keeps the approval boundary and the demo; the limitation is documented.

**Step 2: tools (ARCHITECTURE 7.6).**

- [x] `get_stack_summary`, `get_card_details`, `list_registered_actions`, `validate_project` (read-only, Zod-validated inputs, bounded output).
- [x] `propose_stack_patch` (gated): input is an `AIPlan`; runs `parsePlan` and `dryRunPlan`; result goes to the approval queue only. The response says "pending user approval" and never claims a change was made.
- [x] `create_checkpoint` (safe mutation): named snapshot only, rate-limited.
- [x] Every tool returns normalized errors (`MCP_CONNECTION_FAILED`, `INVALID_AI_PLAN`, …).
- [x] Tests: MCP SDK in-memory client against the server; property test that no tool call can change the Stack without an approval event; auth, origin and size-limit rejections; a conformance run with a real MCP client (Kiro or another client the owner has) recorded as evidence.
- [x] Docs: `docs/MCP.md` with setup for an external agent, tool reference, the approval flow, security model and transport limitations.

**Exit criteria:** the spike passes (or the fallback is in place and documented); a real MCP client inspects a Stack and proposes a change; approval is required; rollback works; no tool writes directly.

#### M3.6 — Quality and hardening (rolling, orchestrator plus `reviewer`; size M)

- [x] Provider failures, rate-limit and quota errors, invalid AI output, transaction failure injection, rollback and recovery, offline mode (demo adapter works with the network disabled), `.gsp` round trips after AI changes, behavior AST round trips (`parse(print(x)) = x`), preview and export parity, the complete critical journey (create, ask AI, approve, preview, export, import). Offline demo journey and `.gsp` round trip after an AI change: `tests/e2e/m3-critical-journey.spec.ts`.
- [x] Security review by `reviewer`: key handling grep (`apiKey` never in storage, logs or fixtures), prompt-injection cases, MCP origin and token, no `eval` or `new Function` (the write-guard hook enforces it), dependency audit (`npm audit`) after D2. Done by the orchestrator on 2026-11-27 (greps clean, `npm audit` 0 vulnerabilities, MCP binds 127.0.0.1).
- [ ] Manual verification record (commands, versions, date): Ollama with a real local model, one real hosted OpenAI-compatible provider (D4), and a real MCP client. These need the owner's machine and key; they are not claimed until run. Partial (2026-11-27): hosted provider passed (OpenRouter, `openai/gpt-4o-mini`, `tests/e2e/m3-live-openrouter.spec.ts`); MCP passed with the SDK stdio client building and exporting an app (`tests/e2e/m3-mcp-build-app.spec.ts`). Ollama not run: not installed on the build machine.
- [x] CI: add the new packages to typecheck, lint and test; run the workflow on a GitHub runner at least once (open since M2.8). Green on a GitHub runner on 2026-11-27.
- [x] Update `docs/KIRO-USAGE.md`, `docs/CHANGELOG.md`, `HANDOFF.md`, `docs/ARCHITECTURE.md` (T-013 result, section 14 risk rows) and the risk table below.

#### M3 schedule and waves

| When | Work | Parallel? |
|---|---|---|
| Dec 1 (checkpoint) | Owner answers D1 to D6; confirm scope; orchestrator does M3.0 on `main` | No |
| Dec 2 morning | M3.1 and M3.2 | Yes, two worktrees, disjoint packages |
| Dec 2 midday | M3.5 step 1 spike starts as soon as M3.1 exports `parsePlan` and `dryRunPlan` (stub types are enough to begin) | Yes, with M3.3 |
| Dec 2 afternoon | M3.3 UI against the demo adapter and mock server | Yes |
| Dec 2 evening | M3.4 merge and wire; full gate | No |
| Dec 3 morning | M3.5 step 2 tools and docs; M3.6 failure and security tests | Yes |
| Dec 3 midday | Manual verification with real providers and an MCP client; fix regressions | No |
| Dec 3 afternoon | Hand off to M4 | n/a |

If M3.0 can be done before Dec 2 (the M2.x chunks are merged and the gate is green), M3.1 and M3.2 can start earlier; the Dec 1 owner decisions are the only blocker.

#### M3 cut order (cut from the top first; matches section 2 item 4)

1. Streaming output, plan step editing, and per-step approval. Keep whole-plan approve or reject.
2. Ollama polish (model picker). Keep connection test and one working model.
3. `create_checkpoint` and `validate_project` MCP tools. Keep the three read tools and `propose_stack_patch`.
4. Live bridge: use the file-based inbox fallback (D5).
5. OpenAI-compatible adapter live verification. Keep the adapter with mock-server tests, and say "not verified against a hosted provider" in the docs and submission.
6. Never cut: demo adapter, plan review, approval gate, transaction with rollback, key safety, "editor works without AI".

#### M3 acceptance map

| Exit criterion | Proven by |
|---|---|
| One real provider completes the AI workflow | Manual run with D4 provider, recorded in `HANDOFF.md`; mock-server e2e for CI |
| Local Ollama integration works | Manual run against a real Ollama model plus adapter tests against a mock |
| Offline demo workflow works | e2e with network blocked, demo adapter journey |
| MCP demonstrable through the validated transport | Spike result in ARCHITECTURE T-013 and a recorded real client session |
| AI cannot bypass approval | Property test and e2e: no Stack change before Approve, for the panel and for MCP |
| Failed operations preserve valid state | Failure-injection unit and property tests; e2e with an invalid plan |
| Core editing usable without AI | e2e with the AI panel crashed or provider down; all M2 specs still green |
| No critical regression | Full gate and all e2e green after merge; `reviewer` pass |

**Exit criteria:**
- [x] At least one real provider can complete the AI workflow. OpenRouter, 2026-11-27.
- [ ] Local Ollama integration works. Not verified live: adapter tested against a mock server only. Owner action (install Ollama and one model).
- [x] Offline demo workflow works.
- [x] MCP integration is demonstrable through the validated transport.
- [x] AI operations cannot bypass approval.
- [x] Failed AI operations preserve valid project state.
- [x] Core editing remains fully usable without AI.
- [x] No critical regression remains.

**Verification (commands):** `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`, `npm run bundle:check`, `npm run test:hooks`, `npm run test:e2e` (start the dev server yourself with `GS_PORT`, then `GS_NO_WEBSERVER=1`). Any new per-package script is added only after it exists in `package.json`.

**Issues:** Draft only.

### M4 — Release & Demo

**Target:** December 3–4 (before 2:00 PM Pacific). Prepare items marked "early" in parallel with earlier chunks.

**Outcome:** A stable, accessible hackathon submission.

**Category (decided 2026-11-26): Resurrection.** The story to tell: HyperCard (cards, stacks, scripts that ordinary people could write) was a beloved tool that no longer runs on modern systems. GhostStack brings the idea back as a local-first browser editor with a safe behavior language (blocks and GhostScript over one AST), portable `.gsp` files, standalone export, and optional AI whose changes are reviewed before they apply. The video and write-up must show what was dead, what is new, and that it works.

**Early items (do not wait for Dec 3)**
- [ ] Request Kiro credits by Dec 1, 12:00 PM Pacific if needed.
- [ ] Keep `docs/KIRO-USAGE.md` current as work happens (specs, hooks, steering, PBT evidence, screenshots of the Kiro IDE flow). Judges grade how effectively Kiro was used.
- [x] Push `main` to the public repository once the owner approves. Confirm the license shows in the repository About section and `.kiro/` is committed. Public, Apache-2.0 shown, `.kiro/` committed (checked 2026-11-27).
- [ ] Decide whether to also publish a blog post and a social post (`#KiroweenHackathon26` at the start) for the bonus prizes.

#### Release preparation

- [ ] Freeze new feature development.
- [ ] Resolve critical bugs.
- [ ] Verify production build.
- [ ] Deploy the browser application.
- [ ] Verify the public application URL.
- [ ] Verify project creation and export on the deployed build.
- [x] Verify no secrets are included in source or build artifacts. Source and `apps/web/dist` scanned 2026-11-27.
- [x] Prepare README.
- [x] Prepare installation and usage instructions.
- [x] Include open-source license.
- [x] Verify `.kiro/` is included in the public repository.
- [x] Document AI integrations and limitations. README and `docs/MCP.md`.
- [ ] Document how Kiro was used (`docs/KIRO-USAGE.md`, summarised in the submission form).
- [ ] Verify all submission requirements.

#### Presentation

- [ ] Prepare a concise demonstration script.
- [ ] Record a public YouTube video under three minutes.
- [ ] Show the core editor workflow.
- [ ] Show a working behavior interaction.
- [ ] Show AI planning and approval.
- [ ] Show rollback or recovery.
- [ ] Show standalone application export.
- [ ] Explain why GhostStack is a resurrection of HyperCard's philosophy.
- [ ] Submit the public project description.
- [ ] Submit the working application URL.
- [ ] Submit the repository URL.
- [ ] Submit the demo video URL.
- [ ] Complete optional social/blog bonus submissions if time permits.

**Exit criteria:**
- [ ] Application is publicly accessible.
- [ ] Repository is public and includes source, license, assets, instructions, and `.kiro/`.
- [ ] Demo video is public and within the time limit.
- [ ] English project description is complete.
- [ ] Kiro usage is documented.
- [ ] Submission is completed before the deadline.

**Issues:** Draft only.

---

## 4. Vertical Slices

A vertical slice must produce a demonstrable outcome across the relevant UI, domain, storage, runtime, or integration layers.

| Slice ID | Vertical slice | PRD features | Milestone | Demo outcome |
|---|---|---|---|---|
| VS-00 | Repository and application foundation | Constraints | M0–M1 | Application starts and builds |
| VS-01 | Create and persist a Stack | F-001, F-015 | M1–M2 | Create a Stack and reopen it |
| VS-02 | Card management and navigation | F-002, F-005 | M2 | Navigate between multiple Cards |
| VS-03 | Visual element editing | F-003, F-004 | M2 | Add and arrange content |
| VS-04 | Behavior AST and runtime | F-006, F-007, F-008, F-013 | M2 | Interactive Card behavior works |
| VS-05 | Preview and standalone export | F-014, F-020 | M2 | Run and export an application |
| VS-06 | GSP and asset portability | F-018, F-019 | M1–M2 | Export and import a complete project |
| VS-07 | Autosave, undo, and recovery | F-015, F-016, F-017 | M2 | Recover and revert project changes |
| VS-09 | AI plan and transaction workflow | F-009, F-010, F-013, F-016 | M3 | Approve, execute, report, and revert |
| VS-10 | MCP agent workflow | F-011 | M3 | External agent proposes a controlled change |
| VS-11 | Release and submission | All MVP features | M4 | Public working GhostStack demo |
| VS-12 | Design system and brand | DESIGN section 9, F-022 (accent) | M2.1 | One look, generated brand, component gallery |
| VS-13 | Editor shell | F-003, F-022 | M2.2 | Menu bar, tool rail, status bar, resizable panels, zoom |
| VS-14 | Inspector | F-003, F-004 | M2.3 | Edit any property from tabbed inspector |
| VS-15 | Library, navigator and templates | F-001, F-002 | M2.4 | Create a quiz from a template and open it |
| VS-16 | Canvas craft | F-003, F-019, F-025 | M2.5 | Multi-select, paste, align, snap, background |
| VS-17 | Responsive defaults | F-003, F-014, F-026 | M2.6 | Editor, preview and export agree at any size |
| VS-18 | Behavior breadth (lists) | F-006, F-007 | M2.7 | Build an inventory and a recipe collection |
| VS-19 | Quality and CI | All | M2.8 | Green CI, split bundle, a11y scan |

### Slice implementation rules

Each slice must define:
- User-visible outcome.
- Included behavior.
- Components affected.
- Dependencies.
- Acceptance criteria.
- Automated verification.
- Manual demonstration evidence.

Do not create a separate frontend-only milestone followed by a backend-only milestone. Build demonstrable workflows whenever dependencies allow.

---

## 5. Current Focus

### Current issue

M4: Release and Demo. M2.1 to M2.8 and M3 are done and verified on `main` (2026-11-27). The only open M3 item is a live Ollama run.

### Why this is next

The product is feature complete for the MVP. What is left is what judges see: a public URL, a short video and a clear write-up.

### State on `main` (2026-11-27)

- Full gate green locally and on a GitHub runner (CI run 46036530838).
- Chromium e2e: 87 passed, 3 skipped (`audit-screens` without `AUDIT_SHOTS`, one existing skip, the live OpenRouter spec without a key). Firefox and WebKit pass the core flows.
- Live checks: OpenRouter (`openai/gpt-4o-mini`) and an MCP SDK client that builds, approves and exports an inventory app.

### Blockers

- None for M4. Ollama live verification needs Ollama and one model on the owner's machine.

---

## 6. Next Actions

1. Choose a static host and deploy `apps/web/dist` (the app needs no server). Verify create, edit, preview and both exports on the public URL.
2. Write the demo script around the Resurrection story: build a quiz from a template, add a behavior, ask the AI for a card, review and approve, revert, export the web app and open it.
3. Record the video (under three minutes) and publish it on YouTube.
4. Fill the submission: description, app URL, repository URL, video URL, Kiro usage summary from `docs/KIRO-USAGE.md`.
5. Optional, owner: run Ollama once and record it; update `actions/checkout` and `actions/setup-node` past v4 (Node 20 deprecation notice in CI).

---

## 7. Risks and Blockers

| Item | Impact | Next action | Status |
|---|---|---|---|
| MCP browser/local bridge | High | Prove shared project-state access | Closed: T-013 validated; SDK client builds an app end to end |
| Hosted provider browser access | High | Test CORS and session credential handling | Closed: OpenRouter from Chromium, 2026-11-27 |
| AI operation safety | High | Prove transaction rollback | Closed: checkpoint, one undo step, revert; property and e2e tests |
| Responsive canvas complexity | Medium | Prototype pinning and scaling | Closed: M2.6 (scale default, Fit preview, property tests) |
| `.gsp` archive implementation | Medium | Validate ZIP round-trip | Closed: round trips in unit, property and e2e tests |
| Behavior editor complexity | High | Establish AST contract before UI parallelization | Closed: blocks and GhostScript over one AST, round-trip property |
| P0 scope size | High | Protect core creation workflow and enforce scope cuts | Closed for MVP: layer panel and visual baselines cut |
| Deadline compression (8 days, M2.1 to M2.8 plus M3 plus M4) | High | Follow the cut order in section 2; hold the Dec 1 checkpoint; start M4 by Dec 3 | M2.x and M3 done Nov 27; M4 remains |
| AI features (F-009 to F-011, PRD P0) not built | High | Detailed plan in section 3 (M3); owner answers D1 to D6 at the Dec 1 checkpoint | Closed: built and verified |
| Browser CORS for hosted and Ollama endpoints | High | Mock-server tests in CI; manual run with a real endpoint in M3.6; document `OLLAMA_ORIGINS` | Hosted closed; Ollama open (owner run, `OLLAMA_ORIGINS`) |
| Model returns invalid or hostile plans | High | Zod parse, command allowlist, dry-run on a copy, approval gate, property tests | Closed: schema, allowlist, dry run, approval; live run found and fixed three output gaps |
| API key leakage | High | Memory-only key, e2e check of IndexedDB, `.gsp` and exports, error-message tests | Closed: e2e checks storage, `.gsp`, exports; dist scanned |
| List model changes the behavior contract | High | Lock in the orchestrator prep; keep the AST closed and safe; property tests | Closed: locked in M2.x prep, property tests |
| Brand and visual identity take longer than planned | Medium | Generate from one SVG source; limit to one mark, one wordmark, defined variants | Closed: generator with six variants |
| Playwright-managed dev server dropped twice | Medium | CI and local runs start the server explicitly (M2.8) | Closed: CI and local runs start the server (`GS_NO_WEBSERVER=1`) |
| Real crash recovery not proven by a real crash | Low | Seeded-checkpoint e2e and unit tests stay; revisit in M2.8 | Accepted: seeded-checkpoint flow kept and documented |
| Templates versus the no-mock-data rule | Low | Templates are user-initiated and built through commands; amend `docs/UI_CONTRACT.md` | Resolved by owner decision 4 |
| Desktop packaging | Low for MVP | Defer to P1 | Deferred |
| Native user-app packaging | Low for MVP | Defer to P2 | Deferred |

---

## 8. Change History

- **2026-11-27:** M3 planned in detail (slices M3.0 to M3.6, ownership, waves, cut order, acceptance map, owner decisions D1 to D6, T-013 spike with a file-inbox fallback). Re-verified `main` after a fresh pull: typecheck, lint, format, 348 unit tests, build, bundle check, hook tests and 70 Chromium e2e pass.

- **2026-11-26:** Milestones revised after the M2 audit (`docs/AUDIT-M2.md`). Owner approved chunks M2.1 to M2.8 and decided: core app first, prototypes are reference only, the agent designs the brand from code, templates allowed, new elements scale by default, lists for the recipe and inventory demo, accent presets in scope. M3 and M4 re-dated; cut order and a Dec 1 checkpoint added. Added `docs/KIRO-USAGE.md` and Kiro configuration for the hackathon write-up.
- **2026-11-26:** Post-M2 audit. 24 new Playwright flows; fixed clipped inspector inputs, a short behavior drawer, a toolbar-pushing checkpoint panel and the Midnight button contrast.- **2026-11-13:** Initial milestone plan created from the approved product direction and proposed architecture.
- **2026-11-15:** M0 re-audit. PRD, DESIGN, and ARCHITECTURE approved by the Product Owner; decision statuses and branch naming reconciled; `.gitignore` added. M0 remote verification and the initial commit are completed in the entry below.
- **2026-11-15:** M0 closed. SSH and `gh` verified; remote is public and empty with no issues or milestones. Initial commit pushed to `origin/main`. License and shared-contract owner remain owner decisions.
- **2026-11-26:** M2 closed. Card editor, behavior runtime, GhostScript, undo, autosave, recovery, checkpoints, preview, `.gsp` and web export merged; 178 unit tests and 7 Playwright flows pass. Details in `HANDOFF.md`.
- **2026-11-25:** M1 closed. VS-00, VS-01, VS-02 and VS-06 (library only) merged; 53 unit tests and 2 Playwright flows pass. Details in `HANDOFF.md`.
- **2026-11-25:** M0 closed. Apache-2.0 chosen, `LICENSE` and `.gitignore` added, stale spike branch deleted, ARCHITECTURE spike wording reconciled (T-013 open until M3 validation).
- **2026-11-25:** Clean-slate restart. Progress records were reset: M0 reopened, earlier results removed from the plan documents, implementation files removed by the owner. The AI Feasibility Spike milestone was removed (done in the earlier version); M3 to M5 renumbered to M2 to M4. Approved plans (PRD, DESIGN, ARCHITECTURE) kept; documents moved under `docs/`.
