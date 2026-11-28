# How Kiro Is Used in GhostStack

> **Purpose:** the working record behind the hackathon write-up. Kiroween judges look for how effectively Kiro was used, so this file separates what was done, what is configured but not yet exercised, and what still has to be done to produce real evidence.
> **Rule:** claim only what the repository or the Kiro session history can show. Items marked **confirm** need the owner, who knows how Kiro was used outside this repository.
> **Machine-generated companion:** `docs/KIRO-EVIDENCE.md` (run `npm run evidence`). It lists the configuration, spec progress, hook events and git history. This file holds the narrative.
> **Category:** Resurrection (owner decision, 2026-11-26). **Last updated:** 2026-11-26.

## 1. What the hackathon asks for

The submission must include the `/.kiro` directory at the repository root (it is committed and not in `.gitignore`) and a write-up covering the topics below. The judging criterion "Technological Implementation" rewards a thoughtful strategy, a variety of Kiro tools used impactfully, and experimentation.

| Topic the write-up must answer | Where the evidence is | Status |
|---|---|---|
| Kiro IDE, CLI, Web or Crew, and how they differed | Section 3 | IDE used. The others are optional (see the recommendation) |
| Custom agents | `.kiro/agents/` | Defined 2026-11-26. Not yet used in a session |
| Agent hooks | `.kiro/hooks/`, `.kiro/evidence/` | `guard-writes` fired in a live session and blocked a write (logged). The other three are pending a session start or a finished turn |
| Spec-driven development vs vibe coding | `.kiro/specs/m1-foundation/` | A real Kiro spec is restored (69 tasks done, 24 property tests passed). Chunks M2.1 to M2.8 will add more |
| Steering docs | `.kiro/steering/` | 10 files, all four inclusion modes used |
| MCP | `.kiro/settings/mcp.json` | GitHub MCP configured, not used. The product's own MCP server is M3 |
| Property-based testing | `fast-check` tests, spec `pbtResults` | Used in code and in the spec. One real finding (section 4.7) |
| Kiro powers | none | Not used. Skills were used (section 4.8) |

## 2. The workflow in one paragraph

Documents define intent (`docs/PRD.md`, `DESIGN.md`, `ARCHITECTURE.md`, `MILESTONE.md`). Steering files give Kiro the rules every time, or only when relevant files are open. Each milestone chunk goes through a Spec (requirements, design, tasks) that links back to PRD feature IDs. Big chunks split into git worktrees, one agent role per slice, bound by a written contract (`docs/UI_CONTRACT.md`) and a guard hook. Each slice ends with a handoff. The orchestrator audits, merges, runs the full gate and drives the app with Playwright. The next session starts from a `SessionStart` briefing and `HANDOFF.md`, not from memory.

## 3. IDE, CLI, Web, Crew: what to use

**Decision: the IDE is the primary surface.** The hackathon question is conditional ("how did they differ, if you tried multiple?"), so using only the IDE is a complete answer. Extra surfaces help only when they do real work for this project. Kiro's docs say one agent harness powers every surface, so `.kiro/` configuration, specs and steering work in all of them.

| Surface | What it is (from the Kiro docs) | Fit for GhostStack | Cost and risk | Recommendation |
|---|---|---|---|---|
| IDE | Spec workflow, steering, hooks, agent chat. Spec Correctness (property-based testing) is IDE-only | Everything built so far | None | Primary |
| CLI | Terminal agent. Runs the same agents, steering and hooks. Has a headless mode for scripts | A second, independent run of the `reviewer` agent on each finished chunk, from a terminal, with no editing rights | Little: about ten minutes per chunk plus a few credits. Steering inclusion modes reportedly are not supported in the CLI, so every steering file loads | Optional. Worth it if you want one honest "same config, two surfaces" sentence. Do it only if you will really run it |
| Web | Browser agent that works in a cloud sandbox on a connected GitHub or GitLab repository and delivers pull requests, with an autonomous mode | One isolated task, for example the M2.8 CI workflow, while the IDE works on UI | The repository must be pushed and connected. Output is a pull request to review. Spends credits. Can conflict with worktree merges | Skip unless the repository is pushed anyway and one isolated task is left over |
| Crew | Open-source personal agent that runs on your machine over the CLI backend: chat from a dashboard or Slack or Discord, scheduled jobs, memory, background subagents | None. It solves a different problem (a persistent assistant) | Setup time, a persistent process, more to explain, no benefit to the product | Skip. The "Best Kiro Crew App" prize is for building an app with Crew, which GhostStack is not |

