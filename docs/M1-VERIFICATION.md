# M1 Verification Report

Status: **partial**. Automated toolchain checks ran and exited 0 (section 2 for the clean-copy run, section 11.4 for the re-run after the service worker was added). Agent-run Chromium checks (sections 11.2 and 11.4) ran. The owner confirmed on 2026-11-16 that all 12 manual steps in section 11.1 were run and behaved as expected, with no per-step notes. M1 closure is decided in task 15.3 and is not stated here.

Run date: 2026-11-15 (UTC, system clock; the run finished near 19:16Z).
Environment: Linux, Node.js v24.22.1, npm 11.19.1.
Run by: coding agent (task 15.1 of `.kiro/specs/m1-foundation`).

## 1. How the clean checkout was made

A true clean checkout was **Not_Available**: the M1 work is uncommitted and untracked (`git status` shows `apps/`, `packages/`, root config files, `LICENSE` and `.kiro/specs/m1-foundation/` as untracked, and `ARCHITECTURE.md` as modified). Nothing was committed or stashed.

Equivalent used: a copy of the working tree without `node_modules`, `dist` and `.git`.

```
T=$(mktemp -d /tmp/ghoststack-verify.XXXXXX)   # /tmp/ghoststack-verify.AcwPTV
rsync -a --exclude node_modules --exclude dist --exclude .git ./ $T/
```

All `npm` commands below ran inside that directory. Git-based checks (sections 5 to 8) ran in the real repository, because the copy has no `.git`. No user file was changed or deleted. The temporary directory was left in place.

## 2. Toolchain checks (clean copy)

Commands ran in this order. Exit codes were read from the shell.

| #   | Command                | Exit code | Result                                                                                                           |
| --- | ---------------------- | --------- | ---------------------------------------------------------------------------------------------------------------- |
| 1   | `npm ci`               | 0         | `added 238 packages, and audited 243 packages`. Reports 7 moderate vulnerabilities (see section 9).              |
| 2   | `npm run lint`         | 0         | `eslint . --max-warnings=0`, no output.                                                                          |
| 3   | `npm run format:check` | 0         | `prettier --check .`                                                                                             |
| 4   | `npm run typecheck`    | 0         | `npm run typecheck --workspaces --if-present`                                                                    |
| 5   | `npm run test`         | 0         | Vitest v5.1.0: **59 test files passed (59), 513 tests passed (513)**.                                            |
| 6   | `npm run build`        | 0         | `tsc --noEmit -p . && vite build`; Vite v8.3.8, 145 modules transformed, built in 209 ms. Output sizes below.    |
| 7   | `npm run preview`      | not run   | Long-running. It was started for the agent-run browser check (section 11.2) and stopped afterwards.                                                |
| -   | `npm run dev`          | not run   | Long-running. Not started by the agent.                                                                          |

Build output (`apps/web/dist`, from the clean copy):

| File                                      | Size      |
| ----------------------------------------- | --------- |
| `index.html`                              | 0.39 kB   |
| `assets/index-*.css`                      | 6.52 kB   |
| `assets/index-*.js`                       | 341.36 kB |
| `assets/inter-latin-400-normal-*.woff2`   | 23.66 kB  |
| `assets/inter-latin-600-normal-*.woff2`   | 24.45 kB  |
| `assets/jetbrains-mono-latin-400-*.woff2` | 21.16 kB  |
| matching `.woff` fallbacks (3 files)      | 27.49 to 31.26 kB each |

Gzip: JS 104.30 kB, CSS 1.68 kB.

## 3. Per-package results

Each command ran in the clean copy.

| Package                      | `npm run typecheck -w <name>` | `npm run test -- packages/<dir>`  | React or DOM libraries in `package.json` |
| ---------------------------- | ----------------------------- | --------------------------------- | ---------------------------------------- |
| `@ghoststack/domain`         | exit 0                        | exit 0, 16 files, 125 tests passed | none (`dependencies`: `zod`)             |
| `@ghoststack/storage`        | exit 0                        | exit 0, 7 files, 103 tests passed  | none (`@ghoststack/domain`, `idb`, `fake-indexeddb`) |
| `@ghoststack/project-format` | exit 0                        | exit 0, 20 files, 184 tests passed | none (`@ghoststack/domain`, `fflate`, `zod`, `@ghoststack/storage`) |

The manifest check used `node -e` to list `dependencies`, `devDependencies` and `peerDependencies` and filter for `react`, `react-dom`, `jsdom`, `happy-dom` and `@testing-library/*`. `idb` and `fake-indexeddb` are IndexedDB libraries used by the storage package; they are not React or DOM rendering libraries.

