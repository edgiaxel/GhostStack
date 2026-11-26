# GhostStack State Audit: M0 to M2

> **Date:** 2026-11-26. **Commit audited:** `main` after `0e3b0b4` plus the uncommitted fixes listed in section 8.
> **Purpose:** an honest picture of what exists, how it behaves and how it looks, so the milestones can be re-cut into smaller chunks.
> **Scope:** M0, M1 and M2 only. M3 (AI) and M4 (release) are not started and are out of scope here.
> **Method:** read the code, drove the running app in a real browser with Playwright (Chromium), took screenshots, ran 31 end-to-end flows, measured contrast, and compared the result with `docs/PRD.md`, `docs/DESIGN.md` and the Stitch prototypes in `docs/design/prototypes/`.

---

## 1. Summary

| Question | Answer |
|---|---|
| Does the core work? | Yes. A creator can build a multi-card interactive app, with behavior, without AI or internet. It survives reload, supports undo and redo, previews, exports `.gsp` and a standalone web zip, and re-imports. |
| Is it tested? | 178 unit tests (24 files) and 30 passing end-to-end flows (1 more is an opt-in screenshot run). Typecheck, lint, format and build are clean. |
| Did the audit find logic bugs? | No. It found 4 presentation and accessibility defects (all fixed, section 8) and 3 mistakes in my own tests. |
| Is the UI good? | No. It is functional but plain. It does not follow the approved prototypes, has no visual identity, a dense flat inspector, a cramped bottom drawer and a toolbar of 15 same-weight text buttons. Details in section 6. |
| Is the editor flexible? | Not yet. No zoom, multi-select, copy and paste, snapping, alignment, card backgrounds, resizable panels or asset manager. New content defaults to a fixed layout that does not scale in preview. |
| Can it build both MVP demos? | The quiz: yes (the `m2-full-flow` test builds one). The recipe or inventory app: no. Behavior has only single-value variables, no lists or collections. |
| Biggest schedule risk | The submission deadline is **Dec 4, 2026, 2:00 PM Pacific**, 8 days from this audit. AI features F-009 to F-011 are **P0** in the PRD and are not started. Expanding M2 compresses M3 directly. See section 10. |

---

## 2. Method and limits

**What was done**
- Drove the app through the same entry points a creator uses (no direct state injection except where stated).
- Captured 13 screenshots in all three themes (`docs/audit/`, index in Appendix B).
- Wrote 24 new Playwright flows (`audit-flows`, `audit-themes`, `audit-screens`) on top of the 7 existing ones.
- Measured text contrast with the project's checker (WCAG 2.x formula) and in a browser test.
- Compared against DESIGN.md (screens UI-01 to UI-09, section 9 visual direction) and two prototype screens (master editor workspace, project library hub).

**What was not done**
- No real browser crash. Closing a tab fires `visibilitychange`, which flushes the autosave first. The recovery path is covered by unit tests and by an e2e test that writes a newer recovery checkpoint into the real IndexedDB, then reloads.
- Chromium only. Firefox and WebKit were not run.
- No touch, no screen reader, no automated accessibility scan (no axe), no visual-regression baseline, no performance test with large stacks.
- The "before" screenshots of the three fixed layout bugs were viewed but not saved. The saved set shows the fixed state.
- Prototypes were compared by eye. They contain features outside the PRD (audio, HyperTalk script, a "deploy" button, storage "vacuum"); those are treated as reference only.

---

## 3. History from M0 to M2

| Phase | Dates | Result | Evidence |
|---|---|---|---|
| Original M0 and M1 | Nov 13 to 16 | Project documents, Kiro config, first foundation | `d572847`, `47f6f03` |
| Original spike | Nov 23 | AI feasibility spike: AI plan schema, transaction manager, provider adapters, MCP bridge prototype, tested against mocks and one live run | commits `24039c3` to `6b67ef9` |
| Clean-slate reset | Nov 25 | Owner removed the earlier implementation, specs and reports. The spike milestone was dropped and M3 to M5 renumbered to M2 to M4 | `38b4ba0` |
| M0 re-closed | Nov 25 | Apache-2.0 license, `.gitignore`, spike wording reconciled, stale branch deleted | `616572e` |
| M1 | Nov 25 | App shell, hash router, three themes, zod project model, domain commands for Stacks and Cards, IndexedDB repository, `.gsp` library, Project Library page, Card navigator, Vitest and Playwright. 53 unit tests, 2 e2e | `e62b1b3` to `a3bb235` |
| M2 | Nov 26 | Everything in section 4, built in four worktrees (history, behavior, card editor, preview and export) under a shared contract, then merged. 178 unit tests, 7 e2e | `44ff6f0` to `0e3b0b4` |

