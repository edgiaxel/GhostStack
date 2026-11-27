# HANDOFF: M2 check and M3 (2026-11-27)

## Completed (all on `main`)

- **M2.1 to M2.8:** present in the repo; gate re-run (below). Details in `docs/handoffs/m2x/`.
- **M3.0 contract:** `packages/shared-contracts/src/ai.ts` (AIPlan, allowlist, ProjectContext, provider and operation types), `docs/UI_CONTRACT.md` section 9.
- **M3.1 `ai-core`:** `parsePlan`, `dryRunPlan`, `summarizePlan`, `buildContext`, `runTransaction`, `revertOperation`, `normalizeProviderError`. `approvedPlan` must be `serializePlan(plan)` from the Approve click.
- **M3.2 `ai-providers`:** `createProvider`, demo (offline, rule-based), Ollama, OpenAI-compatible, `describeProvider`. No fallback between providers.
- **M3.3 AI panel:** `apps/web/src/features/ai` (settings, consent, prompt, review, progress, report, revert, proposal queue). Mounted by `features/workspace/AIDock.tsx` (View > AI assistant, key `A`, status chip). Non-secret settings in `localStorage` `gs.ai.*`; the API key is in memory only.
- **M3.5 MCP:** `packages/mcp-server` (stdio server, loopback WebSocket hub, six tools) and `features/ai/bridge` (`BridgePairing`, mounted in `AIPanel`). `npm run build -w @ghoststack/mcp-server` writes `dist/cli.mjs`. Setup and security: `docs/MCP.md`. Proposals only reach `features/ai/proposals.ts`; applying needs Approve.
- Dependencies added (owner approval D2): `@modelcontextprotocol/sdk`, `ws` in `mcp-server` only. `npm audit`: 0 vulnerabilities.
- Per-slice results: `docs/handoffs/m3/m3-{1,2,3,5}-result.md`.

## Verified on `main` (commands run 2026-11-27)

`typecheck`, `lint`, `format:check`, `npm test` (71 files, 811 tests), `build`, `bundle:check` (entry 285.4 kB, player 108.6 kB), `test:hooks` (9 of 9) pass. `GS_PORT=5173 GS_NO_WEBSERVER=1 npx playwright test` (chromium, dev server started by me): 85 passed, 2 skipped. Greps for `eval`, `new Function`, and `apiKey` near storage or logging found nothing.

## Contracts

- Plans hold `ProjectCommand`s only (12 allowed types, max 50 steps, 64 kB). One approved plan is one `session.restore` and one undo step, after a `Before AI:` checkpoint.
- No new data stores. IndexedDB `ghoststack` v2 unchanged.

## Not verified and caveats

- No run against a real hosted provider, a real Ollama model (the `format` schema may be rejected by some versions), or a third-party MCP client. Adapters and the bridge were tested against local test servers and the SDK client only.
- The remote consent dialog has a component test, not e2e.
- CI workflow still never run on a GitHub runner; Firefox and WebKit not run.
- MCP connection lives only while the AI panel is open. Wire protocol is duplicated in `mcp-server/src/protocol.ts` and `bridge/protocol.ts`; an integration test guards drift.
- Two flaky `apps/web` unit tests failed once each in sub-agent runs and passed on rerun; not diagnosed.
- Earlier M2 caveats in git history of this file still apply (Inter not bundled, duplicate/paste skip behaviors).

## Next (M3.6, M4)

1. Owner: record one run each with Ollama, a hosted OpenAI-compatible provider and a real MCP client.
2. Run CI on GitHub; fix findings.
3. M4: deployment, demo video, submission.