Non-DOM environment, read from files:

- `vitest.config.ts` sets `environment: 'node'` for the `domain`, `project-format` and `storage` projects. Only `apps/web/vite.config.ts` is a separate project.
- Each package `tsconfig.json` sets `"lib": ["ES2023", "WebWorker"]` and `"types": []`, which excludes the DOM lib.
- Typecheck for all three packages exited 0 under those settings.

Counts for the remaining 16 files and 101 tests are derived (513 minus 412 and 59 minus 43). They belong to `apps/web` and were not run as a separate command.

## 4. Time-zone variants (project-format)

The design lists time-zone determinism for the ZIP `mtime` (design.md, "Determinism across time zones"). Each command ran in the clean copy.

| Command                                                       | Exit code | Result                          |
| ------------------------------------------------------------- | --------- | ------------------------------- |
| `TZ=America/Los_Angeles npm run test -- packages/project-format` | 0      | 20 files, 184 tests passed      |
| `TZ=UTC npm run test -- packages/project-format`              | 0         | 20 files, 184 tests passed      |
| `TZ=Pacific/Auckland npm run test -- packages/project-format` | 0         | 20 files, 184 tests passed      |

## 5. Forbidden-code search

Baseline commit: `d572847` (`chore: add project documents, Kiro configuration, and M0 audit`). The M1 code is untracked, so `git grep` ran with `--no-index`.

```
git diff --name-only d572847
git grep --no-index -nEi "openai|ollama|mcp|playwright|eval\(|new Function|innerHTML" -- apps packages ':!**/node_modules/**' ':!**/dist/**'
```

- `git diff --name-only d572847` lists one tracked file: `ARCHITECTURE.md`.
- The `git grep` found matches only in `apps/web/src/boundaries.test.ts` (lines 109, 112, 113, 122, 125). They are test code that asserts the web sources contain no `eval`, `new Function` or injected HTML, plus a sample string that the test scans. No application source matched.
- No match for `openai`, `ollama`, `mcp` or `playwright` in `apps` or `packages`.

## 6. Secret scan

No dedicated secret scanner is installed. This is a **pattern scan, not a scanner**, using the patterns from the design.

```
git grep --no-index -nEI 'AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{36}|-----BEGIN .*PRIVATE KEY-----|(api|secret)[_-]?key\s*[:=]' -- . ':!package-lock.json' ':!**/node_modules/**' ':!**/dist/**'
grep -rEI '<same pattern>' apps/web/dist      # clean-copy build output
```

- Source scan: one match, `.kiro/specs/m1-foundation/design.md:1227`, which is the design text quoting the patterns. No credential found.
- Build output scan: no match (grep exit 1).
- `package-lock.json` was excluded from the source scan because it holds integrity hashes. It was not scanned.

Build-output URL scan (`grep -rEoI 'https?://...' apps/web/dist`): the only URLs are in the bundled JavaScript (`index-*.js`): XML and SVG namespace strings (`www.w3.org`), JSON Schema URIs (`json-schema.org`) and a React error-page URL (`react.dev/errors/`). Zero hits in the HTML and CSS. This scan does not prove that the running app makes no network request. That is owner step 5 in section 11.1.

## 7. Diff review

Compared with `d572847`:

- Modified tracked file: `ARCHITECTURE.md` (`219 insertions(+), 23 deletions(-)`). Task 15.3 and the design table in "Documentation and repository updates" assign this file to M1. Not reviewed line by line in this task.
- Untracked root files: `.prettierignore`, `.prettierrc.json`, `LICENSE`, `eslint.config.js`, `package-lock.json`, `package.json`, `tsconfig.base.json`, `vitest.config.ts`. These are the scaffold, license and toolchain files that the spec assigns to M1.
- Untracked directories: `apps/web`, `packages/domain`, `packages/storage`, `packages/project-format` (126 files; `package.json`, `tsconfig.json`, `index.html` and `vite.config.ts` plus sources) and `.kiro/specs/m1-foundation/`.
- Changed files not attributable to an M1 requirement: none found by name. A per-requirement mapping of every source file was **not performed**.
- `README.md`, `MILESTONE.md` and `CHANGELOG.md` are unchanged (task 15.3).
- `apps/web/dist` and `node_modules` exist in the real working tree; they are build artifacts and installs, and are not part of this review.

## 8. `.kiro/` and license evidence

