# M2 AI Feasibility Report

Status: **M2 closed with two checks left for the owner** (Kiro as MCP client, OpenRouter from a browser).
Written: 2026-11-23. Branch: `feature/vs-08-ai-provider-feasibility`.

Every result below says how it was obtained. "Passed" means a command ran and its output was read. Nothing here is claimed from memory.

## 1. Verdict

The three risky parts of the AI design work, at the evidence level stated per row in section 3:

1. **Structured plans from a real hosted model:** OpenRouter with `nvidia/nemotron-3.5-super-vl:free` returned a valid plan on 3 of 3 prompts.
2. **Transactional apply and rollback:** a failed operation leaves the project unchanged, and a committed one reverts, including in real Chromium IndexedDB after a page reload.
3. **External agent through MCP:** an agent can read the project and queue proposals but cannot change the project or approve anything. A cross-process run (bridge process, real Chromium, separate agent process) showed this.

**Recommendation for M4: go.** Build the AI workflow on `packages/ai-core` as it stands, and keep the bridge as the MCP path.

**Not proven:** Ollama, Kiro as the MCP client, OpenRouter called from a browser, and the deployed (HTTPS) case. See section 5.

## 2. What M2 produced

| Area | Location | Status |
|---|---|---|
| `AIPlan` schema and the 7 patch commands | `packages/ai-core/src/plan.ts` | Reusable. `UPDATE_BEHAVIOR` is accepted by the schema and rejected at apply time until the M3 behavior model exists. |
| Apply a plan to an isolated copy | `packages/ai-core/src/patch.ts` | Reusable. Never mutates its input. |
| Transaction manager: checkpoint, apply, validate, atomic commit, rollback, crash recovery | `packages/ai-core/src/transaction.ts` | Reusable. |
| Checkpoint stores: memory and repository-backed with read-time validation | `packages/ai-core/src/checkpoints.ts` | Reusable. |
| Provider contract, privacy gate, plan review, offline demo adapter | `packages/ai-core/src/provider.ts`, `review.ts`, `demo.ts` | Reusable. |
| Durable checkpoints: IndexedDB v1 to v2 upgrade, `checkpoints` store | `packages/storage/src/indexeddb/` | Reusable. T-031. |
| OpenAI-compatible and Ollama adapters | `spikes/providers` | Throwaway until promoted in M4. |
| MCP server (six tools), loopback HTTP server, stdio entry, editor endpoints | `spikes/mcp-bridge` | Throwaway until promoted in M4. |
| Browser probe page | `spikes/browser-probe` | Throwaway. |

`apps/web` was not changed. Zero files under `apps/` differ from `main`, and the web app imports nothing from `ai-core`, `spikes` or the MCP SDK.

Tests at the end of M2: 729 passed, 1 skipped (the opt-in live OpenRouter test), 0 failed. Of those, `ai-core` has 76, `spikes/providers` 35 (plus the 1 skipped) and `spikes/mcp-bridge` 73.

## 3. ARCHITECTURE section 14.1 criteria

| # | Criterion | Status | Evidence and level |
|---|---|---|---|
| 1 | A hosted provider generates a valid `AIPlan` | **Passed (Node)** | Live run, `npm run spike:openrouter`: 3 of 3 prompts gave valid plans in 5.3, 8.0 and 8.5 s, and all 3 executed. From a browser: not run (section 5). |
| 2 | Local Ollama generates a valid `AIPlan` | **Not run** | Ollama was not running, and the owner chose to skip it. The adapter is tested against a mock server only. |
| 3 | The offline demo adapter produces a deterministic plan | **Passed** | Unit tests, and `npm run spike:demo` runs plan, review, execute, report and rollback with no network. Also runs in real Chromium. |
| 4 | An MCP client can inspect project information | **Passed (SDK client)** | SDK client over in-memory, HTTP and stdio transports. A real spawned `dist/stdio.js` listed the six tools and returned the project. Kiro as client: not run. |
| 5 | An MCP client can submit a proposal without mutating the project | **Passed** | Tests, plus the cross-process run: the agent saw 3 cards before and after proposing. No tool approves, applies or deletes (tested by name). |
| 6 | The creator can approve a proposal | **Passed (real Chromium)** | The probe page approved through the browser's own transaction manager. |
| 7 | The transaction manager applies a valid proposal | **Passed** | Unit and property tests, and real Chromium. |
| 8 | A deliberately failed operation leaves the project unchanged | **Passed** | Faults injected at each stage (load, checkpoint, apply, validate, commit), between commands, on a storage write, and as a simulated crash before and after the commit. |
| 9 | A committed operation can be reverted | **Passed** | Memory storage, `fake-indexeddb`, and real Chromium IndexedDB across a real page reload. |
| 10 | None of this makes AI a dependency of the normal editor | **Passed** | `apps/` has no changes and no imports of the AI or MCP code. |

