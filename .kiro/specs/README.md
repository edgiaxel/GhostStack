# Kiro Specs — GhostStack

Use Kiro's built-in **Spec** workflow for substantial vertical slices. Kiro creates a feature folder under `.kiro/specs/<feature-name>/` containing:

- `requirements.md`
- `design.md`
- `tasks.md`

Review the requirements, design, and tasks before execution. Keep each spec bounded to one vertical slice or independently verifiable feature.

## Spec Rules

- Link requirements to stable PRD feature IDs (`F-xxx`) and design screen IDs (`UI-xx`) where applicable.
- Respect the approved decision status in `docs/ARCHITECTURE.md`.
- Do not let a generated spec silently expand P0 scope.
- Include acceptance criteria and failure cases.
- Include tests and verification tasks, not only implementation tasks.
- Split work only when the resulting pieces can be implemented and verified independently.
- Do not create duplicate specs for work already represented by an active spec or GitHub issue.

## Existing spec: m1-foundation (restored)

`m1-foundation/` is real Kiro spec output (Requirements-First: `requirements.md`, `design.md`, `tasks.md`, plus `.config.kiro` and `tasks.meta.json`). It was written and executed in the first attempt (2026-11-16 to 2026-11-24), removed by the clean-slate reset in commit `38b4ba0` and restored byte-identical from `38b4ba0^` on 2026-11-26 to document how Kiro's spec workflow was used. All 69 tasks are checked and 24 property-test results are recorded as passed.

It describes the first implementation, not the code rebuilt after the reset. Do not edit it and do not run its tasks again; start new specs for new work.

## Specs for the revised milestones

Create one spec per chunk in the IDE (Spec, Feature, Requirements-First) and review each phase before running tasks. The feature description for each spec is the matching section of `docs/MILESTONE.md`; the finding IDs (U1 to U18) are in `docs/AUDIT-M2.md`. Run chunks in the order in the table. Keep the folder name below so history stays readable.

| Order | Spec folder | Milestone section | PRD and design IDs | Ask for correctness properties on |
|---|---|---|---|---|
| 1 | `m2-1-design-foundations` | M2.1 | DESIGN section 9, F-022 (accent) | Every accent preset keeps AA contrast; brand generator is deterministic |
| 2 | `m2-6-responsive-defaults` | M2.6 | F-003, F-014, F-026, UI-06 | Scale mode keeps proportions; anchors keep edge distances; editor and preview agree |
| 3 | `m2-7-behavior-lists` | M2.7 | F-006, F-007, UI-04 | List operations never throw on valid Stacks; `parse(print(x))` equals `x` |
| 4 | `m2-2-editor-shell` | M2.2 | F-003, F-022, UI-03 | Zoom and pan keep the point under the cursor fixed |
| 5 | `m2-3-inspector` | M2.3 | F-003, F-004, UI-04 | Any value the inspector accepts passes `validateStack` |
| 6 | `m2-4-library-templates` | M2.4 | F-001, F-002, UI-01, UI-02 | Every template creates a Stack that exports and re-imports unchanged |
| 7 | `m2-5-canvas-craft` | M2.5 | F-003, F-019, F-025, UI-03 | Move, align, paste and delete keep elements valid; undo restores the exact Stack |
| rolling | `m2-8-quality` | M2.8 | All | none (infrastructure) |

Each spec must also include, as tasks: unit tests, the end-to-end flow that proves the outcome, an update of `docs/UI_CONTRACT.md` when a shared rule changes, and a handoff entry. Do not let a generated spec widen P0 scope.

## Working with the spec task hook

`.kiro/hooks/task-completion-review.json` runs after each spec task. It asks the agent to check acceptance criteria and report exact commands and results. Run spec tasks through Kiro's task execution so this hook, the `guard-writes` hook and the steering files apply.

## Earlier spec in git history

The first attempt used a spec, `m1-foundation`, with the usual three files plus `.config.kiro` and `tasks.meta.json`. It was removed in the clean-slate reset (`38b4ba0`). It can be read from history with `git show 38b4ba0^:.kiro/specs/m1-foundation/requirements.md`. It is not part of the current plan.