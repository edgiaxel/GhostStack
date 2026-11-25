# M2 worktree briefs

Shared rules for the four M2 worktrees. Read `docs/UI_CONTRACT.md` first. It is binding and this page only adds M2 detail. If a brief and the contract disagree, the contract wins and you say so in `HANDOFF.md`.

## Who builds what

| Worktree | Branch | Folder | Port | Brief |
|---|---|---|---|---|
| `card-editor` | `feature/card-editor` | `.worktrees/card-editor` | 5181 | [card-editor.md](card-editor.md) |
| `behavior` | `feature/behavior` | `.worktrees/behavior` | 5182 | [behavior.md](behavior.md) |
| `history` | `feature/history` | `.worktrees/history` | 5183 | [history.md](history.md) |
| `preview-export` | `feature/preview-export` | `.worktrees/preview-export` | 5184 | [preview-export.md](preview-export.md) |

The four run at the same time. Do not wait for another worktree and do not edit its folder. Code against the contract types in `packages/shared-contracts`. Pieces that another worktree owns exist on `main` as placeholders or skeletons so your slice compiles and runs on its own.

## Start

1. `cd .worktrees/<name>`. Confirm `git branch --show-current` prints your branch.
2. If `node_modules` is missing, run `npm ci`. Never `npm install` (it edits the lockfile).
3. Run your dev server on your own port: PowerShell `$env:GS_PORT='<port>'; npm run dev`. Use the same variable for `npm run test:e2e`.

## Non-negotiable

- Real data only. Every Stack, element, asset and checkpoint goes through the real session, domain commands and IndexedDB. No mock data, no hardcoded sample rows, no seeded Stacks, no `localStorage` for project data. Tests create data through the UI or through the real packages.
- Dispatch only. Change a Stack with `session.dispatch`. The only allowed direct `applyCommand` call is a read-only dry run for diagnostics.
- Stay in your folders. Section 1 of the contract lists central files. Need a change there? Write it in `HANDOFF.md` section 3 and work around it inside your folder without duplicating the contract.
- One navbar, one layout, one theme. Use `gs-*` classes and tokens. Check the Spectral and Paper themes.
- No `eval`, no `new Function`, no `innerHTML` with project data, no generated JavaScript.
- UI quality (antislop): every state present (loading, empty, error, success), every control real and labelled, keyboard operable with a visible focus ring, contrast 4.5:1, copy that names the cause and the next step, no decorative emoji, no em dashes in UI text, no placeholder or fake data. A control that cannot work yet is not rendered.
- Tests: unit tests for logic, property tests (`fast-check`) where a brief asks for them, jsdom tests (`// @vitest-environment jsdom` at the top of the file) for components, and one Playwright spec named in your brief. Test the failure paths too.
- Verify in a real browser with `playwright-cli` against your port and report what you clicked.

## Done

Commit on your branch. Do not push, merge or touch `main`. Write `HANDOFF.md` at your worktree root using section 6 of the contract. Report only commands you ran. State plainly anything stubbed, skipped or unverified. The orchestrator audits every handoff against the repository.