Notes
- The Nov 23 spike code exists only in git history. The owner said not to restore it. It is a reference for M3, not a dependency.
- M2 was implemented by the orchestrator in sequence because delegated agents were unavailable. The worktree split, ownership rules and per-slice handoffs in `docs/handoffs/m2/` were still followed.
- The repository has 44 commits on `main`. Nothing has been pushed in this session.

---

## 4. How the app works today

### 4.1 What a creator can do

1. **Library** (`#/library`): create a Stack by title, import a `.gsp`, open, rename or delete (with confirmation) a Stack. Stacks are listed newest first with card count and last update.
2. **Workspace** (`#/stack/:id[/card/:id]`): a card navigator on the left, the canvas in the middle, an inspector on the right and a behavior drawer at the bottom.
   - Cards: add, rename, duplicate, reorder with up and down buttons, delete. Deleting a card that behaviors navigate to shows how many references exist, then removes those actions. Deleting the entry card promotes another. The last card cannot be deleted.
   - Elements: add text, button, input, image, shape (rectangle or ellipse) and line. Select, drag, resize by handles or keyboard, delete, change z-order, edit every property in the inspector, set anchor and scaling mode, set visibility and opacity.
   - Images: upload PNG, JPEG, GIF or WebP up to 5 MB. A missing file shows a labelled placeholder and a warning in the toolbar.
   - Viewports: Desktop (1280x720), Tablet (768x1024), Mobile (390x844). Editing works at Desktop; the other two preview how anchoring and scaling behave.
   - Behavior: per element or per card. Triggers: card opens, element clicked, input value changed. Actions: go to card, set variable, set text, show, hide, if/else. Conditions on any behavior. Variables of type number, text or true/false. Author with blocks or with GhostScript text (CodeMirror 6 with highlighting, autocomplete and live diagnostics). Both edit the same stored data.
   - History: undo and redo (up to 100 steps, one drag is one step), autosave after 600 ms, restore of unsaved work after an interrupted session, named checkpoints with confirmed restore (restore is itself undoable).
3. **Preview** (`#/stack/:id/preview`): runs the saved Stack with the same player and runtime as the export. Shows runtime issues. Restart and size controls.
4. **Export**: `.gsp` archive (refuses when image files are missing and says which), and a standalone web zip (`index.html`, `player.js`, `assets/`) that runs from `file://` with no network.

### 4.2 Architecture in brief

```text
apps/web (React + Vite)           features/ library, workspace, card-editor, behavior-editor,
                                  history, preview, export        app/ shell, router, services
packages/shared-contracts         zod model, command union, behavior AST, layout math, session + storage ports
packages/domain                   applyCommand, validateStack (cross-reference integrity)
packages/behavior                 runtime interpreter, GhostScript parser and printer
packages/player                   DOM renderer shared by preview and the standalone bundle
packages/project-format           .gsp export and import, web export
packages/storage                  IndexedDB (stacks, assets, checkpoints)
```

Rules that hold today: every Stack change is `session.dispatch` then `applyCommand` then `validateStack`; domain packages import no React or `idb`; behavior never uses `eval`; colors reach styles only after a hex check; text is set with `textContent`.

### 4.3 Data and persistence

IndexedDB database `ghoststack` version 2: `stacks`, `assets` (per Stack), `checkpoints` (per Stack, plus one `recovery:<stackId>` entry while edits are unsaved). Only the theme name is in `localStorage`. No server, no environment variables, no network calls.

---

## 5. Functional status against the PRD

Legend: **Done** meets the PRD criteria as built. **Partial** works but misses part of the criteria. **No** not started.

### P0

