# GhostStack

**HyperCard reincarnated: a local-first, card-based micro-app creator.**

GhostStack is being built for Kiroween 2026. It reimagines the creative philosophy of HyperCard with a modern card editor, constrained interactive behaviors, local-first project files, and optional AI-assisted project editing.

> **Project status:** M1 foundation is built and verified (see `docs/M1-VERIFICATION.md`), and the M2 AI feasibility spike is closed (see `docs/M2-HANDOFF.md`). The editor is a functional shell: a Project Library where you create, list and open Stacks, and a Stack workspace that shows the title and a Card list. The toolbox, canvas and inspector are placeholders. Behaviors, `.gsp` import and export, preview, standalone export and AI are not implemented. The visual prototypes in `docs/DESIGN.md` are not implemented yet.

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
| `docs/M2-HANDOFF.md` | M2 results, decisions and constraints for M3 and M4 |
| `docs/KIROWEEN-HACKATHON.md` | Hackathon rules and submission notes |
| `AGENTS.md` | Instructions for coding agents |
| `docs/CHANGELOG.md` | Meaningful completed changes |

## Kiro

The `.kiro/` directory is intentionally part of the repository. It contains project steering, hooks, and spec guidance used during development.

Do not add `.kiro/` or its subdirectories to `.gitignore`.

## Development

Requires Node.js `^22.22.2 || ^24.15.0` (`engines` in `package.json`). The commands ran on Node.js v24.22.1 and npm 11.19.1 on Linux.

| Task | Command |
|---|---|
| Install | `npm ci` |
| Run the development server | `npm run dev` |
| Test | `npm run test` |
| Lint | `npm run lint` |
| Check formatting | `npm run format:check` |
| Type check | `npm run typecheck` |
| Build | `npm run build` |
| Preview the build | `npm run preview` (Vite serves `http://localhost:4173/` by default) |

End-to-end tests are not available. Playwright is not installed and there is no CI.

The command table in `docs/ARCHITECTURE.md` records what was verified for each command and how.

## Storage and offline behavior

Stacks are stored in the browser's IndexedDB database `ghoststack`. Nothing is sent to a server, and the app loads its fonts from its own files.

The production build (`npm run build`, then `npm run preview` or any static host) registers a service worker that caches the app shell. After the page has loaded once and the worker has activated, a reload with no network shows the Project Library and the stored Stacks. The first visit is not controlled by the worker, so reload once online before testing offline. The development server does not register a service worker. Details: `docs/ARCHITECTURE.md` section 8.7.

The offline reload was checked in headless Chromium by a coding agent. The owner reported that the manual steps in `docs/M1-VERIFICATION.md` section 11.1 behaved as expected, without naming a browser.

## License

GhostStack is licensed under the Apache License 2.0. See [`LICENSE`](LICENSE).