How to decide: every extra surface costs credits (the free allotment is 4,000 per entrant) and about a day of review time out of eight, and judges reward impact, not a checklist. If you add the CLI reviewer run, state it exactly as it happened. If you skip a surface, say nothing about it.

Facts to keep straight:
- Spec Correctness is IDE-only. That alone is a reason the IDE is the main surface here.
- Hooks work in the IDE and in CLI V3. The `guard-writes` matcher uses the tool names Kiro documents for both.

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
| `orchestrator-workflow.md` | manual | Runs as `/orchestrator-workflow`; the `orchestrator` agent also loads it |

Strategy that made the difference (observed, not assumed):

- **Contract over preference.** `docs/UI_CONTRACT.md` fixed ownership, one shell, one theme and "no mock data" before parallel work started. After M2, a repository search found no mock or seeded data outside tests (`docs/AUDIT-M2.md` section 6.3), and no slice added a second navbar or theme.
- **Report only what ran.** The workflow steering requires exact commands and results. Every handoff in `docs/handoffs/` lists the commands that were run.
- **Keep it current.** Two always-on files had gone stale after the scaffold (they still said "before the repository is scaffolded"). They were updated on 2026-11-26. Stale steering misleads the agent, so refresh it at each milestone.
- **Scope what loads.** Large rules load by file pattern, so the always-on set stays small.
- **Earlier mode strategy.** A `docs/KIRO-WORKFLOW.md` from 2026-11-15 chose a mode per kind of work (Plan for audits, Spec for slices, Default for bounded tasks, Bug Fix for defects) and a credit strategy. The mode table now lives in `development-workflow.md`; the old file is in git history (`git show d572847:docs/KIRO-WORKFLOW.md`).

### 4.2 Specs and spec-driven development

- **A real Kiro spec is in the tree again:** `.kiro/specs/m1-foundation/`, restored on 2026-11-26 from commit `38b4ba0^`, byte-identical (checked with `git diff`). It has `requirements.md`, `design.md` (with a Correctness Properties section), `tasks.md`, plus Kiro's own `.config.kiro` and `tasks.meta.json`. Facts from the files: workflow `requirements-first`, 69 tasks all checked, 24 recorded property-test results all `passed`.
- **What it is and is not.** It was created and executed in the first attempt (committed 2026-11-16, updated 2026-11-24). The owner's clean-slate reset on 2026-11-25 removed that implementation and the spec. The M1 code in the repository today was rebuilt from a contract and slice briefs, not from this spec. Present it as evidence of how Kiro's spec workflow was used on this project, not as the design of the current code. History: commits `47f6f03`, `8ca7420`, removed in `38b4ba0`, restored here.
- **Honest gap:** M2 itself (the current implementation) was built from a written contract and hand-written briefs in `docs/handoffs/m2/`, not from Kiro spec files. Do not call those Kiro specs.
- **Plan:** every M2.x chunk runs through Kiro's Spec workflow (`.kiro/specs/README.md` has the order and the properties to request), so the repository ends with seven or eight more real specs linked to PRD IDs.
- **Spec versus vibe coding (fill in with real numbers after the chunks):** compare one chunk built from a spec with one built by direct prompting, using the same checks: defects found by the audit flows, rework count, time to a green gate.

### 4.3 Hooks

| Hook | Trigger | What it does | Evidence so far |
|---|---|---|---|
| `task-completion-review` | PostTaskExec (agent) | After a spec task, check acceptance criteria and report exact commands | Exists since M0. No event recorded: no spec task has run since the reset |
| `guard-writes` | PreToolUse on file writes (command) | Blocks credentials, `.kiro` in `.gitignore`, `eval` and `new Function` in source, and edits to central files from a worktree | **Fired live on 2026-11-26** in the session that created it. It blocked an edit that contained a fake token. The block is in `.kiro/evidence/` with the session id and no secret. 9 script tests pass (`npm run test:hooks`) |
| `session-brief` | SessionStart (command) | Prints branch, uncommitted count, latest commits and the current focus from `docs/MILESTONE.md` | Script output checked by hand. Not yet seen at a real session start |
| `typecheck-on-stop` | Stop (command) | After a turn that changed `apps`, `packages` or `tests`, runs the type check and reports errors to the agent | Failure path checked with a planted type error (exit 1 with the error text). Not yet seen after a real turn |

