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

## First Spec Candidate

After M0 audit is complete and the architecture decisions are confirmed, create a Spec for the first approved foundation vertical slice in `docs/MILESTONE.md`.

Do not generate a speculative full-project spec before the repository audit. The repository and approved project documents determine the actual starting point.
