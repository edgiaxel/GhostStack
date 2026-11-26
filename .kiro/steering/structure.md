---
inclusion: always
---

# GhostStack — Repository Structure Rules

## Current Layout

The repository is scaffolded. The directory structure in `docs/ARCHITECTURE.md` section 5 is still partly an intended design, so inspect the actual repository before creating, moving, or replacing files.

Existing: `apps/web` (features: project-library, workspace, card-editor, behavior-editor, history, preview, export), and packages `shared-contracts`, `domain`, `storage`, `project-format`, `behavior`, `player`. End-to-end tests are in `tests/e2e`; unit tests sit next to the code.

Create directories when the first vertical slice needs them. Do not add empty placeholder packages for future milestones (`ai-core`, `ai-providers`, `mcp-server`, `desktop` do not exist yet).

## Boundaries

- Web application and editor UI (`apps/web`).
- Framework-independent project/domain model (`shared-contracts`, `domain`).
- Behavior AST, parser, validator, and runtime (`shared-contracts`, `behavior`).
- `.gsp` project serialization, validation and web export (`project-format`, `player`).
- Local persistence adapters (`storage`).
- Later milestones: AI contracts, planning, providers and transaction handling; the MCP server; the desktop shell.

Follow the current `docs/ARCHITECTURE.md` structure and decision status.

## Naming and Organization

- Use descriptive, domain-oriented names.
- Keep UI components separate from domain rules.
- Keep provider-specific code inside provider adapters.
- Keep shared contracts independent from provider SDKs.
- Co-locate focused tests with the implementation unless the repository establishes another convention.
- Avoid generic dumping-ground folders and unnecessary abstraction layers.

## Documentation

- Update PRD when approved product behavior or scope changes.
- Update DESIGN when user-visible layout or interaction behavior changes.
- Update ARCHITECTURE when technical boundaries, dependencies, security, or development commands materially change.
- Update MILESTONE when a milestone, vertical slice, blocker, or next action changes.
- Update CHANGELOG only for meaningful completed changes.

Do not duplicate the full contents of canonical documents in code comments or agent instructions.
