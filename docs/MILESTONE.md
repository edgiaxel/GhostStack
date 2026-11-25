
# Milestones — GhostStack

> **Current milestone:** M0 — Audit & Preparation (not started; clean-slate restart)  
> **Overall status:** Restarted from a clean slate; no milestone is complete; implementation not started  
> **Deadline:** December 4, 2026 — 2:00 PM Pacific  
> **Last updated:** November 25, 2026  
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

### Current Milestone Target:
[PASTE MILESTONE DESCRIPTION / GOAL HERE]

Remember check again to make sure theres a shared contract before doing the execution, each subagents can execute with the same rule, dont invent different rule from one another, make sure each subagents know each other what they do and you as the main orchestrator need to know what each subagents did. You as the orchestrator act as the audit to see works for each subagents and check their work if its aligned with the current project. If not you are alllowed to edit/fix/change so every work synced wth the current project.

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

- Clean-slate restart (2026-11-25). The earlier work, its specs and its reports were removed by the owner and are not to be restored. No milestone is complete.
- PRD, DESIGN, and ARCHITECTURE are the approved plans (Product Owner, Nov 15, 2026). T-013 (MCP bridge transport) stays open until the AI integration milestone (M3). Plans do not prove implementation.
- Planning documents live in `docs/`. Stitch UI prototypes are stored in `docs/design/prototypes/` as reference only; none is implemented.
- Remote `origin` is `git@github.com:edgiaxel/GhostStack.git`. Its current contents, default branch and access have not been re-verified (M0 task).
- No application code, package configuration, tests, `.gitignore`, `LICENSE` or CI exist in the working tree.
- Kiro credits are reserved for implementation.

### Next action

Run the M0 audit, then establish the repository foundation (VS-00), then build the core creation workflow (M2) before AI integration (M3).

### Links

- Repository: `https://github.com/edgiaxel/GhostStack`
- `docs/PRD.md`
- `docs/DESIGN.md`
- `docs/ARCHITECTURE.md`
- `docs/MILESTONE.md`
- GitHub Project: Not created or verified.

---

## 2. Milestone Overview

| ID | Milestone | Outcome | Planned dates | Status | Exit criteria |
|---|---|---|---|---|---|
| M0 | Audit & Preparation | Verified starting point and implementation boundaries | Nov 13–14 | Pending (restarted) | Repository, docs, risks, and first slice reconciled |
| M1 | Foundation | Running browser application and shared project core | Nov 14–16 | Pending | Application builds and project model works |
| M2 | Core Creation Workflow | Complete usable Card-based application authoring workflow | Nov 19–27 | Pending | Create, edit, save, behavior, preview, and export work |
| M3 | AI Integration & Quality | Integrated AI workflow and verified MVP | Nov 27–Dec 1 | Pending | AI plan, approval, execution, rollback, and regression tests pass |
| M4 | Release & Demo | Public working application and hackathon submission | Dec 1–4 | Pending | Deployment, documentation, video, and submission complete |

Dates are targets, not promises. If a milestone slips, remove lower-priority scope before compressing validation and release testing.

---

## 3. Milestone Details

### M0 — Audit & Preparation

**Target:** November 13–14

**Outcome:** A trustworthy, verified starting point.

Tasks:
- [ ] Verify the GitHub repository, default branch, and repository contents.
- [ ] Verify local Git status, remotes, SSH access, and working directory.
- [ ] Confirm whether any existing files or branches need preservation. (Owner removed the earlier code and specs; do not restore them.)
- [ ] Review PRD, DESIGN, ARCHITECTURE, and MILESTONE consistency.
- [ ] Confirm `.kiro/` will be committed at the repository root.
- [ ] Establish the initial dependency and runtime choices.
- [ ] Identify the owner of shared domain contracts.
- [ ] Record technical risks and implementation boundaries.
- [ ] Select the first vertical slice.
- [ ] Prepare Kiro implementation instructions without spending credits on planning.

**Exit criteria:**
- [ ] Local repository is clean and synchronized.
- [ ] Product and technical documents are aligned.
- [ ] No unresolved blocker prevents the foundation from starting.
- [ ] Initial project structure is agreed upon.
- [ ] First implementation slice is ready.

**Open owner decisions (do not block VS-00):**
- Choose an open-source license (required before submission).
- Record the owner of shared domain contracts.

**Issues:** Draft only; GitHub issues have not been created.

### M1 — Foundation

**Target:** November 14–16

**Outcome:** A running browser application with a shared project model and reliable build workflow.

Included:
- [ ] Initialize the React + TypeScript + Vite application.
- [ ] Establish npm workspace structure where needed.
- [ ] Configure linting, formatting, type checking, and tests.
- [ ] Establish the shared domain model.
- [ ] Define Stack, Card, Element, and Asset types.
- [ ] Implement basic project validation.
- [ ] Establish the storage interface.
- [ ] Implement basic IndexedDB persistence.
- [ ] Establish the initial `.gsp` archive structure.
- [ ] Create the GhostStack workspace shell.
- [ ] Implement the default Spectral Workstation theme.
- [ ] Verify development and production builds.

**Exit criteria:**
- [ ] Application runs in a modern desktop browser.
- [ ] A Stack can be created and persisted.
- [ ] A project can be loaded after a browser reload.
- [ ] Shared domain types are usable independently of React.
- [ ] Lint, type check, tests, and build work.
- [ ] The project format has a tested initial round-trip.

**Issues:** Draft only.

### M2 — Core Creation Workflow

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

### M3 — AI Integration & Quality

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

### M4 — Release & Demo

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

M0 — Repository and documentation reconciliation after the clean-slate restart.

### Why this is next

The project was restarted from a clean slate. It has product and architecture plans but no application implementation. We need a clean foundation before introducing parallel implementation work.

### Dependencies

- PRD approval.
- DESIGN approval.
- ARCHITECTURE approval.
- Repository access.
- Kiro project setup.

### Expected result

A clean repository and an agreed implementation starting point.

### Verification

- Git status and remote verification.
- Successful local development setup.
- Initial project build.
- Documentation consistency check.

### Blockers

- None for starting VS-00. License and shared-contract owner are open owner decisions.
- T-013 (MCP bridge) stays open by design until M3. It does not block M1.

---

## 6. Next Actions

1. Run the M0 audit (repository, remote, Git state, document consistency).
2. Choose an open-source license and record the owner of shared domain contracts.
3. Create the VS-00 spec (Spec workflow) and review requirements, design, and tasks before implementation.
4. Begin M1 foundation implementation (VS-00).
5. Create GitHub Issues for VS-00 once the spec tasks are approved.
6. Validate the AI provider and MCP bridge paths at the start of M3 before building the full AI workflow.
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
- **2026-11-25:** Clean-slate restart. Progress records were reset: M0 reopened, earlier results removed from the plan documents, implementation files removed by the owner. The AI Feasibility Spike milestone was removed (done in the earlier version); M3 to M5 renumbered to M2 to M4. Approved plans (PRD, DESIGN, ARCHITECTURE) kept; documents moved under `docs/`.
- No implementation milestone (M1 onward) has been completed.
