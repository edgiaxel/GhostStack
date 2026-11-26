---
inclusion: always
---

# GhostStack — Development Workflow

## One Task at a Time

Work on one bounded issue or vertical slice at a time. Do not attempt an entire milestone in one implementation pass.

## Mode Selection

- **Plan:** inspect, audit, explain dependencies, identify risks, and propose a sequence. Planning requests are read-only unless the user explicitly authorizes edits.
- **Spec:** use for substantial feature slices. Generate requirements, design, and tasks; review each phase with the user before implementation.
- **Default:** use for bounded implementation, integration, review, and explanations after scope is clear.
- **Bug Fix:** use for defects with reproducible symptoms. Identify root cause and add a regression test.
- **Quick Spec:** reserve for small, well-understood changes. Do not use it to bypass review of architecture, persistence, AI transaction, MCP, or security work.

## Before Editing

- Identify the current milestone and next Ready issue.
- Read only the relevant PRD, DESIGN, and ARCHITECTURE sections.
- Inspect Git status and preserve uncommitted user changes.
- Confirm dependencies and acceptance criteria.
- State the affected files/areas and verification plan for non-trivial changes.
- Stop and ask if the task conflicts with approved documents.

## Parallel Slices

When a milestone chunk is split across worktrees, run `/orchestrator-workflow` (manual steering) or pick the `orchestrator` agent. Each slice agent uses `slice-builder`; an independent check uses `reviewer`. Contract and ownership rules are in `docs/UI_CONTRACT.md`. Each chunk goes through the Spec workflow first (see `.kiro/specs/README.md`).

## Implementation

- Prefer the smallest complete vertical change.
- Do not refactor unrelated code.
- Add/update tests for behavior changes.
- Do not mark tasks complete until acceptance criteria and checks are verified.
- Do not run destructive commands or deploy without explicit approval.

## Verification Report

For each task, report:

- Files changed.
- Acceptance criteria met/not met.
- Exact commands run.
- Passed, failed, skipped, and not-run checks.
- Diff review findings.
- Known limitations and next action.

Never claim a command succeeded if it was not run.
