# M3 worktree briefs
Binding: `docs/UI_CONTRACT.md` sections 1 to 4, 8 and 9; `packages/shared-contracts/src/ai.ts`; `docs/MILESTONE.md` M3 (principles, slice text, cut order). If a brief and the contract disagree, the contract wins and you say so in `HANDOFF.md`.

## Rules every slice shares
- Branch `feature/<name>`, folder `.worktrees/<name>`, `npm ci` inside, own port with `GS_PORT`.
- Exclusive folder ownership (table below). Central files (contract section 1) are read-only. Need a dependency, export, command or schema change? Write it in `HANDOFF.md` section 3.
- AI output and MCP input are untrusted. Plans hold `ProjectCommand`s only. Only `session.restore` after approval changes a Stack. Keys live in memory only.
- Real code paths only: no mock data, no hardcoded rows, no fake providers outside `ai-providers` demo adapter (rule-based, deterministic, real plans). Test servers live in test files.
- No `eval`, `new Function`, generated JavaScript. No new runtime dependency.
- Tests next to code. `fast-check` for the listed properties. Zero network calls in `npm test` (use a local `http` server on port 0).
- Gate in the worktree: `typecheck`, `lint`, `format:check`, `test`, `build`. UI slice also runs its e2e on its port and clicks through the flow with `playwright-cli`.
- `HANDOFF.md` at worktree root (contract section 6). Name every export. Commit on your branch; do not merge, push or touch `main`.

## Who does what
| Slice | Branch | Port | Owns | Exports (fixed names) |
|---|---|---|---|---|
| M3.1 | `feature/m3-ai-core` | 5201 | `packages/ai-core/**` | `parsePlan`, `dryRunPlan`, `summarizePlan`, `buildContext`, `runTransaction`, `revertOperation`, `normalizeProviderError`, `getRegisteredActions`, types `PlanSummary`, `TransactionOptions`, `DryRunResult` |
| M3.2 | `feature/m3-ai-providers` | 5202 | `packages/ai-providers/**` | `createProvider(config): AIProviderAdapter`, `createDemoProvider`, `createOllamaProvider`, `createOpenAICompatibleProvider`, `buildSystemPrompt`, `PLAN_JSON_SCHEMA`, `describeProvider(config)` |
| M3.3 | `feature/m3-ai-ui` | 5203 | `apps/web/src/features/ai/**`, `tests/e2e/m3-ai.spec.ts` | `AIPanel`, `AIStatusChip` (take `EditorSlotProps`), `ai/index.tsx` |
| M3.5 | `feature/m3-mcp` | 5205 | `packages/mcp-server/**`, `apps/web/src/features/ai/bridge/**`, `tests/e2e/m3-mcp.spec.ts` | `createMcpServer`, bridge client `connectBridge` |

Waves: M3.1 and M3.2 first, in parallel. M3.3 starts when both are merged (it needs real exports). M3.5 starts after M3.1 merges. The orchestrator merges, wires the shell slot, and runs the full gate.

M3.1 and M3.2 may use each other's contract types from `shared-contracts/src/ai.ts` only. M3.2 does not import `ai-core`. M3.3 imports `ai-core` and `ai-providers` through their package entry points and the session hooks in `app/`.

## Wave 2 (locked 2026-11-27, after wave 1 merged)
- Wave 1 is on `main`: `packages/ai-core`, `packages/ai-providers` (results in `m3-1-result.md`, `m3-2-result.md`). Read them: they list exact signatures, `approvedPlan = serializePlan(plan)`, `retryAfterMs`, locality rules.
- The orchestrator already wired the shell: `features/workspace/AIDock.tsx` lazy-loads `AIPanel` and `AIStatusChip` from `features/ai/index.tsx` (placeholder bodies; M3.3 replaces them, keeping `AIPanelProps = EditorSlotProps & { onClose }` and `AIStatusChipProps = EditorSlotProps & { onOpen }`). Menu item View > AI assistant and shortcut `A` exist. Do not edit `features/workspace/**`.
- `apps/web/src/features/ai/proposals.ts` (approval queue: `enqueueProposal`, `listProposals`, `dismissProposal`, `subscribeProposals`) is locked. M3.3 renders the queue in the panel with the same review UI as a prompt plan and must apply only after Approve. M3.5 only calls `enqueueProposal` after `parsePlan` and `dryRunPlan`.
- Non-secret provider settings persist in `localStorage` key prefix `gs.ai.` (interface preferences, allowed by contract section 8). The key (`apiKey`) never does.
- `@modelcontextprotocol/sdk` and `ws` are installed in `packages/mcp-server` (D2). No other dependency changes; request in HANDOFF.
- `features/ai/bridge/**` belongs to M3.5; everything else in `features/ai/**` belongs to M3.3.