| ID | Feature | Status | Notes |
|---|---|---|---|
| F-001 | Stack management | Done | Create, open, rename, delete. No thumbnail, search, duplicate-stack or sort options. |
| F-002 | Card management | Done | All operations. Reorder is by up and down buttons only (no drag). Reference warning on delete works. |
| F-003 | Responsive card editor | **Partial** | Freeform canvas, z-order, inspector, anchoring, scaling and viewport presets work. Missing: zoom, multi-select, copy or duplicate element, align, snapping, editable reference-frame size (the field exists in the model, there is no command or UI). New elements default to fixed layout. |
| F-004 | Interactive elements | Done | Six types. Text is edited only in the inspector. Images work, no asset browser. |
| F-005 | Card navigation | **Partial** | Only through the "go to card" action. No dedicated link control and no relationship view (that view is P1, F-023). Broken links are removed on delete (tested). |
| F-006 | Behavior runtime | Done | 3 triggers, 6 actions, safe evaluator, loop limits, errors reported without touching the Stack. |
| F-007 | Application state | **Partial** | Variables of number, text and boolean. Input fields can bind to a variable. No lists or collections. |
| F-008 | Conditional behavior | Done | Conditions and if/else, same in preview and export (tested). |
| F-009 | AI-assisted authoring | No | M3. |
| F-010 | AI planning and execution | No | M3. Building blocks exist: `StackSession.restore`, checkpoints, validated commands. |
| F-011 | MCP integration | No | M3. |
| F-013 | Behavior validation | Done | For behaviors and project references. The AI-proposal half belongs to M3. |
| F-014 | Preview mode | Done | Runtime issues visible. See U13: default content does not scale to the window. |
| F-015 | Local persistence and autosave | Done | Recovery proven by unit tests and a seeded e2e, not by a real crash. |
| F-016 | Undo and redo | Done | Covers every command, including card delete. |
| F-017 | Checkpoints | Done | Basic scope: manual and automatic-before-restore, 20 automatic kept. |
| F-018 | `.gsp` format | Done | Checksums, path and size limits, reference validation, all-or-nothing import. |
| F-019 | Asset management and recovery | **Partial** | Store, lookup, fallback and warnings work. No asset list or manager. "Remove image" clears the element reference only; the asset stays registered and stored and is still exported (read from code, not tested). Re-linking means uploading again. |
| F-020 | Standalone web export | Done | Runs from `file://`, no editor code, no credentials. Delivered as a zip the creator must unzip. |

### P1 (for reference)

| ID | Feature | Status |
|---|---|---|
| F-012 | Provider fallback | No |
| F-021 | Desktop app | No |
| F-022 | Customizable workspace | No. Panel sizes are fixed. |
| F-023 | Relationship graph | No |
| F-024 | Shared backgrounds and templates | No. There is not even a per-card background color; the stage is always white. |
| F-025 | Layer panel | No. Four z-order buttons exist. |
| F-026 | Responsive device preview | Partial. Three presets in the editor, a size menu in preview. |

### Gaps that matter for the two MVP demos

- **Branching quiz:** buildable. The `m2-full-flow` test builds a two-card quiz with a score variable, a conditional jump and a live label.
- **Recipe collection or inventory:** not buildable well. It needs repeated records (a list of recipes or items), which the behavior model cannot express. This is a contract-level gap (AST, runtime, editor), not a UI gap.
- **Starting a project:** a creator starts from a blank white card with no templates or examples. The prototype's template picker addresses this. Whether templates fit the "no mock data" rule is an owner decision (section 10.3).

---

## 6. UI and UX audit

Screenshots are in `docs/audit/` (Appendix B). Severity: **High** blocks comfortable use or a stated requirement, **Medium** hurts quality or discoverability, **Low** is polish.

### 6.1 Against the approved design

DESIGN section 9 asks for "modern, minimal, editor-oriented" with rounded corners, restrained glass-like surfaces, clear panel boundaries and a Halloween default with accent presets. The three theme palettes match DESIGN's hex values, with one deliberate deviation: the Midnight primary accent is now `#7C3AED` instead of DESIGN's `#8B5CF6` (see U4). Most of the rest is not built.