- `git ls-files .kiro | wc -l` printed `8`: eight tracked files, for example `.kiro/hooks/task-completion-review.json`, `.kiro/settings/mcp.json` and `.kiro/specs/README.md`.
- `git check-ignore -v .kiro/specs/m1-foundation/tasks.md` printed nothing and exited 1, so the path is not ignored.
- `.kiro/specs/m1-foundation/` is untracked, not ignored. It needs `git add` at commit time.
- `sha256sum LICENSE`: `c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4` (11357 bytes, 201 lines, first lines read "Apache License / Version 2.0, January 2004").
- Comparison with a fresh fetch of `https://www.apache.org/licenses/LICENSE-2.0.txt`: **Not_Available**. `curl --max-time 30` failed with exit 28 (connection timed out), so the hash above is not compared against the upstream text in this run.
- Root `package.json` declares `"license": "Apache-2.0"`. It parsed as valid JSON because `npm ci` and all scripts read it.

## 9. Skipped, failed and Not_Available checks

| Check                                      | Status        | Reason                                                                                                                      |
| ------------------------------------------ | ------------- | --------------------------------------------------------------------------------------------------------------------------- |
| True clean checkout (`git worktree` or clone) | Not_Available | M1 work is uncommitted and untracked. The file-copy equivalent in section 1 was used.                                       |
| `npm run dev`                              | Not run       | Long-running; belongs to the manual check.                                                                                  |
| `npm run preview`                          | Not run       | Long-running; belongs to the manual check.                                                                                  |
| Owner-run manual browser steps 1 to 12     | Owner-confirmed | Owner confirmed all 12 steps ran and behaved as expected on 2026-11-16. No browser name, version or per-step notes were supplied. See section 11.1. |
| LICENSE comparison against a second fetch  | Not_Available | Network request timed out (curl exit 28).                                                                                   |
| End-to-end tests                           | Not_Available | None exist in M1.                                                                                                           |
| Playwright                                 | Not_Available | Not part of M1.                                                                                                             |
| CI                                         | Not_Available | No CI configured in M1.                                                                                                     |
| Per-requirement diff attribution           | Not run       | Only file-level review was done.                                                                                            |
| `npm audit`                                | Reports issues | `npm audit` reports 7 moderate vulnerabilities, all in the `typescript-eslint` / `@typescript-eslint/*` dev dependency chain (versions up to 8.72.2). `npm audit fix --force` was not run. No decision recorded. The owner should review. |

## 10. M1 exit criteria (`MILESTONE.md`)

| Exit criterion                                          | Status                                    | Evidence                                                                                                       |
| ------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Application runs in a modern desktop browser            | Owner-confirmed (no browser or version supplied) | Owner step 1 confirmed 2026-11-16 (agent-run Chromium result: sections 11.2 and 11.4). `npm run build` exit 0 shows that a production bundle builds.                            |
| A Stack can be created and persisted                    | Automated tests passed; manual owner-confirmed | `npm run test` exit 0 (513 tests, includes web component tests and storage tests). Owner steps 2 and 3 confirmed 2026-11-16 without notes. |
| A project can be loaded after a browser reload          | Automated tests passed; manual owner-confirmed | Same test run (reload is simulated over memory storage and `fake-indexeddb`). Owner steps 3 and 4 confirmed 2026-11-16 without notes. |
| Shared domain types are usable independently of React   | Passed (automated)                        | Section 3: no React or DOM libraries in the three package manifests; `node` test environment; typecheck exit 0 without the DOM lib. |
| Lint, type check, tests and build work                  | Passed                                    | Section 2, commands 2 to 6, all exit 0.                                                                        |
| The project format has a tested initial round-trip      | Passed (automated)                        | `npm run test -- packages/project-format` exit 0, 184 tests; also under three `TZ` values (section 4).          |

"Passed (automated)" means an observed exit code of 0 for the listed command. It does not cover the manual checks.

## 11. Manual browser checks

Two kinds of evidence live here. Keep them apart.

- **11.1 Owner-run checks.** A person runs each step in a real browser and reports the result. A coding agent must not fill these cells. On 2026-11-16 the owner reported all 12 steps as run and as behaving as expected. Every row records that report and nothing more.
- **11.2 and 11.4 Agent-run browser checks.** A coding agent drove headless Chromium with `playwright-cli`. They show what the build did in one automated browser. It is not the owner's check, it does not use a normal browser profile, and it cannot judge how something looks.

### 11.1 Owner-run checks

#### Setup