## 4. Findings

**Provider schemas.**
- Nvidia's grammar compiler, behind OpenRouter, rejects the JSON Schema keyword `propertyNames` (HTTP 400, "Unimplemented keys"). Zod emits it for record fields. The schema sent to a provider now drops it. This only loosens the hint, because every reply is still fully validated by `parseAIPlan`, and a test checks that.
- Nemotron is a reasoning model, so it spends tokens thinking first. A 50-token cap truncated the output at `{"planVersion":`. The live run uses a 4000-token cap.
- The free Nemotron models list structured-output support unevenly. Only `nvidia/nemotron-3.5-super-vl:free` advertised `structured_outputs` when queried.

**Budget.** 8 completions were sent against the 15-request budget: 3 rejected in the first live attempt, 1 rejected diagnostic, 1 accepted diagnostic, and 3 in the passing run. The OpenRouter quota counter showed `used: 1` after three accepted requests. That gap is unexplained and I did not investigate it.

**Plan safety.**
- Zod silently drops a `__proto__` key in a record, so such an `UPDATE_STATE_SCHEMA` becomes a harmless no-op, not an error. An explicit guard rejects reserved names that reach the applier.
- Stored checkpoints are untrusted: every read re-validates the project, and a damaged record is skipped when listing.
- Rollback refuses with `ROLLBACK_CONFLICT` if the project changed after the operation, so later edits are never discarded silently.

**Bridge design.**
- A stdio MCP process spawned by a client has its own memory and cannot see the browser's IndexedDB. A long-running loopback process that the browser connects to solves that.
- **Two tokens are required.** With one shared secret, an agent could approve its own proposals. The agent token works only on `/mcp`. The editor token works only on `/editor/*`, which also needs an allowed browser `Origin`. Tests prove each token fails on the other's routes.
- **Guard tests were mutation-checked.** I removed each guard (host, origin, agent token, editor token, origin-required, identical tokens) and confirmed tests then failed. The first attempt at one mutation did not apply, because Prettier had reflowed the line, so I redid it and checked that it applied.
- The validator's error `details` carry identifier values with no length cap. The bridge caps them at 100 characters before they reach an agent.