| DESIGN item | Built? | Gap |
|---|---|---|
| UI-01 Project Library | Basic | Prototype shows stack cards with thumbnails and descriptions, search and filter, sort, per-stack export and duplicate, a template picker, an import drop zone with a pre-inspection checklist, a storage meter. Built: a title field and a list of text rows. |
| UI-02 Stack workspace | Basic | Prototype shows card thumbnails with ids, an active badge, drag handles, search and an assets section. Built: text rows with up and down arrow buttons. |
| UI-03 Card editor | Basic | Prototype: tool rail (select, text, image, button, shape), zoom with Fit, a dark surround. Built: a row of "Add ..." buttons, no zoom. |
| UI-04 Inspector and behavior editor | Basic | Prototype: tabs (Content, Layout, Appearance, Behavior) with the behavior pipeline inside the inspector and a Visual/GhostScript switch. Built: one long flat form, behavior in a separate bottom drawer. |
| UI-05 AI assistant | No | M3. |
| UI-06 Preview | Basic | A bar and a frame. |
| UI-07 Import and export | Basic | Three buttons and one line of status text. |
| UI-08 History | Basic | Undo, redo, status, a floating checkpoint panel. |
| UI-09 Settings | No | Only a theme dropdown. No accent presets or independent accent color (DESIGN section 9). |
| Menu bar (File, Edit, Insert, Arrange, View, Help) | No | Present in the prototype. |
| Status bar (card position, mode, save state) | No | Present in the prototype. |
| "Collapsible Console and Validation Drawer" (P0 layout) | No | The bottom drawer holds the behavior editor and cannot collapse or resize. |
| "Elements and Assets Toolbox" (P0 layout) | Partial | Elements: yes, as a button row. Assets: none. |
| Restrained glass-like surfaces | No | Flat panels. |

### 6.2 Findings

| ID | Sev | Area | Finding | Status |
|---|---|---|---|---|
| U1 | High | Inspector | The right-hand inputs (Y and Height) were clipped by the panel edge at every width tested. | **Fixed** |
| U2 | High | Behavior drawer | The drawer was 160 px high and its header scrolled out of view behind its own content, so the active tab and the owner name disappeared. | **Fixed** (300 px, sticky header). Side effect: see U9. |
| U3 | Medium | Checkpoints | The checkpoint panel opened inside the toolbar and pushed the toolbar to three rows and the canvas down. Its label overlapped the input. | **Fixed** (floating panel) |
| U4 | High | Accessibility | Midnight theme: primary button text on the accent was 4.23:1, below WCAG AA 4.5:1. | **Fixed** (accent `#8B5CF6` to `#7C3AED`, white text 5.70:1). This deviates from DESIGN's `#8B5CF6`. Keeping that value with near-black text gives only 4.50:1, which is borderline. Owner to confirm (section 10.3, item 7). |
| U5 | Medium | Accessibility | Input and panel borders are about 1.3:1 against their background in all three themes (WCAG non-text contrast asks 3:1). | Open |
| U6 | High | Visual identity | No identity beyond an orange accent: text wordmark only, no mark, no illustration, no imagery, no character. The three themes are recolors of one layout. DESIGN asks for a subtle Halloween identity; none is visible. | Open |
| U7 | High | Library | A narrow column of text on a large empty page. No thumbnails, no description, no search, no sort, no template or example, no storage information. First impression is the weakest screen. | Open |
| U8 | Medium | Toolbar | 15 controls in two rows (6 actions, 6 "Add" buttons, 3 viewport buttons), all the same weight, text only, no icons, no grouping. "Preview" and "Export" read like undo. | Open |
| U9 | Medium | Layout | At 1440x900 the canvas area is about 420 px high while the stage needs about 500 px at fit scale, so the lower part of the card is hidden behind scrolling. The fixed grid gives the canvas what is left after the drawer. | Open |
| U10 | Medium | Canvas | The stage is always white (no card background setting). New elements cascade stacked at the top-left. Selection handles are 12 px. No zoom. | Open |
| U11 | Medium | Navigator | Text-only list. Per-card actions wrap to two rows with tiny arrow glyph buttons and an always-visible red Delete. | Open |
| U12 | Medium | Inspector | One long scroll with no sections or tabs. Raw hex text fields, native color pickers, a nine-word dropdown for anchor, "Opacity (0 to 1)" as a number. | Open |
| U13 | High | Responsive output | Default scaling is "fixed". In preview at window size the content keeps its authored pixel size and sits in the top-left of a mostly empty white frame; at phone width it is cropped on the right (`10-preview.png`, `11-preview-phone-window.png`). The editor shows a 1280x720 frame, so authoring and preview disagree out of the box. | Open |
| U14 | Medium | Behavior editor | Blocks are rows of native selects. GhostScript refers to elements by generated id, so the creator must open a list of ids. Diagnostics from domain checks point at line 1. | Open |
| U15 | Medium | Feedback | Save, export and error messages are plain inline text. No toasts, no progress for export, no success state for import beyond navigation. | Open |
| U16 | Low | Typography | `Inter` is declared but no font is bundled or loaded, so the system font is used. Small uppercase panel titles carry most of the hierarchy. No type scale. | Open |
| U17 | Low | Discoverability | No keyboard shortcut list. Only undo and redo have shortcuts; element arrow keys are undocumented. The terms "Stack" and "Card" are never explained. | Open |
| U18 | Low | Panels | Panels cannot be resized or collapsed (DQ-001; F-022 is P1, but the P0 layout asks for a collapsible drawer). | Open |

