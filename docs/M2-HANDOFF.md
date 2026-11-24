# M2 Handoff: Decisions and Results

Status: M2 closed on 2026-11-23. Two owner decisions and four checks remain open (section 6).
Evidence and method for every claim: `M2-FEASIBILITY.md`. This file lists what to reuse, what was decided and what M3 and M4 must respect.

## 1. Outcome

| Risk | Result |
|---|---|
| Hosted model returns a valid `AIPlan` | Passed from Node. OpenRouter, `nvidia/nemotron-3.5-super-vl:free`, 3 of 3 prompts. |
| Failed AI operation leaves the project unchanged | Passed, with faults injected at every stage. |
| Committed operation can be reverted | Passed, including real Chromium IndexedDB across a page reload. |
| External agent reads the project and proposes without mutating or approving | Passed with the SDK client across real processes. |
| AI is optional for the editor | Passed. No file under `apps/` changed. `apps/web` imports nothing from `ai-core`, `spikes` or the MCP SDK. |

Recommendation recorded in the report: go for M4, building on `packages/ai-core` and the bridge.

## 2. Decisions

| ID | Decision | Status |
|---|---|---|
| T-013 | MCP transport: browser-owned state (IndexedDB stays the source of truth) plus an authenticated loopback bridge. Two separate tokens: agent token on `/mcp`, editor token on `/editor/*`, which also needs an allowed `Origin`. Bridge binds to loopback and checks the `Host` header and exact origins, no wildcard CORS. Fallback: stdio with `--gsp` and `--proposals-out`. | **Proposed. Needs owner approval.** |
| T-028 | Layout: reusable core in `packages/ai-core` (depends only on `domain` and the `storage` port, no DOM). Adapters, bridge and probe live in `spikes/` until promoted in M4. | Approved (owner, 2026-11-16) |
| T-029 | Live targets: OpenRouter with one free Nemotron model, local Ollama `gemma3:4b`. At most 15 live requests, sequential, only with `GHOSTSTACK_LIVE=1`. Key only from `OPENROUTER_API_KEY`, never written to a file, log, fixture or config. | Approved (owner, 2026-11-16) |
| T-030 | MCP client for the spike is Kiro. SDK `@modelcontextprotocol/sdk` 1.32.2. One long-running loopback bridge plus a stdio variant. Fallback: `.gsp` patch import. | Approved (owner, 2026-11-16) |
| T-031 | Durable checkpoints: `checkpoints` IndexedDB store, database version 1 to 2 with an explicit upgrade, newer-version refusal kept. | Implemented and verified. Owner confirmation pending. |

Residual risks of T-013 that the owner must accept or reject:
- Any local process that holds the editor token can approve. Tokens are secrets held in memory.
- A deployed HTTPS editor calling a loopback bridge triggers Chrome's Local Network Access prompt (Chrome 142 and later). Documented, not tested.
- The bridge is a separate process the creator starts, so it stays optional and is not part of first run.

## 3. Reusable code (`packages/ai-core`)

| Piece | File |
|---|---|
| `AIPlan` schema, seven patch commands, `parseAIPlan`, provider JSON schema | `src/plan.ts` |
| Apply a plan to an isolated copy, never mutating the input | `src/patch.ts` |
| Transaction manager: checkpoint, apply, validate, atomic commit, rollback, crash recovery | `src/transaction.ts` |
| Checkpoint stores: memory and repository-backed with read-time validation | `src/checkpoints.ts` |
| Provider contract, privacy gate, plan text parsing, project context | `src/provider.ts` |
| Plan review | `src/review.ts` |
| Offline deterministic demo adapter | `src/demo.ts` |
| Error codes | `src/errors.ts` |

Also reusable: IndexedDB v2 checkpoint store in `packages/storage/src/indexeddb/`.

`UPDATE_BEHAVIOR` is accepted by the schema and rejected at apply time until the M3 behavior model exists.

## 4. Throwaway code to promote or delete in M4

| Spike | Contents | Fate |
|---|---|---|
| `spikes/providers` | OpenAI-compatible and Ollama adapters, opt-in live OpenRouter run | Promote to a provider package in M4 |
| `spikes/mcp-bridge` | MCP server (six tools), loopback HTTP server, stdio entry, editor endpoints, `.gsp` proposals fallback | Promote to `apps/mcp-server` in M4 if T-013 is approved |
| `spikes/browser-probe` | Provider CORS and IndexedDB probe page | Delete once the AI panel exists |

## 5. Findings that constrain later work

Provider and plan handling:
- The provider schema must drop the JSON Schema keyword `propertyNames`. Nvidia's grammar compiler behind OpenRouter returns HTTP 400 on it. Every reply is still fully validated by `parseAIPlan`.
- Reasoning models need a large token cap. A 50-token cap truncated output. The live run uses 4000.
- Only `nvidia/nemotron-3.5-super-vl:free` advertised `structured_outputs` when queried.
- Zod drops a `__proto__` key in a record. An explicit guard rejects reserved names that reach the applier.
- Stored checkpoints are untrusted. Every read re-validates the project, and a damaged record is skipped when listing.
- Rollback refuses with `ROLLBACK_CONFLICT` if the project changed after the operation.

Bridge:
- A stdio MCP process spawned by a client cannot see the browser's IndexedDB, so a long-running loopback process is needed.
- One shared secret would let an agent approve its own proposals, so two tokens are required.
- Validator error `details` are capped at 100 characters before they reach an agent.
- `create_checkpoint` over MCP is not durable (`durable: false`). Decide in M4 whether the editor creates agent checkpoints.

Browser:
- A failed fetch cannot distinguish "not running" from "CORS blocked".
- Only one headless Chromium was used. Firefox and Safari were not run.

## 6. Open after M2

| Item | Owner action |
|---|---|
| Approve or change T-013 | Decision |
| Confirm T-031 | Decision |
| Kiro as MCP client | Run the steps in `M2-FEASIBILITY.md` section 7 |
| OpenRouter from a browser | Paste the key into the probe page and run the provider checks (about 1 completion) |
| Ollama (criterion 2) | Start Ollama with `gemma3:4b`, then add a live run |
| Deployed HTTPS plus loopback bridge | Test after the first deploy in M5 |
| Rotate the OpenRouter key | The key was pasted into chat during M2 |

## 7. Rules M3 must keep

- No M3 change may import `ai-core`, `spikes` or the MCP SDK into `apps/web`. M4 does that wiring.
- The behavior model is the canonical AST. Once it exists, `UPDATE_BEHAVIOR` can be enabled in `ai-core`.
- Any M3 change to the `domain` schemas must keep `ai-core` tests green (`npm run test`).
- Do not bump the IndexedDB version again without an explicit upgrade path and a test from every earlier version.

## 8. Test counts at close

729 passed, 1 skipped (opt-in live OpenRouter), 0 failed. `ai-core` 76, `spikes/providers` 35 plus the skipped one, `spikes/mcp-bridge` 73.
