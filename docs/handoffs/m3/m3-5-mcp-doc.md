# GhostStack MCP server

An external agent (any MCP client that speaks stdio) can read the Stack open in a GhostStack tab and submit change proposals. It cannot change the Stack. Every proposal waits in the approval queue until the creator approves it in the editor.

## Setup for an external agent

1. Build the server once from the repository root: `node packages/mcp-server/build.mjs`. This writes `packages/mcp-server/dist/cli.mjs`. It loads `ws` and the MCP SDK from `node_modules`, so keep it inside the repository checkout after `npm ci`.
2. Register it in the agent's MCP configuration as a stdio server:
   ```json
   { "mcpServers": { "ghoststack": { "command": "node", "args": ["<repo>/packages/mcp-server/dist/cli.mjs"] } } }
   ```
   Add `"--allow-origin", "https://your-editor.example"` to `args` only if the editor is not served from `localhost`, `127.0.0.1` or `[::1]`. `GS_MCP_ALLOWED_ORIGINS` (comma separated) does the same.
3. Start the agent. The server prints to stderr (stdout carries the protocol only):
   ```
   GhostStack MCP bridge listening on 127.0.0.1:<port> (loopback only).
   Pairing code: gs-mcp:<port>:<token>
   ```
   Copy the code from the agent's MCP log.
4. Open the Stack in GhostStack, open the AI assistant (View > AI assistant, or `A`), enter the code under "Connect an agent" and press Connect. The panel shows "Sharing <Stack title>" and the number of proposals waiting.
5. Keep the AI panel open while the agent works. Closing the panel disconnects.

Pairing codes change on every server launch.

## Tools

| Tool | Kind | What it does |
|---|---|---|
| `get_stack_summary` | read | Title, entry Card, Card order, state variables, viewport and a list of Cards (id, title, element count, Cards it links to). |
| `get_card_details` | read | `{ cardId }`. Elements and behaviors of one Card. Image data is replaced by `[data omitted]`. |
| `list_registered_actions` | read | Behavior action names, the plan command allowlist and the plan limits (50 steps, 64 kB). Works without a paired tab. |
| `validate_project` | read | Runs the project validator on the live Stack: `{ valid: true }` or `{ valid: false, problem }`. |
| `propose_stack_patch` | gated | `{ plan }`, an `AIPlan`. Checked with `parsePlan`, then `dryRunPlan` against the live Stack in the tab, then queued. The answer says `pending_user_approval` and that nothing was changed. A plan that does not apply is refused with the reason and not queued. At most 10 proposals wait at a time. |
| `create_checkpoint` | safe write | `{ label }` (1 to 80 characters). Saves a copy of the Stack as a manual checkpoint labelled `Agent: <label>`. The Stack is not changed. At most 5 per minute. |

Errors are `{ "error": { "code", "message" } }` with `isError: true`. Codes used: `MCP_CONNECTION_FAILED` (no tab paired, tab silent for 15 s, tab left), `INVALID_AI_PLAN`, `INVALID_PATCH_COMMAND`, `PROJECT_VALIDATION_FAILED`, `CHECKPOINT_FAILED`.

Plan commands allowed: `ADD_CARD`, `RENAME_CARD`, `DUPLICATE_CARD`, `REORDER_CARDS`, `DELETE_CARD`, `ADD_ELEMENT`, `UPDATE_ELEMENT`, `DELETE_ELEMENT`, `REORDER_ELEMENT`, `UPDATE_BEHAVIOR`, `UPDATE_STATE_SCHEMA`, `SET_CARD_BACKGROUND`. Assets, viewport and Stack rename are refused.

## Approval flow

1. The agent calls `propose_stack_patch`.
2. The server validates the plan shape and size, then asks the tab to run it on an isolated copy of the live Stack.
3. If it applies, the tab queues it (`enqueueProposal`, source `mcp`). The agent is told it is pending.
4. The creator sees it in the AI panel review screen, with the same plain-language summary as a prompt-based plan, and chooses Approve or dismiss.
5. Approve runs the transaction: a `Before AI: ...` checkpoint, then one undoable change. "Revert AI change" and Undo roll it back.

No code in the server or the bridge calls `dispatch`, `restore`, `undo` or `redo`.

## Security model

- The listener binds `127.0.0.1` only, on a random port.
- A 128-bit random token is created per launch and shown only on stderr. The tab must send it as its first frame within 5 seconds. Comparison is constant time.
- `Origin` must be present and be a loopback origin (or one passed with `--allow-origin`). `Host` must be loopback with the listener's port. This blocks other websites and DNS rebinding.
- One paired tab. A second tab is refused (close code 4409). Disconnect in the panel closes the socket at once.
- Frames are at most 256 kB, text only, strictly validated. Before authentication only a 1 kB hello is accepted. Tool answers above 60 000 characters are refused.
- The tab answers only five fixed requests. The server can ask for nothing else.
- Agent input is untrusted: plans pass `AIPlanSchema`, `parsePlan` and `dryRunPlan` before they are queued.
- What the agent can read: titles, element text and structure of the open Stack. Pair only an agent you trust with that content. API keys are never part of any answer.

## Transport limitations

- The tab is the only holder of live state. With no tab paired the read tools and proposals fail with `MCP_CONNECTION_FAILED`. `list_registered_actions` still works.
- The connection ends when the AI panel closes, the tab reloads or the server exits. Pair again with the code (same code until the server restarts).
- The browser dials `ws://127.0.0.1`. An editor served over `https` on a non-loopback host may be blocked by the browser's mixed-content rules. Use the local editor.
- The file-based inbox fallback (decision D5) was not needed and is not built.

## Spike result (T-013)

Passed. Criteria and evidence:

- A real MCP client (SDK `Client` over `StdioClientTransport`) launched the built server, paired with an open tab in Chromium and received the live Stack from `get_stack_summary`, including a Card added after pairing.
- `propose_stack_patch` queued a plan and the panel showed "Proposals waiting for approval: 1" while the Stack stayed unchanged.
- A wrong token was refused (close 4401), a foreign `Origin` was refused at the upgrade (HTTP 403), a wrong `Host` was refused (403).
- Evidence: `packages/mcp-server/src/cli.test.ts` (stdio conformance), `apps/web/src/features/ai/bridge/bridge.integration.test.ts` (whole chain) and `tests/e2e/m3-mcp.spec.ts` (browser).
- Not run: a third-party MCP client such as Kiro. Only the SDK client was used.