Each hook logs its notable events (a block, a type-check pass or fail, a session brief) to `.kiro/evidence/hooks-<folder>.jsonl`. The log holds the hook name, outcome, rule and repository-relative path, never file content. It is committed, so the evidence builds up without any manual step.

### 4.4 Custom agents

`.kiro/agents/` holds three agents that codify roles already used in the M1 and M2 builds:

- `orchestrator`: the four-phase orchestration prompt. Loads the workflow, the contract and the last handoff. Denies push, hard reset and clean.
- `slice-builder`: one slice inside one worktree. Cannot write central files, cannot merge or push.
- `reviewer`: read-only. Audits a diff against the contract, security rules, tests and accessibility.

Honest status: written, not yet used in a session. The M1 and M2 orchestration was driven by a long pasted prompt (it is still the header of `docs/MILESTONE.md`); these agents replace the pasting. Use them from the next session (agent picker in the chat header) and record how the permission rules behaved. The effect to measure is the removal of the pasted prompt and the number of out-of-scope edits that were stopped.

### 4.5 MCP

- Configured: GitHub MCP in `.kiro/settings/mcp.json`. Not used so far.
- The product's MCP server (M3) is a feature of GhostStack, not development tooling. Keep the two stories separate in the write-up.
- Candidate for development: a Playwright MCP server so the IDE agent can drive the app. This work used the Playwright CLI skill instead. Add an MCP server only if it will be used, and explain what it enabled.
- Product MCP, verified 2026-11-27: the Kiro agent acted as an external agent through the MCP SDK stdio client (`tests/e2e/m3-mcp-build-app.spec.ts`). It read the live Stack, proposed an inventory app as one plan, and the plan waited until it was approved in the editor. The app then ran in preview and as a web export from `file://`. That run found that the existing MCP spec never approved a proposal through the UI, and that proposals are listed on the Assistant tab, not the Provider tab where pairing happens.

### 4.5.1 What the live provider run found

Mock-server tests passed, but the first real OpenRouter run produced no usable plan. The agent traced it with a temporary probe that recorded the model output and the plan check result (the key was never printed). There were three gaps, each fixed with a regression test:

1. The plan JSON schema dropped every behavior action branch, which left an empty `oneOf` that OpenAI-style servers reject. A test now fails on any empty `oneOf` and checks that every action type survives.
2. JSON mode alone let the model write `command` as a string and leave out required element properties. Structured output is now on for OpenRouter, and the prompt lists the properties of each element type, generated from the element schemas.
3. The model left out empty defaults (`behaviors`, `conditions`, `enabled`, ids) and created buttons before the Cards they link to. The output normalizer fills only empty data and moves Card creation first. The dry run and the approval gate still check every step.

### 4.6 Property-based testing

`fast-check` properties live next to the code (list in `.kiro/steering/property-testing.md`). Areas covered: GhostScript round trip, runtime safety, layout identity, z-order permutation, resize geometry, undo and redo, `.gsp` round trip. The restored spec also holds Kiro's recorded results (24 passed).

### 4.7 What property testing actually found

1. **Card ids and `.gsp` export.** A round-trip property over arbitrary card ids failed. fast-check shrank it to the card id `\ ` (a backslash and a space). The domain accepts any non-empty card id, but `exportGsp` correctly refuses it ("Unsafe archive entry name") because the id becomes a ZIP entry name. Nothing is corrupted and the UI only creates UUID ids, so users cannot hit it today. It matters for M3: AI or MCP proposals are untrusted and could create such ids. During M2 the generator was narrowed to safe ids without diagnosing the cause. It was diagnosed on 2026-11-26 and is recorded as an open item (`docs/AUDIT-M2.md` section 9, item 10; M2.8). Fix: reject path-unsafe ids at the domain boundary and keep a property test for it.
2. **Negative zero in GhostScript.** A generated number literal `-0` prints as `0`, so the round trip does not preserve the sign. Judged harmless, so the test normalizes it. This is a decision, not a fix; it is recorded so it is not mistaken for a passing property.

