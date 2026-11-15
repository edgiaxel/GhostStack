# GhostStack

**HyperCard reincarnated: a local-first, card-based micro-app creator.**

GhostStack is being built for Kiroween 2026. It reimagines the creative philosophy of HyperCard with a modern card editor, constrained interactive behaviors, local-first project files, and optional AI-assisted project editing.

> **Project status:** Repository setup and M0 audit pending. This README is a starter document, not evidence that the application currently runs.

## Product direction

GhostStack aims to let people create interactive applications from cards, visual elements, and reusable behaviors without needing to build a full application from scratch.

The intended MVP demonstrates one editor/runtime foundation through two distinct sample applications:

- An interactive learning or branching-quiz experience.
- A recipe collection or lightweight inventory application.

AI is optional. Core project creation, editing, saving, preview, import, and export must work without an AI provider, API key, MCP client, or internet connection.

## Project documents

| Document | Purpose |
|---|---|
| `PRD.md` | Product scope, features, and acceptance criteria |
| `DESIGN.md` | Screens, interactions, and visual direction |
| `ARCHITECTURE.md` | Technical architecture and engineering constraints |
| `MILESTONE.md` | Delivery milestones and vertical-slice progress |
| `AGENTS.md` | Instructions for coding agents |
| `CHANGELOG.md` | Meaningful completed changes |

## Kiro

The `.kiro/` directory is intentionally part of the repository. It contains project steering, hooks, and spec guidance used during development.

Do not add `.kiro/` or its subdirectories to `.gitignore`.

## Development status

No install, run, test, or build command is documented here yet because the repository's actual package configuration has not been verified. See `ARCHITECTURE.md` and `MILESTONE.md` for the planned direction and current delivery status.

## License

A public open-source license must be selected and added before hackathon submission. Do not assume a license until the project owner chooses one.
