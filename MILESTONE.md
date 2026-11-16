
# Milestones — GhostStack

> **Current milestone:** M1 — Foundation (complete, with limits listed in section 3); next: UI prototype, then VS-01  
> **Overall status:** M0 and M1 complete; the M1 work is not committed yet  
> **Deadline:** December 4, 2026 — 2:00 PM Pacific  
> **Last updated:** November 16, 2026  
> **Repository:** `edgiaxel/GhostStack`

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

- PRD, DESIGN, and ARCHITECTURE are approved by the Product Owner (Nov 15, 2026). T-013 (MCP bridge transport) stays open until the M2 spike.
- Remote `origin` is `git@github.com:edgiaxel/GhostStack.git`: public, empty before the initial commit, no issues or milestones. SSH and `gh` work as `edgiaxel`.
- The M1 foundation exists in the working tree and is uncommitted: `packages/domain`, `packages/storage`, `packages/project-format` and `apps/web`, with 62 test files (539 tests) passing. No CI exists. Evidence: `docs/M1-VERIFICATION.md`.
- The current UI is a functional foundation shell (Project Library and Stack workspace with placeholder toolbox, canvas and inspector). The prototypes in `DESIGN.md` are not implemented.
- Kiro credits are reserved for implementation.

### Next action

Build the UI prototype from the Google Stitch designs the owner is generating, then plan VS-01 (create and persist a Stack) against it. Run the AI feasibility spike (M2) before committing to the complete AI implementation.

### Links

- Repository: `https://github.com/edgiaxel/GhostStack`
- `PRD.md`
- `DESIGN.md`
- `ARCHITECTURE.md`
- `MILESTONE.md`
- GitHub Project: Not created or verified.

---

## 2. Milestone Overview

| ID | Milestone | Outcome | Planned dates | Status | Exit criteria |
|---|---|---|---|---|---|
| M0 | Audit & Preparation | Verified starting point and implementation boundaries | Nov 13–14 | Complete (Nov 15) | Repository, docs, risks, and first slice reconciled |
| M1 | Foundation | Running browser application and shared project core | Nov 14–16 | Complete (Nov 16), see limits in section 3 | Application builds and project model works |
| M2 | AI Feasibility Spike | Evidence that the highest-risk AI paths are viable | Nov 16–19 | Pending | Provider, MCP, transaction, and rollback tests completed |
| M3 | Core Creation Workflow | Complete usable Card-based application authoring workflow | Nov 19–27 | Pending | Create, edit, save, behavior, preview, and export work |
| M4 | AI Integration & Quality | Integrated AI workflow and verified MVP | Nov 27–Dec 1 | Pending | AI plan, approval, execution, rollback, and regression tests pass |
| M5 | Release & Demo | Public working application and hackathon submission | Dec 1–4 | Pending | Deployment, documentation, video, and submission complete |

Dates are targets, not promises. If a milestone slips, remove lower-priority scope before compressing validation and release testing.

---

## 3. Milestone Details

### M0 — Audit & Preparation

**Target:** November 13–14

**Outcome:** A trustworthy, verified starting point.

Tasks:
- [x] Verify the GitHub repository, default branch, and repository contents. (Public, empty, no default branch until the first push.)
- [x] Verify local Git status, remotes, SSH access, and working directory.
- [x] Confirm whether any existing files or branches need preservation. (No local commits or branches exist; the 9 root files, `docs/`, and `.kiro/` are untracked and must be preserved.)
- [x] Review PRD, DESIGN, ARCHITECTURE, and MILESTONE consistency. (Nov 15, 2026; see `docs/PROJECT-AUDIT.md`.)
- [x] Confirm `.kiro/` will be committed at the repository root. (`.gitignore` added; `git check-ignore` reports `.kiro/` files are not ignored.)
- [x] Establish the initial dependency and runtime choices. (Stack approved in `ARCHITECTURE.md`; Node.js v24.22.1 and npm 11.19.1 observed; package versions are chosen in M1.)
- [x] Identify the owner of shared domain contracts. (`edgiaxel`, recorded in `ARCHITECTURE.md` section 11.)
- [x] Record technical risks and implementation boundaries. (`ARCHITECTURE.md` §14 and `.kiro/steering/`.)
- [x] Select the first vertical slice. (VS-00, Repository and application foundation.)
- [x] Prepare Kiro implementation instructions without spending credits on planning. (`AGENTS.md`, `.kiro/steering/`, `.kiro/hooks/`, `docs/KIRO-WORKFLOW.md`.)

