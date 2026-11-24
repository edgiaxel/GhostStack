---
inclusion: always
---

# GhostStack — Technical Direction

## Canonical Reference

`docs/ARCHITECTURE.md` is the source of truth for technical decisions, their status, architecture boundaries, security requirements, and verified development commands.

Do not silently replace an approved choice. Do not treat a recommendation or assumption as approved.

## Proposed Stack Direction

The previous architecture proposal considered:

- React + TypeScript + Vite for the initial web editor.
- npm workspaces for a future multi-package repository.
- A shared TypeScript domain core independent of React and browser APIs.
- Zod for runtime validation.
- CodeMirror 6 for GhostScript.
- IndexedDB through a small wrapper for browser persistence.
- A versioned ZIP-based `.gsp` project archive.
- A constrained JSON AST interpreter; never `eval()` or `new Function()`.
- An adapter boundary for hosted OpenAI-compatible APIs, Ollama, and an offline deterministic demo provider.
- A separate MCP service whose write capability is limited to gated proposals.
- Tauri 2 as a later desktop target, after the web MVP is stable.

These are not implementation facts. Check the decision table in `docs/ARCHITECTURE.md` and obtain owner approval for any decision still marked Proposed, Recommended, Assumption, or Open before scaffolding around it.

## Non-Negotiable Boundaries

- Domain logic must not depend on React, browser globals, provider SDKs, or UI components.
- Project-format parsing and validation must be independent of the editor UI.
- AI provider adapters must implement a provider-independent contract.
- AI output and imported project files are untrusted input.
- AI plans must be schema-validated and reviewed before execution.
- Apply multi-step AI changes to an isolated project copy; validate before atomic commit.
- Preserve a pre-operation snapshot and support whole-operation rollback.
- MCP clients may read project state and submit proposals; they must not bypass the approval/transaction boundary.
- Never execute arbitrary generated JavaScript.
- Do not silently send local project data to a hosted provider.
- Never include credentials in `.gsp`, exported applications, logs, or committed files.

## Dependency Discipline

Before adding a dependency:

1. Check whether the existing stack already provides the capability.
2. Confirm the dependency is compatible with the approved architecture.
3. Explain why it is needed and what it costs in bundle size, maintenance, or complexity.
4. Add it only within the assigned task's scope.

Do not invent package versions or commands. Verify versions and scripts against the repository and official package documentation at implementation time.