### 6.3 What works well

- Every control is a real button, link or input with an accessible name, a visible focus ring and a pointer cursor. Tab reaches canvas elements; arrows, Alt+arrows and Delete work.
- Empty, loading and error states exist on every data view and say what to do next.
- Destructive actions are confirmed and, where possible, undoable.
- Three themes switch without layout breakage and persist across reload.
- The editor does not crash on missing images, bad scripts, runtime errors or corrupt imports (all tested).
- No horizontal page overflow at 390, 768 and 1024 px (tested for library, workspace and preview).

### 6.4 Responsive and device behavior

- Below 960 px the workspace stacks navigator, canvas, inspector and drawer vertically. It does not overflow but is not designed for phones (DESIGN says the editor is desktop-oriented).
- The authored application is the larger concern: see U13.

---

## 7. Test evidence

### Commands run on `main` (all passed)

| Command | Result |
|---|---|
| `npm run typecheck` | 0 errors |
| `npm run lint` | 0 problems |
| `npm run format:check` | clean |
| `npm test` | 24 files, 178 tests passed |
| `npm run build` | passed (web bundle about 829 kB, 261 kB gzip; standalone player 107 kB, 31 kB gzip) |
| `npx playwright test` | 30 passed, 1 skipped (opt-in screenshots) |

### End-to-end specs (`tests/e2e/`)

| File | Flows | What it proves |
|---|---|---|
| `m1-core-flow` | 2 | Library to workspace, card CRUD, theme, unknown stack id |
| `m2-card-editor` | 1 | Add, edit, drag, keyboard move and resize, invalid value, z-order, image, anchoring in Tablet, reload, delete and undo |
| `m2-behavior` | 1 | Blocks and GhostScript edit the same data and persist after reload |
| `m2-history` | 1 | Undo, redo, checkpoint save and restore, reload |
| `m2-preview-export` | 1 | Preview, `.gsp` round trip as a second Stack, corrupt file rejected, web zip runs from `file://` |
| `m2-full-flow` | 1 | M2 exit criteria: build a quiz with behavior, reload, undo, preview, web export played offline, `.gsp` round trip keeps behavior |
| `audit-flows` | 20 | See below |
| `audit-themes` | 3 | WCAG AA text pairs and focus color in each theme, read from computed styles |
| `audit-screens` | 1 (opt-in) | `AUDIT_SHOTS=1` regenerates `docs/audit/*.png` |

`audit-flows` covers: empty title error and library rename and delete; document title and library reload; last-card guard; deleting a referenced card (warning, action removed, undo restores both); entry-card promotion and persisted reorder; unknown card id in the URL; one drag equals one undo step; keyboard-only selection, move and deselect; wrong-type and oversize image uploads; missing image bytes (fallback, warning, blocked `.gsp`, web export with placeholder); script error line and nothing invalid saved; runtime error shown in preview without breaking it; input bound to a variable driving text; recovery checkpoint applied and announced once; theme persistence; empty-stack web export from `file://`; no console, page or HTTP errors in a normal session; no overflow or clipped inspector controls at 390, 768 and 1024 px.

### Not covered

