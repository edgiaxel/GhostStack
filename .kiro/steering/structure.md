---
inclusion: always
---

# GhostStack — Repository Structure Rules

## Before the Repository Is Scaffolded

The directory structure in `docs/ARCHITECTURE.md` is an intended design, not proof that directories already exist. Inspect the actual repository before creating, moving, or replacing files.

Create directories when the first vertical slice needs them. Do not add empty placeholder packages for future milestones.

## Intended Boundaries

The architecture proposal separates these responsibilities:

- Web application and editor UI.
- Framework-independent project/domain model.
- Behavior AST, parser, validator, and runtime.
- `.gsp` project serialization and validation.
- Local persistence adapters.
- AI contracts, planning, providers, and transaction handling.
- MCP server and integration boundary.
- Tests and fixtures.
- Future desktop shell.

Follow the current `docs/ARCHITECTURE.md` structure and decision status. Do not create every proposed package up front.

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