1. Run `npm ci` if `node_modules` is missing.
2. Run `npm run build`.
3. Run `npm run preview` and leave it running. Vite prints a local URL, normally `http://localhost:4173/`.
4. Open that URL in a desktop browser with a fresh profile or a private window, and open DevTools (F12).
5. Note the browser name and version (for example Help > About) and write it in the table below.
6. Stop the preview server with Ctrl+C when you finish.

Use a title you can recognise exactly, for example `Owner Check Stack 1`. Step 3 compares the title character by character.
The steps below were written before the service worker (section 11.4) existed. The report does not record whether the owner's build included it.

#### Result vocabulary

Write one of: `Pass`, `Fail`, `Not run`, `Not applicable`. Add one line of observation for every `Fail`. Leave `Not run` where you did not try the step.

#### Steps

Steps 1 to 9 come from the design ("Manual verification"). Steps 10 to 12 are additions that cover the 200% zoom, the persistence failure state and the external-host check.

- [ ] **Step 1. Start and console.** Load the page. Wait 5 seconds. In the DevTools Console, filter to Errors.
  Pass: no entry at error level. (Requirements 1.6, 1.9)
  Note: the agent saw one error on its first load, a 404 for `/favicon.ico`. A local favicon has since been added (section 11.3, finding 1). Report any error you see.
- [ ] **Step 2. Create.** Type your known title into "Stack title" and select "Create Project".
  Pass: the workspace opens, shows exactly that title and lists one card ("Card 1"), and the status reads "Saved".
- [ ] **Step 3. Reload.** Press F5 (or Ctrl+R). Do not clear site data.
  Pass: the Project Library lists the Stack with exactly the title from step 2. (Requirement 16.4)
  To confirm the data sits in real IndexedDB: DevTools > Application (Chrome, Edge) or Storage (Firefox) > IndexedDB > `ghoststack`. A `stacks` store should hold one record.
- [ ] **Step 4. Open.** Select the Stack in the library.
  Pass: the workspace shows the saved title and "Card 1".
- [ ] **Step 5. Offline.** With the page loaded, open DevTools > Network and set throttling to Offline (Chrome, Edge) or select "Work Offline" (Firefox). Do not reload the page. Create a second Stack with a new title, return to the library, then open it.
  Pass: the second Stack is created, listed and opens, and the Network tab shows no failed request from the application. (Requirement 1.10)
  Expected limit as originally written, before the service worker of section 11.4 was added: M1 has no service worker, so a **reload while offline fails** with a browser error page. The design text for step 5 says "repeat steps 2 to 4", which includes the reload in step 3. Reload offline is therefore expected to fail in M1. Record what you see and do not treat that alone as an application defect. The owner decides whether the design text needs changing.
- [ ] **Step 6. Horizontal scroll.** Go back online. For each viewport width 1024, 1280 and 3840 px, in both the library and an open workspace, check that the page has no horizontal scrollbar. Use DevTools device mode (Ctrl+Shift+M) and enter the width, or resize the window. Record one result per width.
  Pass: no horizontal page scroll at any of the three widths. Check by eye and, if you want a number, run `document.documentElement.scrollWidth <= document.documentElement.clientWidth` in the Console (expect `true`). (Requirements 13.10, 14.5)
- [ ] **Step 7. Blocked fonts.** In DevTools > Network, right-click a `.woff2` request and choose Block request URL (Chrome, Edge), or add a request-blocking pattern for `*.woff2` and `*.woff`. Hard-reload (Ctrl+Shift+R).
  Pass: text still shows in a fallback font, with no overlapping or clipped text. (Requirement 14.5)
- [ ] **Step 8. Focus ring.** Click the page background, then press Tab repeatedly through the library, then through the workspace.
  Pass: every control that receives focus shows a visible ring (2 px orange outline expected). Disabled buttons are skipped by design. (Requirement 13.9)
  To read the style: select the focused element in DevTools > Elements, open Computed, and check `outline`. Expect `2px solid` in `rgb(255, 107, 43)`.
- [ ] **Step 9. Open time.** Select a Stack in the library and judge how long it takes the workspace to appear.
  Pass: it feels immediate. Write what you saw (for example "instant" or "about 1 s"). The 2-second bound is recorded as observed. A test does not assert it. (Requirements 12.2, 12.5)
- [ ] **Step 10. 200% zoom.** Set browser zoom to 200% (Ctrl and + until the indicator reads 200%) at a window about 1280 px wide. Check the library and an open workspace.
  Pass: no clipped text, no controls hidden or unreachable, no horizontal page scroll.
