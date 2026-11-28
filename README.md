# GhostStack

**HyperCard reincarnated: a local-first, card-based micro-app creator.**

GhostStack is built for Kiroween 2026 (category: Resurrection). It brings back the idea behind HyperCard: ordinary people build small interactive apps from cards, elements and simple scripts. It runs in the browser, keeps projects on your machine, and exports apps that run on their own.

> **Project status:** the editor, preview, `.gsp` files, web export, templates and the optional AI workflow (offline demo, OpenAI-compatible and Ollama adapters, MCP bridge) are implemented. CI passes on GitHub. Release and the demo video (M4) are next.

## What you can do

- Build a Stack of Cards with text, buttons, inputs, images, shapes and lines. Move, resize, align, snap, copy and paste on a zoomable canvas.
- Add behavior with blocks or with GhostScript. Both edit the same safe AST. There is no `eval` and no generated JavaScript.
- Keep state in variables and lists (for example an inventory or a recipe list), and show it on a card.
- Preview at any size. New elements scale with the frame, so the editor and the preview agree.
- Save automatically in the browser (IndexedDB), with undo, redo, checkpoints and recovery.
- Start from a template (blank, branching quiz, recipe collection, inventory, interactive guide), or import a `.gsp` file.
- Export a `.gsp` project file, or a standalone web app (a zip that runs from `file://` or any static host).
- Optionally ask an AI assistant for a change. Every plan is checked on a copy of the project, shown in plain sentences, and applied only after you approve it. It is one undo step and can be reverted. External agents can connect over MCP and send proposals that wait in the same review.

AI is optional. Creating, editing, saving, preview, import and export work without a provider, an API key, an MCP client or an internet connection.

## Run it

Requires Node.js 22 or later and npm.

```sh
npm ci
npm run dev          # http://127.0.0.1:5173 (set GS_PORT to change the port)
npm run build        # production build in apps/web/dist
```

Checks: `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run bundle:check`, `npm run test:hooks`. For end-to-end tests run `npx playwright install chromium` once, start `npm run dev` yourself, then `GS_NO_WEBSERVER=1 npm run test:e2e`. Use `GS_BROWSERS=firefox,webkit` for the other browsers.

## AI providers

Open the assistant with View > AI assistant (key `A`) and choose a provider on the Provider tab.

| Provider | Where it runs | Notes |
|---|---|---|
| Demo | In the browser, offline | Rule-based and repeatable. Builds quiz and list examples. |
| Ollama | Your machine (`http://127.0.0.1:11434`) | Labeled local. Tested against a mock server; not yet run against a real model. |
| OpenAI-compatible | Any base URL you enter | Labeled remote, with a consent step before the first send. Verified with OpenRouter on 2026-11-27. |

The API key stays in memory for the session. It is never written to storage, `.gsp` files, exports or logs. GhostStack never switches from a local provider to a hosted one by itself.

To run the live hosted check yourself, put `OPENROUTER_KEY=...` in a git-ignored `.env`, start the dev server, then run `node --env-file=.env node_modules/@playwright/test/cli.js test m3-live-openrouter`.

## MCP

An external agent can read the open Stack and propose changes through the GhostStack MCP server. Build it with `npm run build -w @ghoststack/mcp-server`, register `node packages/mcp-server/dist/cli.mjs` as a stdio server, and paste the pairing code it prints into the AI panel. The server listens on `127.0.0.1` only and cannot change a project: proposals wait for your approval. Setup, tools and the security model are in `docs/MCP.md`.

## Project documents

| Document | Purpose |
|---|---|
| `docs/PRD.md` | Product scope, features and acceptance criteria |
| `docs/DESIGN.md` | Screens, interactions and visual direction |
| `docs/ARCHITECTURE.md` | Technical architecture and engineering constraints |
| `docs/MILESTONE.md` | Milestones and progress |
| `docs/UI_CONTRACT.md` | Shared UI, data and worktree rules |
| `docs/MCP.md` | MCP server setup and security |
| `docs/KIRO-USAGE.md` | How Kiro was used |
| `docs/CHANGELOG.md` | Completed changes |
| `HANDOFF.md` | Current state and next steps |
| `AGENTS.md` | Instructions for coding agents |

## Kiro

The `.kiro/` directory is part of the repository on purpose. It holds the steering, specs, hooks and agents used to build GhostStack. Do not add it to `.gitignore`.

## License

Apache-2.0. See `LICENSE`.
