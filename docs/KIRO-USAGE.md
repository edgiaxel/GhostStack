# How Kiro Is Used in GhostStack

> **Purpose:** the working record behind the hackathon write-up. Kiroween judges look for how effectively Kiro was used, so this file separates what was actually done, what is configured but not yet exercised, and what still has to be done to produce real evidence.
> **Rule:** claim only what the repository or the Kiro session history can show. Items marked **confirm** need the owner, who knows how Kiro was used outside this repository.
> **Last updated:** 2026-11-26.

## 1. What the hackathon asks for

The submission must include the `/.kiro` directory at the repository root (it is committed and not in `.gitignore`) and a write-up that covers these topics. Judging criterion "Technological Implementation" rewards a thoughtful strategy, a variety of Kiro tools used impactfully, and experimentation.

| Topic the write-up must answer | Where the evidence is | Status |
|---|---|---|
| Kiro IDE, CLI, Web or Crew, and how they differed | This file, section 3 | IDE used. CLI, Web, Crew: **confirm** |
| Custom agents | `.kiro/agents/` | Defined 2026-11-26, not yet used in a session |
| Agent hooks | `.kiro/hooks/` | One hook since M0 (never fired); three added 2026-11-26, tested as scripts, not yet fired by Kiro |
| Spec-driven development vs vibe coding | `.kiro/specs/`, git history | Real spec in history (`m1-foundation`); none in the tree yet |
| Steering docs | `.kiro/steering/` | 10 files, all four inclusion modes used |
| MCP | `.kiro/settings/mcp.json` | GitHub MCP configured, not used. The product's own MCP server is M3 |
| Property-based testing | `fast-check` tests, spec `pbtResults` in history | Used in code. One real finding (section 4.7) |
| Kiro powers | none | Not used. Skills were used (section 4.8) |

## 2. The workflow in one paragraph

Documents define intent (`docs/PRD.md`, `DESIGN.md`, `ARCHITECTURE.md`, `MILESTONE.md`). Steering files give Kiro the rules every time, or only when relevant files are open. Each milestone chunk goes through a Spec (requirements, design, tasks) that links back to PRD feature IDs. Big chunks split into git worktrees, one agent role per slice, bound by a written contract (`docs/UI_CONTRACT.md`) and a guard hook. Each slice ends with a handoff. The orchestrator audits, merges, runs the full gate and drives the app with Playwright. The next session starts from a `SessionStart` briefing and `HANDOFF.md`, not from memory.

## 3. IDE, CLI, Web, Crew

- **IDE (used):** the Spec workflow (Requirements-First), steering, hooks, and agent chat in Autopilot mode. Property-based testing from spec Correctness is IDE-only according to the Kiro docs, which is one reason the IDE is the main surface here.
- **CLI, Web, Crew:** not used in this repository as far as the repository shows. **Confirm.** Do not write a comparison unless one was actually tried.
- Differences worth stating if tried: steering inclusion modes are not supported in the CLI (all steering loads), and spec Correctness is IDE-only.

## 4. Topic by topic

### 4.1 Steering

Ten files in `.kiro/steering/`, using all four inclusion modes on purpose:

| File | Mode | Why |
|---|---|---|
| `product.md`, `tech.md`, `structure.md`, `development-workflow.md` | always | Short rules that apply to every change: scope, boundaries, workflow, reporting |
| `testing-and-safety.md` | auto | Loaded when the request is about tests, persistence, import and export, security |
| `property-testing.md` | auto | Loaded when writing properties or invariants; lists the properties already in the repository |
| `ui-contract.md` | fileMatch `apps/web/**` | Pulls in `docs/UI_CONTRACT.md` only while the web app is being edited |
| `behavior-runtime.md` | fileMatch `packages/behavior/**` | The closed AST, no `eval`, the round-trip rule |
| `design-system.md` | fileMatch `apps/web/**/*.css` | Token and contrast rules; prototypes are reference only |
| `orchestrator-workflow.md` | manual | Runs as `/orchestrator-workflow` for multi-worktree chunks |

Strategy that made the difference (observed, not assumed):