- [ ] **Step 11. Persistence failure state.** Make IndexedDB unavailable, then load the page. Firefox: open a Private Window, which blocks IndexedDB in some versions. Chrome and Edge: block site data for `localhost` under Settings > Privacy > Site settings, then reload. Try "Create Project".
  Pass: the library shows a visible message that projects cannot be saved, and create reports that the stack was not saved. No blank page and no uncaught error in the Console. Mark `Not applicable` if your browser has no way to block IndexedDB.
- [ ] **Step 12. External hosts.** Clear the Network tab, hard-reload, and read the Domain or Host column for every request.
  Pass: every request goes to the preview host (`localhost`). No request goes to `fonts.googleapis.com`, `fonts.gstatic.com`, a CDN or any other host. (Requirements 1.10, 14.3)

#### Owner results

| Step | Description               | Status  | Browser and version | Observation |
| ---- | ------------------------- | ------- | ------------------- | ----------- |
| 1    | Start, console errors     | Owner-confirmed, no per-step notes supplied | Not_Available (not supplied) | None supplied |
| 2    | Create Stack, one Card    | Owner-confirmed, no per-step notes supplied | Not_Available (not supplied) | None supplied |
| 3    | Reload, library lists it  | Owner-confirmed, no per-step notes supplied | Not_Available (not supplied) | None supplied |
| 4    | Open, title and Card      | Owner-confirmed, no per-step notes supplied | Not_Available (not supplied) | None supplied |
| 5    | Offline create and open   | Owner-confirmed, no per-step notes supplied | Not_Available (not supplied) | None supplied |
| 6    | No horizontal scroll, 1024 px | Owner-confirmed, no per-step notes supplied | Not_Available (not supplied) | None supplied |
| 6    | No horizontal scroll, 1280 px | Owner-confirmed, no per-step notes supplied | Not_Available (not supplied) | None supplied |
| 6    | No horizontal scroll, 3840 px | Owner-confirmed, no per-step notes supplied | Not_Available (not supplied) | None supplied |
| 7    | Blocked fonts             | Owner-confirmed, no per-step notes supplied | Not_Available (not supplied) | None supplied |
| 8    | Tab focus ring            | Owner-confirmed, no per-step notes supplied | Not_Available (not supplied) | None supplied |
| 9    | Open time                 | Owner-confirmed, no per-step notes supplied | Not_Available (not supplied) | None supplied |
| 10   | 200% zoom                 | Owner-confirmed, no per-step notes supplied | Not_Available (not supplied) | None supplied |
| 11   | Persistence failure state | Owner-confirmed, no per-step notes supplied | Not_Available (not supplied) | None supplied |
| 12   | External hosts            | Owner-confirmed, no per-step notes supplied | Not_Available (not supplied) | None supplied |

Report date: 2026-11-16. The owner reported through the coding session that they ran all 12 steps and that all behaved as expected. Owner name, browser name and version, and any per-step observation were not supplied and are not recorded here. Per-step Pass and Fail values were not supplied either, so the table does not use the `Pass` vocabulary.

Whether this report closes M1 is decided in task 15.3.

### 11.2 Agent-run browser check (Chromium, headless)

This section records what an agent observed. It is not the owner's result and it does not change any status in section 11.1.

- Run date: 2026-11-15 (UTC, system clock).
- Browser: HeadlessChrome 155.0.0.0 on Linux, from `playwright-cli` 0.1.22 (user agent string `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/155.0.0.0 Safari/537.36`).
- Build: `npm run build` in the real working tree, exit 0 (same bundle names as section 2: `index-Cw4t3Xn5.js`, `index-BH7IbhpU.css`).
- Server: `npm run preview -w @ghoststack/web -- --port 4173 --strictPort`, then stopped after the run. Page URL `http://localhost:4173/`.
- Profile: in-memory, so IndexedDB started empty and was discarded at close.
- Scripts used `page.evaluate` for measurements and `page.reload()` for reloads. The scripts are not kept in the repository.

