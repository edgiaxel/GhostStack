# Kiro Workflow — GhostStack

## Recommended Session Modes

| Work type | Kiro mode | Expected use |
|---|---|---|
| Repository audit / M0 | Plan | Inspect local state, compare docs/config, report unknowns, recommend next task |
| Architecture clarification | Plan, then Spec if a feature spec is needed | Analyze trade-offs; do not silently change approved decisions |
| Substantial vertical slice | Spec | Requirements → design → tasks, with review before execution |
| Small bounded implementation | Default | Implement one approved issue/task and verify it |
| Defect investigation | Bug Fix | Reproduce → root cause → fix plan → regression test → verify |
| Tiny, familiar change | Default or Quick Spec | Avoid ceremony when risk is low |

The built-in workflows are session tools, not repository-defined custom agents. No custom agent profiles are required for this workflow.

## Model and Credit Strategy

The developer intends to use Auto model selection with the 1x credit option. Keep this as a user-level Kiro setting; do not hard-code a model in project custom-agent files.

Practical usage:

- Use Plan for audits and reasoning before asking for code changes.
- Use Spec for high-impact features so requirements and tasks are reviewed before implementation.
- Use Default for bounded coding tasks.
- Use Bug Fix for isolated defects.
- Avoid repeatedly asking the agent to regenerate whole project documents.
- Ask for targeted edits and diffs.
- Run checks once per meaningful change, not after every trivial message.
- Do not delegate parallel work that edits the same files.

Auto model selection and the credit multiplier are account/IDE settings. This repository does not enforce or verify the selected model or credit rate.

## First Kiro Session — M0 Audit

Start with **Plan** mode and provide this request:

> Perform the GhostStack M0 repository audit only. Do not edit files, scaffold the app, install dependencies, create GitHub issues, commit, push, or deploy. Inspect the actual workspace root, Git status, branch, remotes, recent commits, root tree, existing PRD/DESIGN/ARCHITECTURE/MILESTONE documents, existing `.kiro/` configuration, package scripts, tests, lint/typecheck/build setup, CI, and any safely inspectable deployment configuration. Preserve all existing user work. Compare the findings with `docs/PROJECT-AUDIT.md`, `ARCHITECTURE.md`, and `MILESTONE.md`. Clearly separate verified facts, planned work, and unknowns. Identify conflicts and propose one next task. Return the audit report for review.

After reviewing the audit, decide whether the supplied Phase 4 files should be merged with or adapted to the existing repository configuration.

## First Implementation Session

Only after M0 is complete and the relevant architecture decisions are approved:

1. Use Spec mode for the first approved vertical slice.
2. Review requirements.
3. Review technical design and dependencies.
4. Review tasks and verification.
5. Execute one task or a small dependency-safe group.
6. Review the diff and evidence before moving on.
