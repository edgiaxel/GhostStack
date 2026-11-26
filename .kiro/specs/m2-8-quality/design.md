# M2.8 Quality, part 1: Design

- `.github/workflows/ci.yml`: one job, Node 22, npm cache, gates in the order of requirement 1. The dev server is started by a shell step and polled with curl; Playwright reuses it (`reuseExistingServer`). Report and server log are uploaded on failure.
- `playwright.config.ts`: `projects` built from `GS_BROWSERS`, optional `GS_NO_WEBSERVER`.
- `packages/domain/src/validate.ts`: `SAFE_ID` check in `checkIntegrity`, no new export, no schema change.
- `packages/domain/src/safe-ids.test.ts`: fast-check properties P1 (the test imports project-format; allowed in tests only).
- `tests/e2e/m2x-a11y.spec.ts`: creates a Stack, a card element and a preview through the UI, then runs `AxeBuilder` with WCAG 2 A and AA tags per screen and asserts no serious or critical results. The design screen is skipped with an annotation until the `/design` route exists.
- Not in scope: code splitting, visual regression, fixing violations in feature folders.
