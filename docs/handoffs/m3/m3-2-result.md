# HANDOFF: M3.2 `packages/ai-providers`

Branch `feature/m3-ai-providers`. This file replaces the M2 `HANDOFF.md` that sits at the root on `main`. Keep both when merging (rename this one, for example `docs/handoffs/m3/m3-2-result.md`).

## 1. Files touched

All under `packages/ai-providers/src/` (no other path changed).

- Source: `index.ts`, `registry.ts`, `config.ts`, `demo.ts`, `openai.ts`, `ollama.ts`, `chat.ts`, `connection.ts`, `transport.ts`, `platform.ts`, `prompt.ts`, `plan-output.ts`, `errors.ts`, `adapter-util.ts`.
- Test support (not exported): `testing/mock-server.ts` (local `http` server, port 0), `testing/harness.ts`, `testing/fixtures.ts`, `testing/plan-check.ts`, `testing/node-shims.d.ts`.
- Tests: `prompt.test.ts`, `demo.test.ts`, `http-adapters.test.ts`, `contract.test.ts`, `properties.test.ts`, `registry.test.ts`, `source-rules.test.ts`.

## 2. Exported entry points (`@ghoststack/ai-providers`)

Names fixed by the README table:

- `createProvider(config, deps?): AIProviderAdapter`
- `createDemoProvider(options?)`, `createOllamaProvider(config, deps?)`, `createOpenAICompatibleProvider(config, deps?, options?)`
- `buildSystemPrompt(allowlist?)`, `PLAN_JSON_SCHEMA`
- `describeProvider(config): Result<ProviderDescription, GhostError>`

Extra exports (additive): `listProviderKinds()`, types `ProviderDescription`, `DemoOptions`, `OpenAICompatibleOptions`, `ProviderDeps`, `FetchLike`, `ProviderError`.

Behavior the UI and ai-core can rely on:

- Adapters never throw. Failures are `Result` errors with codes from `ERROR_CODES`. A 429 error also carries `retryAfterMs` (`ProviderError`, a structural extension of `GhostError`, capped at 60 000 ms).
- `createProvider` with invalid settings returns an adapter that sends nothing and answers `PROVIDER_UNSUPPORTED_CAPABILITY`. `describeProvider` returns the same error as a value.
- Creating an adapter sends nothing. There is no fallback between providers.
- `providerMeta` is set by the adapter (`providerId`, `model`); any value from the model is dropped.
- Defaults: generate timeout 60 s, test timeout 10 s per attempt, response cap 1 MiB, request cap 256 kB, prompt cap 4 000 chars, temperature 0.
- `deps` (`fetch`, `nowMs`, `setTimer`, `clearTimer`, `retryDelayMs`) are injectable and default to the platform.

## 3. Contract, dependency and config changes requested (not made)

1. `packages/ai-providers/package.json`: add `"zod": "^4.6.7"` to `dependencies`. The package imports `zod` (JSON schema generation, config validation). It resolves today only through hoisting. Not a new package for the lockfile.
2. `ProviderConfig` has no `locality`, `temperature` or capability fields. I worked around it (see section 4). If you want an explicit "treat as local" or `structuredOutput` switch for OpenAI-compatible endpoints, add optional fields to `PersistedProviderSettings`.
3. `GhostError` has no `details`. `retryAfterMs` rides on the error object as an extra property. If you want it in the contract, add an optional `retryAfterMs` to `GhostError`.
4. `ERROR_CODES` has no cancel code. A cancelled request is `PROVIDER_UNAVAILABLE` with the message "The request was cancelled." ai-core should detect cancellation by the signal it owns, not by this text.
5. `tsconfig.json` for the package keeps `lib: ES2022` and `types: []`. `fetch`, timers and `AbortController` are reached through `platform.ts`. Tests use `src/testing/node-shims.d.ts` for `node:http` and `node:fs`. Adding `@types/node` for the test files would let that shim go.

## 4. Caveats and known gaps

- **Not verified against any real endpoint.** OpenAI-compatible and Ollama adapters were exercised only against local mock servers. No live OpenAI, LM Studio or Ollama run was made. The Ollama `format` receives the full draft-7 plan schema with `definitions`/`$ref`; whether real Ollama versions accept it is unverified. If one rejects it, the first request returns `PROVIDER_UNAVAILABLE` (HTTP 400) with no retry.
- **Decisions where the spec was ambiguous (recommended option taken):**
  - OpenAI-compatible `structuredOutput` is on only for `https://api.openai.com...`; other hosts use JSON-object mode (`jsonMode: true`). Override with the third argument `options`. JSON schema is sent with `strict: false`.
  - Locality comes from the host alone: loopback means `local`, anything else `remote`. A LAN Ollama host is labelled `remote`. No config field states locality.
  - Plain `http` to a non-loopback host is rejected for OpenAI-compatible (a key would travel in clear text). It is allowed for Ollama, which takes no key, and is labelled remote.
  - Model names must match `[A-Za-z0-9][A-Za-z0-9._:/@+-]{0,127}` so they are safe to print. API keys must be visible ASCII, 1 to 1 024 chars. Timeout range 1 000 to 600 000 ms.
  - `apiKey` is dropped for `demo` and `ollama`.
  - Demo prompt rules: quiz (`quiz|trivia|question`), inventory (`inventory|stock|pantry|supplies|items`), recipe (`recipe|ingredient|cookbook|shopping`). Anything else returns `INVALID_AI_PLAN` listing what it can do.
- Demo plans were checked by a structural replay in `testing/plan-check.ts` (schema, per-type element properties, state keys, element and navigate targets, step order). They were **not** run through `ai-core.parsePlan` or `dryRunPlan` or `domain.applyCommand`: this package may not import them. The orchestrator should add that check at integration (demo quiz, recipe and inventory plans against a real Stack).
- The demo recipe list text refreshes on add and on card enter. The input box does not clear after adding (no action sets an input value).
- `UPDATE_STATE_SCHEMA` replaces the schema, so demo plans copy existing variables that still parse. A variable that fails `StateVariableSchema` in the context would be dropped.
- Test run time is about 5 s because three tests wait for a real 1 s timeout.
- One unrelated flaky test appeared once in the full run: `apps/web/src/features/history/HistoryControls.test.tsx` ("saves and lists a checkpoint…"). It passed on two reruns. Not touched.

## 5. What the next step needs

- M3.3 (UI): `createProvider(config)` from the settings, `describeProvider(config)` for the badge, `adapter.capabilities.local` for the local/remote label and consent, `testConnection(signal)` for the status chip, `generatePlan({ context, prompt, signal })` for planning. Show `error.message` as is (fixed text, no secrets). Honor `retryAfterMs` for 429.
- M3.1 wiring: run `parsePlan` and `dryRunPlan` on every returned plan; adapters validate with `AIPlanSchema` only.
- Apply the dependency fix in section 3.1.
- M3.6: a recorded live run against a real OpenAI-compatible endpoint and a real Ollama model (date, kind, model, result, no key).

## 6. Commands run and results (in the worktree)

- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0 (after removing one unused import).
- `npm run format:check`: exit 0.
- `npm test`: first full run exit 1 (1 failure in the unrelated `HistoryControls.test.tsx`); two reruns exit 0, 50 files, 530 tests passed. `npx vitest run packages/ai-providers`: 7 files, 175 tests passed.
- `npm run build`: exit 0.
- Not run: any e2e spec (the slice has none), any live provider call.