Real tab crash, Firefox, WebKit, touch, screen readers, pointer resize by handles (resize is tested by keyboard and by unit tests of the geometry), nested if/else built through the blocks UI (covered through GhostScript), large stacks, storage quota exhaustion in the browser, visual regression.

### Test infrastructure note

Twice during this audit the Playwright-managed dev server stopped mid-run and the remaining tests failed with `ERR_CONNECTION_REFUSED`. The cause was not determined. Starting the dev server yourself (the `dev` script) and then running `npx playwright test` in a second terminal gave stable runs, because the config reuses an existing server. Treat this as an open CI risk.

---

## 8. Defects found and fixed in this pass

| # | Defect | Found by | Fix | Re-verified |
|---|---|---|---|---|
| 1 | Inspector X/Y and Width/Height pairs overflowed the panel (U1) | `audit-flows` overflow test, screenshots | Grid uses `minmax(0, 1fr)`, inputs `width: 100%; min-width: 0` (`card-editor.css`) | 20/20 audit flows, screenshot |
| 2 | Behavior drawer too short and header scrolled away (U2) | Screenshot | `--gs-drawer-h` 160 to 300 px; header is sticky (`tokens.css`, `behavior.css`) | Screenshot |
| 3 | Checkpoint panel pushed toolbar and canvas (U3) | Screenshot | Panel is absolutely positioned under the toolbar, label laid out as a column (`history.css`, `base.css`) | Screenshot, history e2e |
| 4 | Midnight primary button contrast 4.23:1 (U4) | Contrast checker | Accent set to `#7C3AED`; the new `audit-themes` test guards all themes | `audit-themes` 3/3 |

Test mistakes made and corrected (not product bugs): a button added to the wrong card, a click outside the scaled stage that waited until timeout, and an attempted crash simulation that the autosave correctly defeated.

---

## 9. Open defects and risks

1. **Fixed default layout** (U13): the first thing a creator sees in preview looks wrong. Likely a small change plus a preview mode, but it changes how every project behaves, so it needs a decision.
2. **Orphaned assets** (F-019): removing an image leaves its bytes in storage and in every export. Not tested, read from code.
3. **No lists in the behavior model** (F-007): blocks the recipe or inventory demo. Needs an AST and runtime extension.
4. **Single 829 kB bundle**: CodeMirror and zod load for every route. The standalone player also bundles zod.
5. **No CI** and an unexplained dev-server drop under Playwright (section 7).
6. **Crash recovery** is not proven by a real crash.
7. **Contrast of borders** (U5) fails the non-text criterion in all themes.
8. **Reference frame size** cannot be changed by a creator although DESIGN lists configurable dimensions as P0.
9. **Deadline compression:** see section 10.1.

---

## 10. Inputs for revising the milestones

These are inputs, not decisions. The owner decides scope and order.

### 10.1 Constraints

- Submission: **Dec 4, 2026, 2:00 PM Pacific.** From Nov 26 that is 8 calendar days.
- PRD P0 features still open after M2: **F-009 AI-assisted authoring, F-010 AI planning and execution, F-011 MCP integration.** The hackathon asks for meaningful Kiro use and a working demo; AI is part of the P0 story.
- M4 (deploy, README, video, submission) needs real time of its own.
- Every day spent on UI polish is a day not spent on M3. A smaller polish scope protects M3.

### 10.2 Possible breakdown of "make M2 good" into chunks

Sizes are relative (S small, M medium, L large), not time estimates. "Parallel" means the chunk touches different folders and can be its own worktree.

