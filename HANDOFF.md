# HANDOFF: M3.5 MCP server and bridge (`feature/m3-mcp`)

This file replaces the root `HANDOFF.md` of `main` inside this branch. Keep the `main` version when merging and move this text to `docs/handoffs/m3/m3-5-result.md`.

## 1. Files touched

- `packages/mcp-server/`: `build.mjs`; `src/index.ts`, `protocol.ts`, `hub.ts`, `tools.ts`, `cli.ts`; tests `hub.test.ts`, `tools.test.ts`, `cli.test.ts`; test helper `test-support.ts`.
- `apps/web/src/features/ai/bridge/`: `index.ts`, `protocol.ts`, `handlers.ts`, `client.ts`, `BridgePairing.tsx`, `bridge.css`; tests `handlers.test.ts`, `client.test.ts`, `BridgePairing.test.tsx`, `bridge.integration.test.ts`; helper `testing.ts` (tests only).
- `tests/e2e/m3-mcp.spec.ts`.
- `docs/handoffs/m3/m3-5-mcp-doc.md`: content for `docs/MCP.md` (orchestrator places it).
- Not touched: `features/ai/proposals.ts` (only `enqueueProposal` is called), `features/ai/index.tsx`, any central file.

## 2. Exported entry points

- `@ghoststack/mcp-server`: `createMcpServer({ bridge, version?, nowMs? })`, `createBridgeHub(options)`, `createRateLimiter`, `hostAllowed`, `originAllowed`, `tokensMatch`, `parsePairingCode`, `formatPairingCode`, `CLOSE`, `BRIDGE_METHODS`, `MAX_FRAME_BYTES`, types `Bridge`, `BridgeHub`, `BridgeHubOptions`, `McpServerOptions`.
- Launchable entry: `node packages/mcp-server/build.mjs` writes `packages/mcp-server/dist/cli.mjs` (stdio server; flags `--allow-origin <origin>`, env `GS_MCP_ALLOWED_ORIGINS`).
- `features/ai/bridge/index.ts`: `connectBridge({ pairingCode, handlers, onStatus?, createSocket? })` returning `Result<BridgeConnection>`, `createBridgeHandlers`, `BridgePairing`, `parsePairingCode`, types `BridgeStatus`, `BridgeConnection`, `BridgeHandlers`.
- **Mount point for the orchestrator:** render `<BridgePairing session={session} />` (from `./bridge`) inside `AIPanel` in `features/ai/index.tsx`. The e2e spec needs it there: it opens View > AI assistant and uses the labelled field "Pairing code", the Connect and Disconnect buttons and `data-testid` `bridge-status` and `bridge-shared`. The pairing component shows the number of waiting proposals itself; M3.3 renders the queue review.

## 3. Env, schema, dependency and contract changes requested

1. `packages/mcp-server/package.json`: add `"zod": "^4.6.7"` to `dependencies` (imported directly; resolves by hoisting today). Add `"@ghoststack/ai-core"` is already there. Optional: `"scripts": { "build": "node build.mjs" }` and `"bin": { "ghoststack-mcp": "./dist/cli.mjs" }`. The build script imports `vite` (root devDependency, hoisted); add `vite` to `devDependencies` of the package if you want it explicit.
2. `apps/web/package.json`: add `"@ghoststack/ai-core": "^0.0.0"` (bridge imports `buildContext`, `dryRunPlan`, `parsePlan`, `summarizePlan`). Tests also import `@ghoststack/mcp-server`, `ws` and the MCP SDK from `apps/web`; they resolve by hoisting. Add them as `devDependencies` of `apps/web` if you want it strict.
3. `eslint.config.js`: `packages/mcp-server/**` is not in the domain-boundary list; no change needed. Optional: add `packages/mcp-server/dist` to ignores (`dist/**` already covers it).
4. Optional: `packages/mcp-server/package.json` `exports` entry `"./protocol"` so the web client could share the wire schema instead of the small copy in `bridge/protocol.ts`.
5. Root `build` does not build `dist/cli.mjs`. Add it to `build` or document the step; `cli.test.ts` and the e2e spec build it themselves.

## 4. Caveats and known gaps

- Decisions (recommended option, no open decision): token is per launch and reusable until the server exits (not one-time); the connection lives while `BridgePairing` is mounted, so closing the AI dock disconnects; read answers come from `ai-core.buildContext` (bounded, image data omitted); proposal cap 10 waiting; checkpoint cap 5 per minute; checkpoint label prefix `Agent:`.
- Wire protocol is duplicated in `mcp-server/src/protocol.ts` (zod) and `bridge/protocol.ts` (hand-checked). `bridge.integration.test.ts` runs the real server against the real client to catch drift.
- `BridgePairing` is not mounted anywhere on this branch. I mounted it in `features/ai/index.tsx` temporarily to run the e2e and the `playwright-cli` pass, then reverted that file. So `tests/e2e/m3-mcp.spec.ts` fails on this branch alone and passes once the orchestrator mounts the component.
- Not verified: a third-party MCP client (Kiro or other); only the SDK client over stdio. The `playwright-cli` Disconnect click: the panel changed state, but I did not confirm the server's "disconnected" log line in that run (the e2e does verify that the agent loses access).
- File inbox fallback (D5) not built: the spike passed.
- Tool answers use the Stack's own text (card titles, labels). A connected agent reads it; documented in the MCP doc.
- `test-support.ts` and `testing.ts` sit in `src` but are imported only by tests.

## 5. What the next step needs

- Mount `BridgePairing` in `AIPanel`, apply the requests in section 3, place the doc as `docs/MCP.md`, update ARCHITECTURE T-013 (result: passed, loopback WebSocket, tab is client).
- M3.3 renders `listProposals()` with the review UI; Approve goes through `runTransaction`.
- M3.6: record a run with a third-party MCP client.

## 6. Commands run and results

See the commit message and the final report; each line is a command I ran in the worktree.