| #   | Check                                         | Observation                                                                                                                                                                                                                                                                                                                                       | Maps to owner step |
| --- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| A1  | Console on first load                         | **1 error**: `Failed to load resource: the server responded with a status of 404 (Not Found) @ http://localhost:4173/favicon.ico`. A second load, with a listener attached before navigation and a 5 s wait, logged 0 error-level entries (the browser did not request the favicon again). Fixed after this run by adding `/favicon.svg` (section 11.3, finding 1). | 1                  |
| A2  | Create Stack                                  | Typed `Agent Check Stack 7`, selected "Create Project". Workspace showed `h2` "Agent Check Stack 7", status "Saved", card list with one item "Card 1".                                                                                                                                                                                              | 2                  |
| A3  | Real IndexedDB                                | `indexedDB.databases()` returned `ghoststack@1`.                                                                                                                                                                                                                                                                                                  | 3                  |
| A4  | Reload persistence                            | After `page.reload()` the library listed `Agent Check Stack 7` with "Modified Nov 16, 2026, 2:18 AM" and "Last opened". The title matched exactly. The reload landed in the library, as the design describes.                                                                                                                                     | 3                  |
| A5  | Open after reload                             | Selecting the row opened the workspace with `Agent Check Stack 7` and `Card 1`.                                                                                                                                                                                                                                                                    | 4                  |
| A6  | Network requests, external hosts              | Over two page loads, every request URL started with `http://localhost:4173/`: the document, `index-Cw4t3Xn5.js`, `index-BH7IbhpU.css`, `inter-latin-400-normal-C38fXH4l.woff2`, `inter-latin-600-normal-LgqL8muc.woff2`. **No external host.** JetBrains Mono was not requested on the library or workspace views (font status `unloaded`).     | 12                 |
| A7  | Scroll width, 1024 px                         | Workspace: `scrollWidth` 1024, `clientWidth` 1024. Library: 1024 and 1024. No horizontal overflow.                                                                                                                                                                                                                                                 | 6                  |
| A8  | Scroll width, 1280 px                         | Workspace: 1280 and 1280. Library: 1280 and 1280. No horizontal overflow.                                                                                                                                                                                                                                                                          | 6                  |
| A9  | Scroll width, 3840 px                         | Workspace: 3840 and 3840. Library: 3840 and 3840. No horizontal overflow. (Viewport height was 900 px; layout at 3840 px was not judged by eye.)                                                                                                                                                                                                    | 6                  |
| A10 | Focus ring, computed style                    | `:focus-visible` rule in the bundled CSS: `.gs-editor :focus-visible { outline: 2px solid var(--gs-color-accent-primary); outline-offset: 2px; }`. Computed on every focused control (title input, "Create Project", project row, "Return to Project Library"): `outline-style: solid`, `outline-width: 2px`, `outline-color: rgb(255, 107, 43)`, `outline-offset: 2px`. Disabled buttons were skipped. Contrast of `#ff6b2b` against base `#111017` is 6.66:1 and against panel `#191724` is 6.21:1 (`contrast-check.py`), above the 3:1 bar for non-text. The ring was read from computed style. Nobody looked at a screenshot of it. | 8                  |
| A11 | Tab order                                     | Library: title input, "Create Project", the project row, then focus left the page. Workspace: "Return to Project Library" was the only tabbable control (the toolbox, canvas and inspector are placeholders).                                                                                                                                        | 8                  |
| A12 | Offline, create and open                      | After the fonts had loaded, the context was set offline without reloading. Creating `Offline Stack 9`, returning to the library and opening it all worked. The library listed three Stacks. `requestfailed` fired for **0** requests.                                                                                                              | 5                  |
| A13 | Offline reload                                | `page.reload()` while offline failed with `net::ERR_INTERNET_DISCONNECTED`. M1 had no service worker at that time. This conflicted with the wording of design step 5 (see owner step 5). Superseded by section 11.4.                                                                                                                                                                         | 5                  |
| A14 | Offline before fonts finished loading (first attempt) | In a first, less careful run the context went offline before the Inter files had been requested. Four font requests failed with `net::ERR_FAILED` and the console showed four matching errors. Text still rendered. This is a test-order effect, not a separate defect, and it shows that going offline right after load can fail font requests. | 5, 7               |
| A15 | Blocked fonts                                 | With `**/*.woff2` and `**/*.woff` aborted, the library and `document.fonts` showed `Inter 400 error`, `Inter 600 error`, `JetBrains Mono 400 unloaded`. The page still showed 328 characters of text and `scrollWidth` equal to `clientWidth` (1280). Computed `font-family` fell back to `Inter, system-ui, -apple-system, "Segoe UI", sans-serif`. A screenshot was saved to a temporary path and not reviewed or kept. Overlap was not judged. | 7                  |
| A16 | 200% zoom (approximation)                     | Not a real zoom. Viewports of 512 px and 640 px wide (about 200% of 1024 and 1280) were used. Library and workspace both had `scrollWidth` equal to `clientWidth`. Text clipping was not judged.                                                                                                                                                   | 10                 |
| A17 | Persistence failure state                     | A second page with `window.indexedDB` set to `undefined` before load showed an alert (`role="alert"`): "Projects cannot be saved in this browser session." No console error or page error was logged. After "Create Project" a second alert appeared: "Error: The stack was not saved. Browser storage could not be opened." This simulates a missing IndexedDB, not a quota or private-mode failure. | 11                 |
| A18 | Open time                                     | Click on the project row to the "Card canvas" heading visible: **82 ms** (one measurement, `Date.now()` around the click and the wait, headless Chromium).                                                                                                                                                                                         | 9                  |