| Chunk | Goal | Main work | Size | Depends on | Parallel |
|---|---|---|---|---|---|
| M2.1 Design foundations | One coherent look and a component kit | Decide direction and identity (U6), tokens v2 (spacing, radius, elevation, type scale), load fonts, icon set decision, accent presets, border contrast (U5), shared components (button, tabs, field, toolbar, toast) | M | owner direction | no, first |
| M2.2 Editor shell | A workspace that feels like an editor | Menu bar, tool rail, status bar, resizable and collapsible panels, drawer redesign (U8, U9, U18), canvas zoom and Fit | L | M2.1 | with M2.7 |
| M2.3 Inspector | Fast, readable property editing | Tabs (Content, Layout, Appearance, Behavior summary), swatches, 3x3 anchor picker, units and steppers (U12) | M | M2.1 | with M2.4 |
| M2.4 Library and navigator | A strong first screen | Thumbnails, search and sort, duplicate and export per stack, first-run flow, card thumbnails and drag reorder (U7, U11) | M | M2.1 | with M2.3 |
| M2.5 Canvas craft | Flexible authoring | Multi-select, duplicate and copy and paste, align, snap and guides, card background, in-place text editing, asset panel and orphan cleanup, editable reference frame | L | M2.2 | partly |
| M2.6 Responsive defaults | Authoring equals preview | Choose the default scaling, preview fit modes, device frames, scale-aware text (U13) | S | decision | yes |
| M2.7 Behavior breadth and UX | Both demos buildable | Lists or collections for the recipe app, more triggers and actions, name-based references in GhostScript, friendlier blocks, real line numbers for domain errors (U14) | L | contract change | yes |
| M2.8 Quality | Safe to ship | GitHub Actions CI, code splitting, automated accessibility scan, Firefox and WebKit runs, bundle budget, stable Playwright server | M | none | yes |

A minimal credible polish slice, if AI must stay on time, is M2.1 plus the shell parts of M2.2, plus M2.3 and M2.6. M2.4 and M2.7 are the next most valuable (first impression and the second demo). M2.5 is the largest and the easiest to cut down.

### 10.3 Decisions needed from the owner

1. **AI scope and order:** keep F-009 to F-011 as P0 for Dec 4, or cut them? This sets how much polish is affordable.
2. **Visual direction:** are the Stitch prototypes the target? They include items outside the PRD (audio, HyperTalk, deploy, vacuum). Which parts are binding?
3. **Brand mark:** a logo or wordmark treatment is needed (the antislop rules say not to invent one without your instruction).
4. **Templates and sample projects:** the contract forbids mock data. A template would be a real project created by the user's own action. Is that acceptable, and which archetypes (quiz and recipe, per the MVP)?
5. **Default layout behavior:** should new elements scale with the window by default?
6. **Recipe or inventory demo:** confirm it stays in the MVP, since it forces the list model.
7. **Accent presets and independent accent color:** in scope for the polish pass, or later? Also confirm the Midnight accent change from `#8B5CF6` to `#7C3AED` (needed for AA contrast with white button text), or choose another way to meet 4.5:1.

---

## Appendix A: how to reproduce

```text
npm ci
npx playwright install chromium
npm run dev                      # leave running in one terminal
npx playwright test              # in another terminal; add AUDIT_SHOTS=1 to refresh docs/audit
npm run typecheck && npm run lint && npm run format:check && npm test && npm run build
```

The dev and e2e port can be changed with the `GS_PORT` environment variable.

## Appendix B: screenshots (`docs/audit/`)

Taken at 1440x900 unless noted, after the fixes in section 8.

| File | Shows |
|---|---|
| `01-library-empty.png` | Library with no stacks |
| `02-workspace-empty.png` | New stack, empty card |
| `03-workspace-elements.png` | All six element types, image selected |
| `04-inspector-button.png` | Button inspector |
| `05-behavior-script.png` | GhostScript tab |
| `06-behavior-blocks.png` | Blocks tab with a new behavior, sticky header |
| `07-checkpoints.png` | Floating checkpoint panel |
| `08-viewport-mobile.png` | Mobile viewport preview with the anchoring note |
| `09-theme-paper.png`, `09-theme-midnight.png` | The other two themes |
| `10-preview.png` | Preview at window size (U13) |
| `11-preview-phone-window.png` | Preview in a 390 px window, content cropped (U13) |
| `12-library-phone-window.png` | Library at 390 px |

## Appendix C: code metrics (lines include tests)

| Area | Files | Lines |
|---|---|---|
| `packages/shared-contracts` | 11 | 599 |
| `packages/domain` | 8 | 963 |
| `packages/storage` | 3 | 314 |
| `packages/project-format` | 6 | 854 |
| `packages/behavior` | 5 | 1010 |
| `packages/player` | 3 | 526 |
| `apps/web/src` | 53 | 5893 |
| `tests/e2e` | 8 | 940 |

Web features by folder: behavior-editor 8 files, card-editor 9, export 4, history 5, preview 2, project-library 4, workspace 5.