- **Contract over preference.** `docs/UI_CONTRACT.md` fixed ownership, one shell, one theme and "no mock data" before parallel work started. After M2, a repository search found no mock or seeded data outside tests (`docs/AUDIT-M2.md` section 6.3), and no slice added a second navbar or theme.
- **Report only what ran.** The workflow steering requires exact commands and results. Every handoff in `docs/handoffs/` lists the commands that were run.
- **Keep it current.** Two always-on files had gone stale after the scaffold (they still said "before the repository is scaffolded"). They were updated on 2026-11-26. Stale steering misleads the agent, so refresh it at each milestone.
- **Scope what loads.** Large rules load by file pattern, so the always-on set stays small.

### 4.2 Specs and spec-driven development

- **Real spec in history:** `.kiro/specs/m1-foundation/` existed from the first attempt (Nov 15 to 24) and was removed by the clean-slate reset in commit `38b4ba0`. Read it with `git show 38b4ba0^:.kiro/specs/m1-foundation/requirements.md`. Facts from the files: workflow `requirements-first`, 331 lines of requirements, 1,348 lines of design with a Correctness Properties section, 438 lines of tasks, all 69 tasks checked, and `tasks.meta.json` holding Kiro's `pbtResults` for the property tests.
- **Current gap:** `.kiro/specs/` contains only a README. M1 and M2 in this repository were built from a written contract and per-slice briefs (`docs/handoffs/m2/*.md`), not from Kiro spec files. Those briefs do the job of a design plus tasks, but they were hand-written. Do not present them as Kiro specs.
- **Plan:** every M2.x chunk runs through Kiro's Spec workflow (see `.kiro/specs/README.md`), so the repository ends with seven or eight real specs linked to PRD IDs.
- **Spec versus vibe coding (to fill with real observations after the chunks run):** compare one chunk built from a spec against one built by direct prompting, using the same checks: defects found by the audit flows, rework count, and time to a green gate. Record the numbers, not impressions.

### 4.3 Hooks

| Hook | Trigger | What it does | Evidence |
|---|---|---|---|
| `task-completion-review` | PostTaskExec (agent) | After a spec task, check acceptance criteria and report exact commands | Exists since M0. Never fired: no spec task has run since the reset |
| `guard-writes` | PreToolUse on file writes (command) | Blocks credentials, `.kiro` in `.gitignore`, `eval` and `new Function` in source, and edits to central files from a worktree | `node --test .kiro/hooks/guard-writes.test.mjs`: 8 tests pass |
| `session-brief` | SessionStart (command) | Prints branch, uncommitted count, latest commits and the current focus from `docs/MILESTONE.md` | Script output checked by hand; not yet fired by Kiro |
| `typecheck-on-stop` | Stop (command) | After a turn that changed `apps`, `packages` or `tests`, runs the type check and reports errors to the agent | Failure path checked with a planted type error (exit 1 with the error text); not yet fired by Kiro |

The new hooks were created on 2026-11-26 and take effect from the next session. Their value claim must come from the next sessions: note each time one blocks something or catches an error, with a screenshot of the hook card in the IDE.

### 4.4 Custom agents

`.kiro/agents/` holds three agents that codify roles already used in the M1 and M2 builds:

- `orchestrator`: the four-phase orchestration prompt. Loads the workflow, the contract and the last handoff. Denies push, hard reset and clean.
- `slice-builder`: one slice inside one worktree. Cannot write central files, cannot merge or push.
- `reviewer`: read-only. Audits a diff against the contract, security rules, tests and accessibility.

Honest status: written, not yet used in a session. Use them in the next session (agent picker in the chat header) and record how the permission rules behaved. The effect to measure is the removal of the long pasted prompt and the number of out-of-scope edits that were stopped.

### 4.5 MCP

- Configured: GitHub MCP in `.kiro/settings/mcp.json`. Not used so far.
- Product MCP server (M3) is a feature of GhostStack, not development tooling. Keep the two stories separate in the write-up.
- Candidate for development: a Playwright MCP server so the IDE agent can drive the app. This session used the Playwright CLI skill instead. Add it only if it will be used, and explain what it enabled.

