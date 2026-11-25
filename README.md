# GhostStack

**HyperCard reincarnated: a local-first, card-based micro-app creator.**

GhostStack is being built for Kiroween 2026. It reimagines the creative philosophy of HyperCard with a modern card editor, constrained interactive behaviors, local-first project files, and optional AI-assisted project editing.

> **Project status:** M2 (core creation workflow) is implemented and verified locally. AI integration (M3) is not started.

## Product direction

GhostStack aims to let people create interactive applications from cards, visual elements, and reusable behaviors without needing to build a full application from scratch.

The intended MVP demonstrates one editor/runtime foundation through two distinct sample applications:

- An interactive learning or branching-quiz experience.
- A recipe collection or lightweight inventory application.

AI is optional. Core project creation, editing, saving, preview, import, and export must work without an AI provider, API key, MCP client, or internet connection.

## Project documents

| Document | Purpose |
|---|---|
| `docs/PRD.md` | Product scope, features, and acceptance criteria |
| `docs/DESIGN.md` | Screens, interactions, and visual direction |
| `docs/ARCHITECTURE.md` | Technical architecture and engineering constraints |
| `docs/MILESTONE.md` | Delivery milestones and vertical-slice progress |
| `docs/KIROWEEN-HACKATHON.md` | Hackathon rules and submission notes |
| `docs/design/prototypes/` | Stitch UI prototypes (reference only, not implemented) |
| `AGENTS.md` | Instructions for coding agents |
| `docs/CHANGELOG.md` | Meaningful completed changes |

## Kiro

The `.kiro/` directory is intentionally part of the repository. It contains project steering, hooks, and spec guidance used during development.

Do not add `.kiro/` or its subdirectories to `.gitignore`.

## Development status

Requires Node.js and npm. From the repository root: `npm ci` to install, `npm run dev` for the dev server on port 5173 (set `GS_PORT` to change it), `npm run build`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test` and `npm run test:e2e` (run `npx playwright install chromium` first). M2 is implemented: the editor works without AI or internet. AI and MCP (M3) are not started. See `HANDOFF.md`.

## License

A public open-source license must be selected and added before hackathon submission. Do not assume a license until the project owner chooses one.
