# M2.8 Quality, part 1: Requirements

Source: docs/MILESTONE.md M2.8, docs/AUDIT-M2.md section 9 item 10, docs/handoffs/m2x/README.md (quality). Infrastructure only: no product behavior changes.

1. CI. WHEN a pull request or a push to main happens, THE workflow SHALL run `npm ci`, typecheck, lint, format:check, test, build, then the Playwright Chromium suite against a dev server the workflow starts.
2. Browsers. WHERE `GS_BROWSERS` lists `firefox` or `webkit`, THE Playwright config SHALL add those projects. Chromium stays the default.
3. Accessibility. THE e2e scan SHALL run axe on library, workspace, preview and design screens built from real data created through the UI, and SHALL fail on any serious or critical violation. Violations outside this worktree's folders SHALL be listed in HANDOFF.md.
4. Safe ids. WHEN a Stack contains a card, element, asset or behavior id that is not 1 to 128 of `[A-Za-z0-9_-]`, or that names an `Object.prototype` member, `validateStack` SHALL reject it with a message that names the kind of id.
5. Failure cases: empty id, `.`, `..`, slashes, backslashes, drive letters, control characters, non-ASCII, `toString`, `__proto__`.

# Correctness property

P1. For any ids drawn from the safe set, a Stack validates and `importGsp(exportGsp(stack))` returns an equal Stack and equal asset bytes. For any id outside the set, `validateStack` fails.
