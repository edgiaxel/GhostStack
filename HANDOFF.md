# HANDOFF: M3 closed, ready for M4 (2026-11-27)

## State

- M2.1 to M2.8 and M3.0 to M3.6 are on `main` and verified. The only open M3 item is a live Ollama run (no Ollama on the build machine).
- CI is green on a GitHub runner (run 46036530838): typecheck, lint, format, unit tests, build, bundle budget, Chromium e2e.
- The repository is public, Apache-2.0, with `.kiro/` committed.

## Verified (commands run 2026-11-27)

- `npm run typecheck`, `lint`, `format:check`, `test` (72 files, 820 tests), `build`, `bundle:check` (entry 285.3 kB, player 108.6 kB), `test:hooks` (9 of 9). `npm audit`: 0 vulnerabilities.
- `GS_NO_WEBSERVER=1 npx playwright test` against a dev server I started: 87 passed, 3 skipped (`audit-screens` without `AUDIT_SHOTS`, one existing skip, the live spec without a key).
- `GS_BROWSERS=firefox,webkit` on the core flows: all pass. Single failures seen once each under load passed on reruns.
- Live hosted provider: `node --env-file=.env node_modules/@playwright/test/cli.js test m3-live-openrouter` (OpenRouter, `openai/gpt-4o-mini`): consent, plan, approve, undo, redo, save, preview, no key in storage. Passed.
- MCP: `tests/e2e/m3-mcp-build-app.spec.ts`. An SDK stdio client pairs with the tab, proposes an inventory app, the creator approves, and the app runs in preview and as a web export from `file://`.
- Offline: `tests/e2e/m3-critical-journey.spec.ts`. The demo adapter with the network off, approve, `.gsp` export and re-import, preview.

## Fixed in this session

- Hosted plans failed: empty `oneOf` in the plan schema, flattened commands, missing element properties and defaults, cards created after the buttons that link to them. Details are in `docs/KIRO-USAGE.md` 4.5.1.
- CI: top-bar overflow at 390 px on Linux, two flaky unit tests (fake timers starving fake-indexeddb, a shared Stack id), three racy e2e tests, two Windows-only test failures.
- The reason a dry-run step failed is now shown under the step. System fonts replace the unloaded `Inter`. The brand adds a mono mark, a light wordmark and a stacked lockup. The `#/design` gallery is off the nav.

## Contracts (unchanged)

- `docs/UI_CONTRACT.md` sections 1 to 9. AI plans: 12 allowed command types, 50 steps, 64 kB, applied only after Approve as one `session.restore` with a `Before AI:` checkpoint.
- IndexedDB `ghoststack` v2. Env: `GS_PORT`, `GS_BROWSERS`, `GS_NO_WEBSERVER`, and for the live spec only `OPENROUTER_KEY` and an optional `OPENROUTER_MODEL` in a git-ignored `.env`.

## Known gaps

- Ollama is not verified live. Some versions may reject the `format` schema.
- No desktop MCP client (Kiro or Claude) was used. The SDK stdio client is the verified path.
- The layer panel and visual regression baselines were cut. A real crash test was replaced by the seeded-checkpoint flow (documented).
- Duplicate and paste do not copy behaviors. Deleting an asset cannot be undone for its bytes.
- Undo history does not survive a trip to the preview route (a new session opens on return).
- CI warns that `actions/checkout` and `actions/setup-node` v4 run on a deprecated Node 20.

## Next (M4)

See `docs/MILESTONE.md` section 6: deploy `apps/web/dist` to a static host and verify it, write and record the demo (under three minutes), and submit. Optional: a live Ollama run, bump the CI action versions.