**Browser.**
- IndexedDB durability works in real Chromium: after a simulated crash and a real reload, recovery settled the operation as `committed` and rollback restored the exact original project and asset bytes.
- A browser cannot tell "not running" from "CORS blocked" for a failed fetch, so a failed Ollama probe says nothing about CORS.
- Chrome 142 and later puts a user permission prompt in front of a public HTTPS page calling `127.0.0.1` or `localhost` ("Local Network Access"). Source: [Chrome developer documentation](https://developer.chrome.com/docs/modern-web-guidance/guides/security/local-network-access). This is documented, not tested here.

## 5. Not proven

| Item | Why | What closes it |
|---|---|---|
| OpenRouter from a browser (CORS, a readable 401 for a bad key, one plan end to end) | Kiro blocked my attempt to load the key into the page. I did not try another route. | Owner pastes the key into the probe page's key field and clicks "Run provider checks" (about 1 completion). |
| Kiro as the MCP client | I cannot act as an MCP client in this session. | Owner runs the Kiro steps in section 7. |
| Ollama (criterion 2) | Not running, skipped by the owner. | Start Ollama with `gemma3:4b` and add a live run. |
| Deployed HTTPS editor calling a loopback bridge | No deployment exists. Chrome's permission prompt applies. | Test after the first deploy in M5, in Chrome, Firefox and Safari. |
| Safari and Firefox | Only one headless Chromium was used. | A manual pass. |
| `create_checkpoint` over MCP is not durable | The bridge holds a stack-only copy in memory (`durable: false`). | Decide in M4 whether agent checkpoints should be created by the editor. |
| `.gsp` fallback, editor side | The return path is a proposals file that a test feeds through the editor's approval path. There is no import button. | Build the import in M4 only if the bridge is dropped. |

## 6. Decision proposed for T-013 (needs owner approval)

**Browser-owned state with an authenticated loopback bridge.**

- IndexedDB in the browser stays the source of truth.
- The editor publishes the stack to a local bridge process, and an agent reads it through MCP and queues proposals.
- The creator approves in the browser, and the browser applies the plan through its own transaction manager.
- Two separate tokens: agent token for `/mcp`, editor token for `/editor/*`. The bridge binds to loopback and checks the Host header and exact origins, with no wildcard CORS.
- Fallback: `stdio` with `--gsp` and `--proposals-out`, for the case where the bridge cannot run.

Residual risks the owner should accept or reject:
- Any local process that obtains the editor token can approve. The tokens are secrets held in memory.
- The deployed HTTPS case needs the creator to grant a browser permission.
- The bridge is a separate process the creator must start, so it is a poor fit for a first-run experience. Keep it optional.

## 7. How to rerun or finish the open checks

```
# Offline flow, no network
npm run spike:demo

# Live OpenRouter run (costs about 3 free requests). The key goes in .env, which Git ignores.
set -a; . ./.env; set +a; npm run spike:openrouter

# Bridge for the Kiro test. Use throwaway tokens.
export GHOSTSTACK_BRIDGE_TOKEN=$(openssl rand -hex 32)
export GHOSTSTACK_EDITOR_TOKEN=$(openssl rand -hex 32)
export GHOSTSTACK_ALLOWED_ORIGINS=http://127.0.0.1:5199
npm run spike:bridge:build && npm run spike:bridge
# In another shell: cd spikes/browser-probe && npm run dev, then open http://127.0.0.1:5199
```

For Kiro, add the `ghoststack-bridge` server **inside** `mcpServers` in `.kiro/settings/mcp.json`, approve `GHOSTSTACK_BRIDGE_TOKEN` in Kiro's "Mcp Approved Env Vars" setting, and start Kiro from a shell that exported it. In the probe page, paste the editor token and use buttons 1 to 4 (publish, list, approve, roll back).

## 8. Dependency cost (requirement 2.8)

| Dependency | Where | Reason | Cost |
|---|---|---|---|
| `@modelcontextprotocol/sdk` 1.32.2 (MIT) | `spikes/mcp-bridge` | Official MCP server and client. | Added 88 packages to the lockfile (369 total) and about 4.5 MB unpacked. Peer `zod` is already present. |
| `vite` ^8.3.8 (dev) | `spikes/browser-probe` | Dev server and the bundler for the bridge entry points. | Already a dependency of `apps/web`. No new weight. |
| `fake-indexeddb` ^6.2.8 (dev) | `packages/ai-core` | Durable-checkpoint tests in Node. | Already used by `packages/storage`. |

The only package in the lockfile with an install script is `fsevents`, a macOS-only optional dependency that was not added by the MCP SDK.

## 9. Mistakes made during M2

- Two commits went in before I read a failing lint result. Both were local and fixed in the next commit. After that I checked exit codes before committing.
- Several text edits silently did not apply because Prettier had reflowed the target lines. I now check that an edit applied before relying on it.
- My test helpers used `any`, which the repo's lint rules reject. I replaced them with typed shapes, with no suppressions.
- **Key handling (not my error, but worth recording):** the OpenRouter key had been placed in the tracked `.env.example`. I found it with the secret scan and moved it to `.env` (ignored) before anything was committed. The key was also pasted into chat, so rotate it.
- A shared browser session had navigated to an unrelated app, and I wrote a throwaway token into that page's storage. I removed it, left the app's own data alone, and switched to a separate session.