Limits of this check:

- One headless Chromium, no Firefox or Safari, no real display, no real GPU.
- Offline mode was emulated by the automation, not by turning off a network.
- Layout was measured, not viewed. Claims about overlap, clipping and appearance stay with the owner.
- A17 replaced `indexedDB` in the page. It does not exercise a real private-browsing failure.

### 11.3 Findings from the agent run

These came out of the agent run. Finding 1 was fixed afterwards. Finding 2 was resolved on 2026-11-16 by the service worker (section 11.4). Finding 3 was partly re-tested (see its entry).

1. **`/favicon.ico` returned 404 on first load. Fixed and re-verified.** The 404 logged an error-level console entry that could fail owner step 1. Fix: `apps/web/public/favicon.svg` (local SVG, `#111017` background, `#ff6b2b` ghost glyph) and `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />` in `apps/web/index.html`. Re-verification: `npm run build`, then `npm run preview` and `playwright-cli` on a fresh browser. First load plus a 5 s wait logged 0 messages (0 errors, 0 warnings), and `/favicon.svg` returned 200 `image/svg+xml`. The preview server was stopped afterwards.
2. **Design step 5 asks for a reload while offline. Resolved on 2026-11-16.** At the time of the run M1 had no service worker, and observation A13 shows the offline reload failing. The owner approved a service worker (`ARCHITECTURE.md` T-027). In the production build, an offline reload now renders the Project Library and lists stored Stacks, with zero failed requests and zero console messages (section 11.4, checks B2 to B6). The design wording now says the reload is supported offline. Evidence is from one headless Chromium run, not from the owner's browser.
3. **Going offline immediately after load can fail font requests.** Fonts load lazily, so a font request can start after the network is gone. The request fails, text falls back to the system font, and the console logs an error. Wait for the fonts to load before switching offline, or accept the entry.
   Re-test on 2026-11-16, after the service worker: partly re-tested. On a page controlled by the worker and offline, the JetBrains Mono font had never been requested (`unloaded`). `document.fonts.load('400 16px "JetBrains Mono"')` then loaded it, and a `fetch` of each of the six font files returned 200 with the expected byte lengths (section 11.4, B4 and B5). Not re-tested: going offline immediately after the very first visit. The worker does not call `clients.claim()`, so by its code the first page load is not controlled by it. That case was not run.