### 4.6 Property-based testing

`fast-check` properties live next to the code (list in `.kiro/steering/property-testing.md`). Areas covered: GhostScript round trip, runtime safety, layout identity, z-order permutation, resize geometry, undo and redo, `.gsp` round trip. The first spec also recorded `pbtResults` through Kiro.

### 4.7 What property testing actually found

1. **Card ids and `.gsp` export.** A round-trip property over arbitrary card ids failed. fast-check shrank it to the card id `\ ` (a backslash and a space). The domain accepts any non-empty card id, but `exportGsp` correctly refuses it ("Unsafe archive entry name") because the id becomes a ZIP entry name. Nothing is corrupted and the UI only creates UUID ids, so users cannot hit it today. It matters for M3: AI or MCP proposals are untrusted and could create such ids. In M2 the generator was narrowed to safe ids without diagnosing the cause. It was diagnosed on 2026-11-26 and is recorded as an open item (`docs/AUDIT-M2.md` section 9, item 10; M2.8). Fix: reject path-unsafe ids at the domain boundary and keep a property test for it.
2. **Negative zero in GhostScript.** A generated number literal `-0` prints as `0`, so the round trip does not preserve the sign. Judged harmless, so the test normalizes it. This is a decision, not a fix; it is recorded here so it is not mistaken for a passing property.

Do not claim more than this. If later chunks find more, add them with the shrunk counterexample.

### 4.8 Powers and skills

- **Powers:** none installed. Do not claim any.
- **Skills (user level, not in the repository):** antislop (UI quality), caveman (terse replies), Playwright CLI (browser flows), lean-build, safe-refactor and others were available to the agent. The owner's orchestration prompt invokes them. They are outside `.kiro/`, so judges cannot see them; describe them in the write-up as workflow aids.
- **Stretch:** package the GhostStack orchestration workflow as a Kiro power (`POWER.md` plus the steering and agent files) so other projects can reuse it. Only if time allows.

## 5. Evidence to collect while building (cheap now, impossible later)

- [ ] Kiro IDE screenshot of each Spec phase review (requirements, design, tasks) for at least three chunks.
- [ ] The hook card firing in the IDE at least once for `guard-writes` (blocked write), `typecheck-on-stop` (caught error) and `session-brief`.
- [ ] The agent picker showing `orchestrator`, `slice-builder` and `reviewer`, and one session using each.
- [ ] A property test failing in the IDE with its shrunk counterexample, then the fix.
- [ ] A spec task list with tasks checked off by Kiro, and the `tasks.meta.json` `pbtResults`.
- [ ] One before and after comparison between a spec-driven chunk and a directly prompted change.
- [ ] Commit messages that name the spec or chunk, so `git log` tells the story.

## 6. Suggested write-up outline (keep it short and factual)

1. **Approach in one paragraph:** documents define intent, steering carries the rules, specs structure each chunk, worktree agents are bound by a contract, hooks guard and verify, tests prove.
2. **Specs:** how a chunk went from requirements to tasks, what the property tests caught, what changed versus prompting directly.
3. **Steering:** the four inclusion modes and why; the contract strategy and its measured effect.
4. **Hooks and agents:** the four hooks, the three agents, one concrete catch each.
5. **MCP and powers:** state plainly what was and was not used.
6. **Property tests:** the finding in section 4.7 with its counterexample.
7. **IDE versus other surfaces:** only what was tried.
8. **What did not work:** the Playwright dev server dropping, hand-written briefs instead of specs, stale steering. Honesty here is credible.

## 7. Open items

1. Decide whether to restore the earlier `m1-foundation` spec into the tree. It is genuine Kiro output from inside the submission period, but it describes the earlier implementation and the owner's reset removed it on purpose. Option: keep it in history and link the commit in the write-up (no repository change).
2. Confirm what other Kiro surfaces were used (CLI, Web, Crew) for section 3.
3. Run the next session with the new hooks and agents, then update sections 4.3 and 4.4 with real observations.
4. Decide on the hackathon category (`docs/MILESTONE.md`, M4); it changes what the write-up should emphasize.
