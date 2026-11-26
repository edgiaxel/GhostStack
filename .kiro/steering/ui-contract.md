---
inclusion: fileMatch
fileMatchPattern: "apps/web/**"
---

# GhostStack: UI and Data Contract (loaded when editing the web app)

The binding rules for every UI change are in the contract below. They exist so parallel slices cannot create a second navbar, a second theme or ad hoc state.

#[[file:docs/UI_CONTRACT.md]]

Short form to keep in mind while editing:

- Change a Stack only with `session.dispatch`. Never call `stacks.save` from a feature, never mutate a Stack object.
- Use `gs-*` classes and tokens from `apps/web/src/themes`. No hardcoded editor colors, no second theme, no UI library.
- Every data view has loading, empty, error and success states with a next step in the text.
- Controls are real buttons, links or inputs with an accessible name, a visible focus ring and 32 px minimum height.
- No mock data, no seeded Stacks. Templates, once they exist, are created by a user action through `applyCommand`.
- If you are in a worktree (path contains `.worktrees`), central files are read-only. The `guard-writes` hook enforces this; put the request in your HANDOFF instead.