Do not claim more than this. If later chunks find more, add them with the shrunk counterexample.

### 4.8 Powers and skills

- **Powers:** none installed. Do not claim any.
- **Skills (user level, not in the repository):** antislop (UI quality), caveman (terse replies), Playwright CLI (browser flows), lean-build, safe-refactor and others were available to the agent. The owner's orchestration prompt invokes them. They are outside `.kiro/`, so judges cannot see them; describe them in the write-up as workflow aids.
- **Stretch:** package the GhostStack orchestration workflow as a Kiro power (`POWER.md` plus the steering and agent files) so other projects can reuse it. Only if time allows.

## 5. Evidence: what is automatic and what is manual

**Automatic (nothing for you to do):**
- Hook events are logged by the hooks themselves into `.kiro/evidence/`. One real block is already recorded.
- `npm run evidence` regenerates `docs/KIRO-EVIDENCE.md`: configuration inventory, spec progress and property-test results, hook event counts, recent blocks, commits that touched `.kiro/`.
- Git history already tells the build story (merge commits per slice, commits per chunk). Name the spec or chunk in each commit message so the log reads well.

**Done by the agent at the end of each session (ask for it by name):** "update Kiro usage": run `npm run evidence`, then update sections 4.2 to 4.4 here with what actually happened (which hooks fired, which agent ran, which spec phases were completed).

**Manual, only you can do it (the agent cannot see your IDE): about five screenshots.** Save them in `docs/kiro-screenshots/` with the file names in that folder's README, and tell the agent so the write-up can reference them.

| # | Screenshot | When |
|---|---|---|
| 1 | The agent picker open, showing `orchestrator`, `slice-builder` and `reviewer` | Next session start |
| 2 | A spec phase review (requirements, design or tasks) with comments, for at least one M2.x chunk | When the first spec runs |
| 3 | A spec task list with tasks checked off by Kiro | After the first spec run |
| 4 | A hook card in the IDE (`guard-writes` blocking, or `typecheck-on-stop` reporting) | The first time one appears |
| 5 | A property test failing with its shrunk counterexample, then passing | If one fails again; the card-id finding is the fallback story |

Skipping screenshots is acceptable. The generated report and the committed logs are the main evidence, and screenshots are the easy extra.

## 6. Suggested write-up outline (keep it short and factual)

1. **Approach in one paragraph:** documents define intent, steering carries the rules, specs structure each chunk, worktree agents are bound by a contract, hooks guard and verify, tests prove.
2. **Resurrection angle:** HyperCard's idea (cards, stacks, scripts anyone could write) rebuilt as a local-first editor with a safe behavior language, and Kiro used to rebuild it with structure instead of ad hoc prompting.
3. **Specs:** how a chunk went from requirements to tasks, what the property tests caught, what changed versus prompting directly.
4. **Steering:** the four inclusion modes and why; the contract strategy and its measured effect.
5. **Hooks and agents:** the four hooks, the three agents, one concrete catch each (the logged `guard-writes` block is the first).
6. **MCP and powers:** state plainly what was and was not used.
7. **Property tests:** the finding in section 4.7 with its counterexample.
8. **Surfaces:** IDE primary; mention the CLI only if it was actually used (section 3).
9. **What did not work:** the Playwright dev server dropping, hand-written briefs instead of specs, stale steering. Honesty here is credible.

## 7. Open items

1. Confirm what other Kiro surfaces were used before this repository (CLI, Web, Crew) for section 3. If none, the IDE-only answer stands.
2. Decide whether to run the `reviewer` agent once from the CLI (section 3). Optional.
3. Run the next session with the new agents, then update sections 4.3 and 4.4 with real observations and take screenshots 1 to 4.
4. When the first M2.x spec finishes, record its numbers for the spec-versus-direct-prompting comparison in section 4.2.