### 11.4 Agent-run offline reload check (service worker, Chromium, headless)
This section records what an agent observed after the service worker was added (task 15.2, 2026-11-16, owner-approved, `ARCHITECTURE.md` T-027). It is not the owner's result.
- Run date: 2026-11-16 (UTC, system clock).
- Browser: HeadlessChrome 155.0.0.0 on Linux, `playwright-cli`. One browser, in-memory profile, offline mode emulated with the Playwright context (`setOffline`).
- Build: `npm run build`, exit 0. Server: `npm run preview -- --port 4173 --strictPort`, stopped after the run. The `.playwright-cli` folder created by the run was deleted.
- Scripts used `page.evaluate`, `page.reload()` and Playwright event listeners (`requestfailed`, `console`, `pageerror`, `response`). They are not kept in the repository.
- Worker details are in `ARCHITECTURE.md` section 8.7. The built worker is `dist/sw.js`.
| #   | Check | Observation |
| --- | ----- | ----------- |
| B1  | Online first load | `navigator.serviceWorker.ready` resolved with scope `http://localhost:4173/`, script `http://localhost:4173/sw.js`, state `activated`. Cache `ghoststack-shell-77231e5e47d64ed3` held 10 entries: `/index.html`, `/favicon.svg`, `/assets/index-BCE1yDWW.js`, `/assets/index-BH7IbhpU.css` and the six font files (Inter 400 and 600, JetBrains Mono 400, each `.woff2` and `.woff`). |
| B2  | Offline reload | After one online reload (page controlled by the worker), a stack `Online Quiz` was created online. With the context offline, `page.reload()` loaded. `navigator.onLine` was `false`, `navigator.serviceWorker.controller` was set, and the page showed the "Project Library" heading. Listed responses were all `fromServiceWorker() === true` with status 200: `/`, `index-BH7IbhpU.css`, `index-BCE1yDWW.js`, `favicon.svg`, `inter-latin-400-normal-C38fXH4l.woff2`, `inter-latin-600-normal-LgqL8muc.woff2`. |
| B3  | IndexedDB data offline | `Online Quiz` was listed after the offline reload (1 match). It opened (heading `Online Quiz`, one "Cards" section). |
| B4  | Create offline | Still offline: "Return to Project Library", title `Offline Recipes`, "Create Project". The workspace opened with that heading. After returning to the library both `Online Quiz` and `Offline Recipes` were listed. A second offline reload listed both again. |
| B5  | Fonts offline | After the offline reload `document.fonts` reported `Inter 400 loaded` and `Inter 600 loaded`. `JetBrains Mono 400` was `unloaded` on the library and workspace views, as in A6. `document.fonts.load('400 16px "JetBrains Mono"')` then loaded it while offline. A `fetch` of all six font URLs from the page returned 200 with these byte lengths: Inter 400 `.woff2` 23664 and `.woff` 30696, Inter 600 `.woff2` 24452 and `.woff` 31260, JetBrains Mono `.woff2` 21168 and `.woff` 27496. |
| B6  | Failed requests and console | In the offline reload, the open, create and second reload steps, `requestfailed` fired 0 times. Console and page-error listeners recorded 0 entries. `playwright-cli console` reported `Total messages: 0 (Errors: 0, Warnings: 0)` for the session. |
| B7  | Update, first attempt (before the registration code called `update()`) | Build hash `77231e5e47d64ed3` was replaced by a build with a changed `<title>` (hash `4fe1532b39a4a33f`). The server returned the new `sw.js`. A plain `page.reload()` online, then 1.5 s of waiting, then a second reload left the old cache as the only cache and no `waiting` or `installing` worker. Calling `registration.update()` by hand then created `ghoststack-shell-4fe1532b39a4a33f` and removed the old cache. Result: the browser did not check for the update on navigation in that run, so `registerServiceWorker` now calls `registration.update()` after registering. |
| B8  | Update, with the explicit check | Fresh browser. Build A (hash `b7274b4fe23ed6e8`, title `GhostStack`): first load, one reload, page controlled, one cache `ghoststack-shell-b7274b4fe23ed6e8`. Then build B (hash `5aab85ae83a3c841`, title `GhostStack v2 test`) and an online reload. Immediately after that reload the page title was still `GhostStack` and the only cache was A. After 1.5 s the only cache was `ghoststack-shell-5aab85ae83a3c841` and the old cache was gone, with no `waiting` or `installing` worker and only one main-frame navigation recorded. The next reload showed the title `GhostStack v2 test`. |
| B9  | Offline on the new build | Offline `page.reload()` after B8 showed title `GhostStack v2 test` and the "Project Library" text, with 0 console messages. |
| B10 | Rebuild identity | `apps/web/index.html` was restored to its original content after B8. Rebuilding gave hash `b7274b4fe23ed6e8` again, the same as build A, so the hash depends on the file content. |
Limits of this check:
- One headless Chromium. Firefox, Safari and a non-headless profile were not run.
- First visit followed by an immediate offline reload was not run. B2 started after one extra online reload.
- B7 and B8 used `vite preview`, not a production host. HTTP cache headers on a real host were not checked. `sw.js` came back with `Cache-Control: no-cache` from `vite preview`.
- Mid-session behavior was observed only as "no navigation happened". A page left open across an update was not probed further.
- Automated tests do not prove browser behavior. They cover the registration function, the plugin helpers and the worker script run in a Node `vm` with an in-memory cache.
#### Commands after the service worker was added
Run in the working tree on 2026-11-16, in this order:
| Command | Exit code | Result |
| ------- | --------- | ------ |
| `npm run lint` | 0 | `eslint . --max-warnings=0`, no findings. |
| `npm run format:check` | 0 | `All matched files use Prettier code style!` |
| `npm run typecheck` | 0 | All workspaces. |
| `npm run test` (run 1) | 0 | 62 test files, 539 tests passed. |
| `npm run test` (run 2) | 0 | 62 test files, 539 tests passed. |
| `npm run test` (run 3) | 0 | 62 test files, 539 tests passed. |
| `npm run build` | 0 | Wrote `apps/web/dist/sw.js` with `GS_BUILD = "b7274b4fe23ed6e8"`. |
Section 2 and the 513-test count in section 10 describe the earlier clean-copy run and are not updated.