**Exit criteria:**
- [x] Local repository is clean and synchronized. (After the initial commit and push of `main`.)
- [x] Product and technical documents are aligned.
- [x] No unresolved blocker prevents the foundation from starting. (License and shared-contract owner are open owner decisions that do not block VS-00.)
- [x] Initial project structure is agreed upon. (`ARCHITECTURE.md` §5 is approved. Directories are created per slice, as `structure.md` requires.)
- [x] First implementation slice is ready. (VS-00; next step is the Spec workflow.)

**Owner decisions made during M1:**
- License: Apache License 2.0 (`LICENSE` and `"license": "Apache-2.0"` in the root `package.json`). The `LICENSE` hash was not compared with the upstream text because the fetch timed out (`docs/M1-VERIFICATION.md` section 8).
- Owner of shared domain contracts (`packages/domain` types, schemas and validation rules): `edgiaxel`.

**Issues:** Draft only; GitHub issues have not been created.

### M1 — Foundation

**Target:** November 14–16

**Outcome:** A running browser application with a shared project model and reliable build workflow.

Included (checked items have evidence in `docs/M1-VERIFICATION.md`):
- [x] Initialize the React + TypeScript + Vite application. (`npm run build` and `npm run dev` ran.)
- [x] Establish npm workspace structure where needed. (`apps/web`, `packages/domain`, `packages/storage`, `packages/project-format`.)
- [x] Configure linting, formatting, type checking, and tests. (Section 2 and 11.4 command tables, exit 0.)
- [x] Establish the shared domain model.
- [x] Define Stack, Card, Element, and Asset types. (Zod schemas and inferred types in `packages/domain`; tests pass.)
- [x] Implement basic project validation.
- [x] Establish the storage interface.
- [x] Implement basic IndexedDB persistence. (Storage tests over `fake-indexeddb`; agent run A3 saw the `ghoststack` database in Chromium.)
- [x] Establish the initial `.gsp` archive structure. (`packages/project-format`, `ARCHITECTURE.md` section 6.3.1; 184 tests.)
- [x] Create the GhostStack workspace shell. (Foundation shell only; see Current state.)
- [x] Implement the default Spectral Workstation theme. (Theme and contrast tests pass. No agent judged its appearance; the owner's manual steps did not record notes on it.)
- [x] Verify development and production builds. (`npm run build` exit 0. `npm run dev` started and served HTTP 200 on 2026-11-16, checked with `curl`, not in a browser.)
- [x] Cache the built app shell with a service worker so the production build reloads offline. (Scope addition approved by the owner on 2026-11-16, T-027. Evidence: `docs/M1-VERIFICATION.md` section 11.4, headless Chromium.)

**Exit criteria:**
- [x] Application runs in a modern desktop browser. (Owner confirmed step 1 on 2026-11-16, no browser or version supplied. Agent run: headless Chromium 155.)
- [x] A Stack can be created and persisted. (Automated tests; owner steps 2 and 3.)
- [x] A project can be loaded after a browser reload. (Automated tests; owner steps 3 and 4.)
- [x] Shared domain types are usable independently of React. (No React or DOM libraries in the three package manifests; `node` test environment; typecheck without the DOM lib.)
- [x] Lint, type check, tests, and build work.
- [x] The project format has a tested initial round-trip. (184 tests, also under three `TZ` values.)

**Limits of the M1 evidence:**
- The owner reported manual steps 1 to 12 as behaving as expected, without browser name, version or per-step notes.
- Automated browser checks used one headless Chromium. Firefox and Safari were not run. The first visit followed by an immediate offline reload was not run.
- `npm audit` reports 7 moderate findings in the `typescript-eslint` dev dependency chain. No decision is recorded.
- The `LICENSE` text was not compared with the upstream text.
- The work is uncommitted, so no commit or CI run backs it.

**Issues:** Draft only.

### M2 — AI Feasibility Spike

**Target:** November 16–19

**Outcome:** The AI integration's critical assumptions are tested before full implementation.

This milestone is a focused technical experiment, not the finished AI interface.

#### Spike A — Provider integration

- [ ] Connect to one OpenAI-compatible hosted endpoint.
- [ ] Connect to local Ollama.
- [ ] Request structured AIPlan output.
- [ ] Validate generated plans.
- [ ] Test invalid and incomplete provider responses.
- [ ] Test provider connection failure and rate-limit handling.
- [ ] Verify that core project editing works with all providers disconnected.

#### Spike B — MCP integration

- [ ] Build a minimal MCP server using the current stable TypeScript SDK.
- [ ] Register the planned tool contracts.
- [ ] Test read-only Stack inspection.
- [ ] Test action registry discovery.
- [ ] Test proposal submission.
- [ ] Test project validation.
- [ ] Test checkpoint creation.
- [ ] Investigate stdio transport.
- [ ] Investigate the local Streamable HTTP bridge.
- [ ] Prove how an external agent and browser editor access the same project state.

#### Spike C — Transaction safety

- [ ] Define a minimal AIPlan schema.
- [ ] Convert a valid proposal into patch commands.
- [ ] Create a persistent checkpoint.
- [ ] Apply changes to an isolated project copy.
- [ ] Validate the result.
- [ ] Commit valid operations atomically.
- [ ] Inject an intentional failure.
- [ ] Verify failed operations leave the active project unchanged.
- [ ] Revert a committed operation.

#### Spike D — Offline workflow

- [ ] Implement a deterministic demo adapter.
- [ ] Generate a predictable sample plan.
- [ ] Complete the plan-review-execute-report-rollback flow offline.

**Exit criteria:**
- [ ] One real hosted provider path works.
- [ ] Ollama path works.
- [ ] Offline demo path works.
- [ ] MCP tools can be discovered and invoked.
- [ ] A proposal reaches the approval queue.
- [ ] Transaction commit and rollback are demonstrated.
- [ ] The browser/local project-state connection is understood.
- [ ] Limitations and fallback architecture are documented.

**Decision gate:** If the local MCP bridge cannot be made reliable within this milestone, do not continue building an assumed integration. Select a demonstrable alternative and update ARCHITECTURE.md with approval.

**Issues:** Draft only.

### M3 — Core Creation Workflow

**Target:** November 19–27

**Outcome:** A usable GhostStack editor that works independently of AI.

#### Stack and Card workflow

- [ ] Create, open, rename, and delete Stacks.
- [ ] Create, rename, duplicate, reorder, and delete Cards.
- [ ] Implement Card navigation list.
- [ ] Handle deleted Card references safely.
- [ ] Implement project-level state schema.

#### Card editor

- [ ] Implement responsive authoring canvas.
- [ ] Add element selection and transformation.
- [ ] Add text elements.
- [ ] Add buttons.
- [ ] Add input fields.
- [ ] Add image elements.
- [ ] Add basic shapes and lines.
- [ ] Implement basic z-order.
- [ ] Implement inspector properties.
- [ ] Add layout anchoring and scaling controls.
- [ ] Implement the initial viewport switcher.

#### Behavior system

- [ ] Implement canonical behavior AST.
- [ ] Implement supported triggers.
- [ ] Implement registered actions.
- [ ] Implement safe expression evaluation.
- [ ] Implement basic conditions and branching.
- [ ] Implement Card navigation behavior.
- [ ] Implement the visual action-stack editor.
- [ ] Implement GhostScript parsing and validation.
- [ ] Verify both editors use the same AST.

#### Persistence and history

- [ ] Implement debounced local autosave.
- [ ] Implement recovery after interrupted sessions.
- [ ] Implement undo and redo.
- [ ] Implement basic recovery checkpoints.
- [ ] Implement asset registration and lookup.
- [ ] Implement missing-asset fallback.

#### Preview and export

- [ ] Implement application preview.
- [ ] Use the shared behavior runtime in preview.
- [ ] Implement `.gsp` export.
- [ ] Implement `.gsp` import.
- [ ] Validate project and asset references.
- [ ] Implement standalone web export.
- [ ] Verify exported application data is independent of the authoring project.

**Exit criteria:**
- [ ] A creator can build a small interactive application without AI.
- [ ] Project data survives reload.
- [ ] Undo and redo work for supported edits.
- [ ] `.gsp` can be exported and re-imported.
- [ ] Preview and exported behavior are consistent.
- [ ] Missing assets do not crash the application.
- [ ] The exported web application runs independently.

**Issues:** Draft only.

### M4 — AI Integration & Quality

**Target:** November 27–December 1

**Outcome:** The validated AI workflow is integrated into the working editor.

#### AI authoring

- [ ] Implement provider configuration.
- [ ] Integrate OpenAI-compatible adapter.
- [ ] Integrate Ollama adapter.
- [ ] Integrate deterministic demo adapter.
- [ ] Implement provider connection testing.
- [ ] Implement structured AIPlan generation.
- [ ] Implement plan validation.
- [ ] Implement Card-grouped plan review.
- [ ] Implement approval and rejection.
- [ ] Implement operation progress.
- [ ] Implement completion report.
- [ ] Implement whole-operation rollback.
- [ ] Display active provider and connection state.
- [ ] Verify that AI failure does not affect manual editing.

#### MCP integration

- [ ] Implement the approved MCP tools.
- [ ] Connect the validated transport.
- [ ] Verify project inspection.
- [ ] Verify proposal submission.
- [ ] Verify user approval.
- [ ] Verify transaction execution.
- [ ] Document external agent setup.
- [ ] Document transport limitations.

#### Quality and integration

- [ ] Test provider failures.
- [ ] Test rate-limit and quota errors.
- [ ] Test invalid AI output.
- [ ] Test transaction failure injection.
- [ ] Test rollback and recovery.
- [ ] Test offline mode.
- [ ] Test GSP archive round-trips.
- [ ] Test behavior AST round-trips.
- [ ] Test preview/export parity.
- [ ] Test the complete critical user journey.
- [ ] Fix high-priority regressions.

**Exit criteria:**
- [ ] At least one real provider can complete the AI workflow.
- [ ] Local Ollama integration works.
- [ ] Offline demo workflow works.
- [ ] MCP integration is demonstrable through the validated transport.
- [ ] AI operations cannot bypass approval.
- [ ] Failed AI operations preserve valid project state.
- [ ] Core editing remains fully usable without AI.
- [ ] No critical regression remains.

**Issues:** Draft only.

### M5 — Release & Demo

**Target:** December 1–4

**Outcome:** A stable, accessible hackathon submission.

#### Release preparation

- [ ] Freeze new feature development.
- [ ] Resolve critical bugs.
- [ ] Verify production build.
- [ ] Deploy the browser application.
- [ ] Verify the public application URL.
- [ ] Verify project creation and export on the deployed build.
- [ ] Verify no secrets are included in source or build artifacts.
- [ ] Prepare README.
- [ ] Prepare installation and usage instructions.
- [ ] Include open-source license.
- [ ] Verify `.kiro/` is included in the public repository.
- [ ] Document AI integrations and limitations.
- [ ] Document how Kiro was used.
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
| VS-01 | Create and persist a Stack | F-001, F-015 | M1–M3 | Create a Stack and reopen it |
| VS-02 | Card management and navigation | F-002, F-005 | M3 | Navigate between multiple Cards |
| VS-03 | Visual element editing | F-003, F-004 | M3 | Add and arrange content |
| VS-04 | Behavior AST and runtime | F-006, F-007, F-008, F-013 | M3 | Interactive Card behavior works |
| VS-05 | Preview and standalone export | F-014, F-020 | M3 | Run and export an application |
| VS-06 | GSP and asset portability | F-018, F-019 | M1–M3 | Export and import a complete project |
| VS-07 | Autosave, undo, and recovery | F-015, F-016, F-017 | M3 | Recover and revert project changes |
| VS-08 | AI provider feasibility | F-009 | M2 | Generate structured plans locally and remotely |
| VS-09 | AI plan and transaction workflow | F-009, F-010, F-013, F-016 | M2–M4 | Approve, execute, report, and revert |
| VS-10 | MCP agent workflow | F-011 | M2–M4 | External agent proposes a controlled change |
| VS-11 | Release and submission | All MVP features | M5 | Public working GhostStack demo |

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

UI prototype from Google Stitch, then VS-01 (create and persist a Stack) planning.

### Why this is next

VS-00 (repository and application foundation) meets its acceptance criteria: the application starts, builds, persists a Stack and reloads it (M1 exit criteria, section 3). The current UI is a foundation shell, so VS-01 should be planned against the prototype designs.

### Dependencies

- Google Stitch prototype output, which the owner is generating.
- `DESIGN.md` screens, which the prototypes must be reconciled with.

### Expected result

A reviewed prototype direction and an approved VS-01 spec (requirements, design, tasks).

### Verification

- The prototype is compared with `DESIGN.md` before any UI work starts.
- VS-01 acceptance criteria come from `PRD.md` features F-001 and F-015.

### Blockers

- Waiting on the Stitch prototypes (owner).
- The M1 work is uncommitted. The owner decides when to commit.
- T-013 (MCP bridge) stays open by design until the M2 spike.

---

## 6. Next Actions

1. Owner: review and commit the M1 work.
2. Owner: provide the Google Stitch UI prototypes.
3. Reconcile the prototypes with `DESIGN.md`.
4. Create the VS-01 spec (Spec workflow) and review requirements, design, and tasks before implementation.
5. Create GitHub Issues for VS-01 once the spec tasks are approved.
6. Run the M2 AI feasibility spike before implementing the full AI workflow.
7. Update milestones based on actual implementation results.

---

## 7. Risks and Blockers

| Item | Impact | Next action | Status |
|---|---|---|---|
| MCP browser/local bridge | High | Prove shared project-state access | Open |
| Hosted provider browser access | High | Test CORS and session credential handling | Open |
| AI operation safety | High | Prove transaction rollback | Open |
| Responsive canvas complexity | Medium | Prototype pinning and scaling | Open |
| `.gsp` archive implementation | Medium | Validate ZIP round-trip | Open |
| Behavior editor complexity | High | Establish AST contract before UI parallelization | Open |
| P0 scope size | High | Protect core creation workflow and enforce scope cuts | Open |
| Desktop packaging | Low for MVP | Defer to P1 | Deferred |
| Native user-app packaging | Low for MVP | Defer to P2 | Deferred |

---

## 8. Change History

- **2026-11-13:** Initial milestone plan created from the approved product direction and proposed architecture.
- **2026-11-15:** M0 re-audit. PRD, DESIGN, and ARCHITECTURE approved by the Product Owner; decision statuses and branch naming reconciled; `.gitignore` added. M0 remote verification and the initial commit are completed in the entry below.
- **2026-11-15:** M0 closed. SSH and `gh` verified; remote is public and empty with no issues or milestones. Initial commit pushed to `origin/main`. License and shared-contract owner remain owner decisions.
- **2026-11-16:** M1 scope addition approved by the owner: a hand-written service worker for offline reload of the built app shell (T-027). No M1 item is marked complete by this entry.
- **2026-11-16:** M1 closed (task 15.3). Every M1 item and exit criterion is checked against `docs/M1-VERIFICATION.md`; limits are listed in section 3. License recorded as Apache-2.0 and the shared-contract owner as `edgiaxel`. Next: Stitch prototype, then VS-01 planning.
- No milestone after M1 has been started.
