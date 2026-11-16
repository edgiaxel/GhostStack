# Implementation Plan: M1 Foundation (VS-00)

## Overview

This plan implements `requirements.md` and `design.md` in this directory, in TypeScript. Order follows dependencies: owner approvals, repository scaffold and toolchain, `packages/domain`, `packages/storage`, `packages/project-format`, `apps/web` (theme, preferences, Project Library, Stack Workspace), documentation, then a final verification from a clean checkout.

Ground rules for every task:

- Scripts named below (`lint`, `format:check`, `typecheck`, `test`, `build`, `dev`, `preview`) do not exist until task 2.1 to 2.4 create them. A command is "verified" only after it was run and exited with code 0. Report exact commands and outcomes. Never claim a result that was not observed.
- Packages are consumed as source (`exports` points to `./src/index.ts`). Per-package type check: `npm run typecheck -w <package-name>`. Per-package tests: `npm run test -- <path>`.
- Out of scope: AI, MCP, behavior runtime, canvas editing, preview, standalone export, Playwright, CI, autosave, undo/redo, checkpoints.
- No task commits, pushes, opens PRs or deploys. Those need explicit owner authorization outside this plan.
- Add a dependency only in the task that needs it, and record its reason and cost per Requirement 2.8 in the dependency table of `ARCHITECTURE.md` within the same task.
- Property tests use `fast-check` with `numRuns >= 100` and carry the comment `Feature: m1-foundation, Property N: <title>`.

## Tasks

- [x] 1. Owner approvals before dependent code
  - [x] 1.1 Obtain owner approval of the seven design decisions and record them in ARCHITECTURE.md
    - Use `user_input` to present each decision with its proposed value and record the answer (Approved, Changed to X, or Rejected) in `ARCHITECTURE.md` decision table. Do not write code that depends on a decision until it is recorded.
    - Decisions: (1) size limits and compression-ratio rule: 25 MiB per asset, 50 MiB archive, 25 MiB per entry, 100 MiB total, 1000 entries, ratio 100:1 only for entries of 1 MiB or more; (2) title length 1 to 100 code points after trim; (3) `storage` is one package with `port`, `memory`, `indexeddb` and `testing` entry points; (4) `apps/web` does not depend on `project-format` in M1; (5) startup always lands in the Project Library even when `lastProjectId` is set; (6) `ProjectListing.unreadable` extends the summary list; (7) `Stack.title` may be empty in stored data while the factory requires 1 to 100 code points.
    - If the owner changes a value, update the affected design constants in the later tasks before starting them and report the change.
    - Acceptance: each of the seven decisions has a recorded status in `ARCHITECTURE.md`; unresolved ones stay marked Proposed and block the dependent tasks (4.2 for 2 and 7, 6.1 for 3 and 6, 8.1 for 1, 10.5 and 11.1 for 4 and 5).
    - Verify: `git diff -- ARCHITECTURE.md` shows the recorded decisions; run `npm run format:check` after task 2.4 exists.
    - _Requirements: 4.11, 5.1, 7.7, 10.6, 10.7, 12.6, 13.2, 15.5_
    - _Design: Values that need owner approval; Risks and open items_

- [x] 2. Repository scaffold and quality toolchain
  - [x] 2.1 Create root workspace configuration, LICENSE and contract-owner note
    - Create root `package.json` (`private`, `"type": "module"`, `"license": "Apache-2.0"`, `workspaces: ["apps/*", "packages/*"]`, `engines.node` `^22.22.2 || ^24.15.0`, scripts `lint`, `format`, `format:check`, `typecheck`, `test`, `build`, `dev`, `preview` exactly as in the design's Root scripts table), `tsconfig.base.json` as specified, `.prettierrc.json` (single quotes, semicolons, `printWidth` 100, `trailingComma` all) and `.prettierignore`.
    - Download the unmodified Apache License 2.0 text from `https://www.apache.org/licenses/LICENSE-2.0.txt` into `LICENSE`. Do not type it from memory. Fetch twice and compare SHA-256 of both copies; record the hash for the report.
    - Record `edgiaxel` as owner of shared domain contracts in `ARCHITECTURE.md`.
    - Confirm `.gitignore` does not exclude `.kiro/`.
    - Acceptance: files exist; `LICENSE` is byte-identical across two fetches; `package.json` declares `Apache-2.0`; no `.kiro` entry in `.gitignore`.
    - Verify: `sha256sum LICENSE`, `git check-ignore -v .kiro/specs/m1-foundation/tasks.md` (expect no output and exit code 1), `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))"`.
    - _Requirements: 1.1, 2.1, 2.7, 3.10, 15.1, 15.2_
    - _Design: Workspace layout; TypeScript strategy; Root scripts; Documentation and repository updates_

  - [x] 2.2 Install root development dependencies and record them
    - Install with `npm install -D`: `typescript@~6.0.3`, `@types/node`, `vitest`, `fast-check`, `eslint`, `@eslint/js`, `typescript-eslint`, `globals`, `prettier`. Confirm each version with `npm view <pkg> version` and the typescript-eslint peer range before installing; do not trust the version table without checking.
    - Check whether any dependency declares install scripts (`npm ls`, `npm query ':attr(scripts, [install])'` or inspect `package-lock.json` `hasInstallScript`) and record the result.
    - Add one row per dependency (reason, purpose, license, approximate cost) to the dependency table in `ARCHITECTURE.md`.
    - Acceptance: `package-lock.json` committed state is generated; `npx tsc --version` prints 6.0.x; install-script finding recorded.
    - Verify: `npm ci` exits 0 and leaves `package-lock.json` unchanged (`git diff --exit-code package-lock.json`); `npx tsc --version`.
    - _Requirements: 1.4, 1.5, 2.3, 2.8_
    - _Design: Dependency list; Risks and open items (install scripts)_

  - [x] 2.3 Scaffold `packages/domain` with identifiers, clock, Result and the first tests
    - Create `packages/domain/package.json` (`@ghoststack/domain`, `exports` `./src/index.ts`, `typecheck` script `tsc --noEmit -p .`), `tsconfig.json` extending the base with `lib: ["ES2023","WebWorker"]` and `types: []`, and root `vitest.config.ts` with the `domain` project in the `node` environment.
    - Implement `src/ids.ts` (`IdPrefix`, `IdGenerator`, `UUID_V4_SOURCE`, `ID_PATTERNS`, `generateId` using `crypto.getRandomValues`, setting version and variant bits), `src/clock.ts` (`Clock`, `defaultClock`, `ISO_TIMESTAMP`), `src/result.ts` (`Result`, `ok`, `err`) and `src/index.ts`.
    - Unit tests: ID pattern per prefix, 1,000 generations without duplicates, clock format, and `typeof window === 'undefined'`.
    - Verify the `WebWorker` lib has no conflict; if it does, switch to `lib: ["ES2023"]` plus a small ambient `crypto` declaration and record the fallback.
    - Add `zod` as a dependency of this package now only if needed by files in this task; otherwise add it in 4.1.
    - Acceptance: tests pass in a Node environment with no DOM; a reference to `window` in the package fails type check.
    - Verify: `npm install`, `npm run typecheck -w @ghoststack/domain`, `npm run test -- packages/domain`.
    - _Requirements: 3.3, 3.4, 3.7, 3.9, 1.12_
    - _Design: Identifiers; Clock; Result type; TypeScript strategy; Vitest configuration_

  - [x] 2.4 Configure ESLint flat config and Prettier gates
    - Create `eslint.config.js`: `@eslint/js` recommended, `typescript-eslint` `recommendedTypeChecked`, `no-eval`, `no-new-func`, `no-implied-eval` repo-wide; `no-restricted-globals` (`window`, `document`, `localStorage`, `sessionStorage`, `navigator`) and `no-restricted-imports` per package folder as listed in the design; `lint` script uses `--max-warnings=0`.
    - Run `npm run format` once for the files created so far.
    - Prove the rules work: temporarily add a file in `packages/domain/src` that imports `react` and references `window`, confirm `npm run lint` fails naming the file, then remove it. Report both results.
    - Acceptance: `lint` and `format:check` pass on the current tree and fail on the deliberate violation.
    - Verify: `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run test`.
    - _Requirements: 2.1, 2.2, 2.4, 2.5, 3.3, 1.12_
    - _Design: ESLint and Prettier; Security considerations_

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Domain model, factories and validator
  - [x] 4.1 Implement Zod schemas and inferred types
    - Add `zod` to `@ghoststack/domain` and read the installed Zod 4 documentation for `strictObject` and `discriminatedUnion` before coding.
    - Create `src/schemas.ts` with `FORMAT_VERSION`, `ViewportDefaultsSchema`, `StateEntrySchema`, `LayoutSchema`, `ElementSchema` (six types), `CardSchema`, `AssetSchema`, `StackSchema`, and types `Stack`, `Project`, `Card`, `Element`, `ElementType`, `Asset`, `AssetBytes`, `ProjectBundle`, plus limit constants. Export from `index.ts`.
    - Unit tests: each of the six element types parses; unknown fields are rejected; empty `stateSchema` accepted; type-level `expectTypeOf` assertions fail compilation if a listed field is missing or retyped; factory-style JSON round trip uses no `undefined`.
    - Record the Zod bundle-size cost in the dependency table once measured in task 14.1.
    - Acceptance: exactly six element types; strict objects; types equal `z.infer`.
    - Verify: `npm run typecheck -w @ghoststack/domain`, `npm run test -- packages/domain`.
    - _Requirements: 3.1, 3.2, 3.9, 4.1_
    - _Design: Types and schemas_

  - [x] 4.2 Implement `createStack` and `createCard` factories
    - Create `src/factories.ts` with `FactoryDeps`, `defaultDeps`, `DomainError`, `createStack` (trim, code-point length 1 to 100 via `Array.from`, one clock call used for both timestamps, `newId('stk')` then `newId('crd')`, initial card titled `Card 1`, `entryCardId`, `cardOrder`) and `createCard`. Use the limits recorded in task 1.1.
    - Unit tests: valid title, trimmed title, empty, whitespace-only, 100 versus 101 code points, astral characters counted as one, injected clock and ids give deeply equal output, JSON round trip equality, factory output passes `StackSchema`.
    - Acceptance: invalid titles return `INVALID_TITLE` with `reason` and no Stack.
    - Verify: `npm run test -- packages/domain`, `npm run typecheck -w @ghoststack/domain`.
    - _Requirements: 3.5, 3.6, 3.8, 3.9_
    - _Design: Factories_

  - [x] 4.3 Implement `validateProject`
    - Create `src/validation/` with error types, structural phase (map Zod issues to `MISSING_FIELD`, `INVALID_TYPE`, `UNKNOWN_FIELD`, `INVALID_VALUE`, using `Object.hasOwn` on the input to separate absent from wrong type), semantic phase (checks 1 to 14 from the design with tolerant accessors), deterministic ordering (path by type then value, then code, then message), and a `try`/`catch` returning `VALIDATOR_INTERNAL_ERROR`. Messages must not echo input values.
    - Verify the Zod 4 issue-code and `unrecognized_keys` path shape against the installed version with a throwaway script, then encode the result in unit tests (this closes the design's open item).
    - Unit tests: one per error code, all errors in one result, deep nesting of 1,000 levels at the root, at `title`, inside `cards` and inside an element `properties`, frozen input not mutated, result equal across key-order permutations.
    - Acceptance: every code in `ValidationErrorCode` has a test; the validator never throws.
    - Verify: `npm run test -- packages/domain`, `npm run typecheck -w @ghoststack/domain`, `npm run lint`.
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 4.12, 4.13, 4.14, 4.15, 4.16, 4.17_
    - _Design: Validation (algorithm, phases, ordering)_

  - [x] 4.4 Add shared fast-check arbitraries under `@ghoststack/domain/testing`
    - Create `src/testing/arbitraries.ts` and an `exports` entry `./testing`: `arbId(prefix)`, `arbElement`, `arbCard`, `arbAsset`, `arbBundle` (valid project plus matching bytes and real SHA-256 checksums, bytes 0 to 2,048 including empty), `arbJsonValue`, `arbFault`. `fast-check` is a dev dependency only; the main entry must not import it.
    - Add `buildFixtureBundle()` (three cards, two assets, one zero-byte) for later fixtures.
    - Unit test: every `arbBundle` sample passes `validateProject` and the fixture has the required shape.
    - Acceptance: arbitraries are importable from `@ghoststack/domain/testing` and not from the main entry.
    - Verify: `npm run test -- packages/domain`, `npm run typecheck -w @ghoststack/domain`.
    - _Requirements: 3.1, 4.17, 11.2_
    - _Design: Test data; Property-based testing rules_

  - [x] 4.5 Write property test for factory output
    - **Property 1: Factory output is a valid, serializable, deterministic Stack**
    - **Validates: Requirements 3.5, 3.8, 3.9, 4.17**

  - [x] 4.6 Write property test for invalid titles
    - **Property 2: Invalid titles are rejected**
    - **Validates: Requirements 3.6, 12.3**

  - [x] 4.7 Write property test for identifiers
    - **Property 3: Generated identifiers match their pattern**
    - **Validates: Requirements 3.7, 4.12**

  - [x] 4.8 Write property test for validator totality, purity and determinism
    - **Property 4: The validator is total, pure and deterministic**
    - **Validates: Requirements 4.3, 4.14, 4.15, 4.16**

  - [x] 4.9 Write property test for valid projects
    - **Property 5: Valid projects have no validation errors**
    - **Validates: Requirements 4.1, 4.2, 4.17**

  - [x] 4.10 Write property test for structural faults
    - **Property 6: Structural faults are reported with their location**
    - **Validates: Requirements 4.3, 6.13, 8.5**

  - [x] 4.11 Write property test for referential and identifier faults
    - **Property 7: Referential and identifier faults are all reported with their identifiers**
    - **Validates: Requirements 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.12, 4.13**

  - [x] 4.12 Write property test for asset path and size rules
    - **Property 8: Asset path and size rules are enforced**
    - **Validates: Requirements 4.10, 4.11**

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Storage port, in-memory implementation and IndexedDB adapter
  - [x] 6.1 Scaffold `packages/storage` with the port and in-memory implementation
    - Create package `@ghoststack/storage` (depends on `@ghoststack/domain`), `tsconfig.json` (same lib as domain), `storage` project in `vitest.config.ts`, and ESLint overrides for `src/port` and `src/memory`.
    - Implement `src/port` (`StorageErrorCode`, `StorageError`, `ProjectSummary`, `UnreadableProject`, `ProjectListing`, `StoragePort`) and `src/memory` (`createMemoryStorage` with deep copies on write and read, build-then-swap `saveProject`, validation and byte-size checks before write, `FaultController.failNextWrite`, cascade delete). Export from `src/index.ts`.
    - Unit tests for each operation, each error code the memory implementation can produce, and copy isolation.
    - Acceptance: no browser global, React or `idb` import in `port` or `memory` (lint passes).
    - Verify: `npm install`, `npm run typecheck -w @ghoststack/storage`, `npm run test -- packages/storage`, `npm run lint`.
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6, 5.7, 5.8, 1.12_
    - _Design: Port; In-memory implementation; Why storage is one package_

  - [x] 6.2 Implement the shared contract suite and run it on the in-memory port
    - Create `src/testing/contract.ts` exposing `runStoragePortContract(name, makePort)` through the `./testing` entry, covering the groups in the design (round trip, list, missing, delete cascade, invalid save, fault during save, replace semantics, isolation).
    - Add `src/memory/memory.contract.test.ts` that runs it against `createMemoryStorage`.
    - Acceptance: every operation and every producible error code is covered.
    - Verify: `npm run test -- packages/storage`, `npm run typecheck -w @ghoststack/storage`.
    - _Requirements: 5.5, 5.6, 5.7, 5.8_
    - _Design: Shared contract suite_

  - [x] 6.3 Implement the IndexedDB adapter and run the contract suite on it
    - Add `idb` and dev dependency `fake-indexeddb`; record reasons and costs. Create `src/indexeddb` with `createIndexedDbStorage` (database `ghoststack`, version 1, stores `stacks` and `assets` with compound key and key-range queries, lazy cached open that clears on failure, single read-write transaction per save that queues requests only, `tx.done` before resolving, abort on error), `mapIdbError`, and the `faultInjection` hook. Export through the `./indexeddb` entry.
    - Tests with `fake-indexeddb` and an injected `IDBFactory`: contract suite, fresh open creates both stores, pre-created version 99 returns `unsupported-version` and stays at 99 unchanged, corrupt stored record returns `validation-failed` and is not modified, fault after the stack put and after asset puts leaves old data intact, two adapters on one factory model a reload, `mapIdbError` table including `QuotaExceededError`.
    - Acceptance: `list` reports damaged records in `unreadable`; no credentials stored; no `window`, `document` or `navigator` use in the adapter.
    - Verify: `npm run test -- packages/storage`, `npm run typecheck -w @ghoststack/storage`, `npm run lint`.
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.11, 6.13, 5.5_
    - _Design: IndexedDB adapter_

  - [x] 6.4 Write property test for storage round trip
    - **Property 9: Storage round trip preserves projects and asset bytes**
    - Run against both the in-memory port and the IndexedDB adapter.
    - **Validates: Requirements 5.1, 5.2, 5.5, 6.9, 12.7**

  - [x] 6.5 Write property test for failed saves
    - **Property 10: A failed save leaves stored data unchanged**
    - **Validates: Requirements 5.3, 5.7, 6.5, 6.6**

  - [x] 6.6 Write property test for not-found and cascade delete
    - **Property 11: Missing and deleted data return not-found, and deletion cascades**
    - **Validates: Requirements 5.6, 5.8, 6.8**

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. GSP project format
  - [x] 8.1 Scaffold `packages/project-format` with limits, manifest, canonical JSON and checksum
    - Create package `@ghoststack/project-format` (depends on `@ghoststack/domain`, `fflate`; `project-format` Vitest project; ESLint restrictions for `react`, `react-dom`, `idb`). Confirm `fflate` version and license with `npm view`, add it, and record the ZIP library selection (candidates, rationale, weaknesses) in `ARCHITECTURE.md` in the same task.
    - Implement `GSP_LIMITS` (use values recorded in task 1.1), `SUPPORTED_FORMAT_VERSIONS`, `FIXED_ZIP_TIME` built with `new Date(1980, 0, 1, 0, 0, 0)`, `ManifestSchema`, `canonicalJson` (sorted keys, no whitespace), `sha256Checksum` (Web Crypto, returns `CRYPTO_UNAVAILABLE` error when absent).
    - Unit tests: canonical key sorting at all levels, checksum of known vectors (empty input and `abc`), manifest strictness, `FIXED_ZIP_TIME` accepted by `zipSync` under `TZ=America/Los_Angeles`, `TZ=UTC` and `TZ=Pacific/Auckland`.
    - Acceptance: exports present; tests run in Node with no DOM.
    - Verify: `npm install`, `npm run typecheck -w @ghoststack/project-format`, `npm run test -- packages/project-format`, `TZ=America/Los_Angeles npm run test -- packages/project-format`.
    - _Requirements: 8.2, 8.3, 8.4, 8.7, 9.4, 1.12_
    - _Design: ZIP library selection; Constants; Format version scheme; Manifest schema; Checksum; Canonical JSON_

  - [x] 8.2 Implement archive test helpers and corrupt-fixture builders
    - Create `src/testing/archive.ts`: `buildArchive(parts)` writing arbitrary entries with `zipSync`, byte-level patchers for declared sizes in local and central headers, truncation, byte flipping, duplicate entry names, and a zero-filled oversized-entry builder. Not exported from the main entry.
    - Unit tests: each helper produces the intended defect (verified by reading the archive back with `unzipSync` metadata).
    - Acceptance: helpers cover every fixture listed in the design's Test data section.
    - Verify: `npm run test -- packages/project-format`, `npm run typecheck -w @ghoststack/project-format`.
    - _Requirements: 11.3, 11.7_
    - _Design: Test data_

  - [x] 8.3 Implement the entry-rule scan and chunked inflate helper
    - Create `src/import/entries.ts` (metadata scan with `unzipSync` and an always-false `filter`, entry count, name rules, duplicate names, compression method 0 or 8, declared size caps, total cap, ratio rule from 1 MiB) and `src/import/inflate.ts` (`Unzip` plus `UnzipInflate`, 16 KiB pushes, per-entry and total counters, `terminate()` on overrun, `SIZE_MISMATCH`, `ENTRY_SET_MISMATCH`).
    - Unit tests using 8.2 helpers: path traversal, absolute, backslash, null char, directory entry, unknown location, duplicate, count above limit, declared size above cap, ratio bomb, declared size smaller than real size (the `fflate` truncation case), real size above cap with a lying declared size, stop on overrun.
    - Acceptance: no entry content is inflated before the metadata rules pass.
    - Verify: `npm run test -- packages/project-format`, `npm run typecheck -w @ghoststack/project-format`.
    - _Requirements: 8.8, 10.4, 10.5, 10.6, 10.7_
    - _Design: Importer steps 2 to 4_

  - [x] 8.4 Implement `importProject`
    - Create `src/import/importProject.ts` following the pipeline: input guard, metadata scan, entry rules, manifest first (UTF-8 fatal decode, JSON parse, version peek before schema), `stack.json` and `cards/*.json`, cross-checks, asset size and SHA-256 verification, assembly, manifest-versus-stack consistency, `validateProject`, stack ID collision handling (at most 10 attempts, `STACK_ID_UNRESOLVED`). Everything inside `try`/`catch`; all failures `PROJECT_IMPORT_FAILED` with `reason`; messages contain no content values.
    - Unit tests: one per `ImportReason` using 8.2 fixtures, including missing and non-JSON and schema-invalid manifest, unsupported older and newer versions, checksum mismatch, missing and unlisted asset, missing and unreferenced card, mismatched card entry name, project-invalid archive, collision resolution, empty and random bytes.
    - Acceptance: the importer never throws and never touches storage.
    - Verify: `npm run test -- packages/project-format`, `npm run typecheck -w @ghoststack/project-format`, `npm run lint`.
    - _Requirements: 8.8, 8.9, 8.10, 10.1, 10.2, 10.3, 10.4, 10.5, 10.8, 10.9, 10.10, 10.11, 10.12, 10.13, 10.14, 10.16_
    - _Design: Importer; Error Handling_

  - [x] 8.5 Implement `serializeProject`
    - Create `src/serialize.ts`: validate first, check asset bytes, sizes and checksums, check limits, fixed entry order (`manifest.json`, `stack.json`, cards sorted by id, assets sorted by path), canonical JSON, `zipSync` with fixed `mtime` (level 6 for JSON, 0 for assets), then reopen through `importProject` and compare to the input; return `PROJECT_EXPORT_FAILED` with a `reason` on any failure. Never mutate input; read no clock.
    - Unit tests: invalid project, missing bytes, wrong size, wrong checksum, limit exceeded, byte-identical output for equal input, archive entry list is exactly as specified, manifest checksums equal independently computed SHA-256.
    - Acceptance: failed export returns no archive.
    - Verify: `npm run test -- packages/project-format`, `npm run typecheck -w @ghoststack/project-format`.
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8_
    - _Design: Serializer_

  - [x] 8.6 Add round-trip and failure fixture tests
    - Round trip of `buildFixtureBundle()` (three cards, two assets, one zero-byte asset, asset bytes identical, zero-byte length 0). One fixture per failure category of Requirement 10, each asserting a structured error with the right reason, no thrown exception and no project. A test that a rejected import leaves a memory-storage state unchanged. Script-like and HTML-like titles survive as plain text. A time-zone determinism check as chosen in 8.1.
    - Acceptance: every failure category in Requirement 10 has a fixture test.
    - Verify: `npm run test -- packages/project-format`, `TZ=America/Los_Angeles npm run test -- packages/project-format`.
    - _Requirements: 11.2, 11.3, 11.4, 11.7, 10.13, 10.15_
    - _Design: Example and edge-case tests_

  - [x] 8.7 Write property test for `.gsp` round trip
    - **Property 15: `.gsp` round trip preserves the project**
    - **Validates: Requirements 8.1, 8.2, 9.3, 9.4, 11.1**

  - [x] 8.8 Write property test for deterministic serialization
    - **Property 16: Serialization is deterministic and idempotent**
    - **Validates: Requirements 9.6, 11.5**

  - [x] 8.9 Write property test for refused exports
    - **Property 17: Invalid exports are refused without side effects**
    - **Validates: Requirements 9.1, 9.2, 9.5**

  - [x] 8.10 Write property test for importer totality and byte flips
    - **Property 18: The importer never throws and corruption never yields an invalid project**
    - **Validates: Requirements 10.4, 10.16, 11.6**

  - [x] 8.11 Write property test for unsafe entry names
    - **Property 19: Unsafe or unrecognized entry names are rejected**
    - **Validates: Requirements 8.8, 10.5**

  - [x] 8.12 Write property test for archive tampering
    - **Property 20: Archive tampering is detected with the right reason**
    - **Validates: Requirements 8.9, 10.8, 10.9, 10.10**

  - [x] 8.13 Write property test for unsupported versions
    - **Property 21: Unsupported format versions are rejected**
    - **Validates: Requirements 8.3, 8.10, 10.3**

  - [x] 8.14 Write property test for stack ID collisions
    - **Property 22: Imported stack IDs never collide with existing projects**
    - **Validates: Requirements 10.14, 11.1**

  - [x] 8.15 Write property test for invalid projects inside archives
    - **Property 23: Invalid projects inside an archive are rejected**
    - **Validates: Requirements 10.11, 10.12**

  - [x] 8.16 Write property test for failed imports and stored data
    - **Property 24: Failed imports leave stored data unchanged**
    - Use `createMemoryStorage` from `@ghoststack/storage`.
    - **Validates: Requirements 10.15, 8.8**

- [x] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Web application foundation: toolchain, theme, preferences, services
  - [x] 10.1 Scaffold `apps/web` with Vite, React and the component test environment
    - Create `apps/web` (`@ghoststack/web`, depends on `@ghoststack/domain` and `@ghoststack/storage`; not on `project-format` per decision 4): `package.json` scripts (`dev`, `build` = `tsc --noEmit -p . && vite build`, `preview`, `typecheck`), `tsconfig.json` (`lib` ES2023, DOM, DOM.Iterable; `jsx: react-jsx`; `types: ["vite/client"]`), `vite.config.ts` with the `web` test project (`jsdom`, setup file, include), `index.html`, `src/main.tsx`, `src/app/App.tsx` rendering a minimal shell, `src/test/setup.ts`.
    - Check `npm view` for each package (`react`, `react-dom`, `vite`, `@vitejs/plugin-react`, `@types/react`, `@types/react-dom`, `jsdom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/jest-dom`, `@testing-library/user-event`, `eslint-plugin-react-hooks`) and record reasons and costs in the dependency table.
    - Read the installed `eslint-plugin-react-hooks` README for the exact flat-config key names, then add the web override to `eslint.config.js`. Record the keys used.
    - Add the first component test: render `App` and assert a visible element.
    - Acceptance: build and test run; lint covers `.tsx`; the open design item on hooks plugin keys is resolved.
    - Verify: `npm install`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`.
    - _Requirements: 1.2, 1.3, 1.7, 1.8, 1.11, 2.2, 2.6, 2.8_
    - _Design: Workspace layout; Root scripts; Vitest configuration; ESLint and Prettier_

  - [x] 10.2 Implement the Spectral Workstation theme, bundled fonts and contrast tests
    - Add `@fontsource/inter` and `@fontsource/jetbrains-mono`; confirm the `latin-400.css`, `latin-600.css` (Inter) and `latin-400.css` (JetBrains Mono) files exist in the installed packages before importing them. Create `src/themes/spectral-workstation.css` scoped under `.gs-editor` with the `--gs-` custom properties and font stacks; import fonts and theme in `main.tsx`; apply the `gs-editor` class to the shell root.
    - Tests (Vitest, `?raw` import): values equal Requirement 14.1; `contrastRatio()` pure function with its own examples (black on white is 21); text-on-base and text-on-panel ratios are at least 4.5; selectors scoped to `.gs-editor`; no `Studio Paper` or `Midnight Terminal` string; no `http(s)://` in theme CSS; `:focus-visible` rule present; root has no `overflow-x: hidden`.
    - Acceptance: no runtime request to an external host for fonts (verified after build in 14.1 and 15.1).
    - Verify: `npm run test -- apps/web`, `npm run lint`, `npm run build`.
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 13.9_
    - _Design: Theme_

  - [x] 10.3 Implement the Preferences store
    - Create `src/preferences/preferences.ts` with `Preferences`, `DEFAULT_PREFERENCES`, `PreferencesStore`, `createPreferencesStore(storage | null)`, a per-key Zod schema, independent reads, immediate writes, in-memory fallback on any thrown error, `subscribe`, and the four `ghoststack.pref.*` keys only. Add `safeLocalStorage()` returning `null` when access throws.
    - Unit tests: defaults, malformed value resets only that key, each valid value round trips through a second store, exact set of keys written, throwing and null storage, quota error on write.
    - Acceptance: no Project data, asset bytes or credentials key exists.
    - Verify: `npm run test -- apps/web`, `npm run typecheck -w @ghoststack/web`.
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_
    - _Design: Preferences store_

  - [x] 10.4 Write property test for Preferences
    - **Property 14: Preferences are always valid and never interrupt the app**
    - **Validates: Requirements 7.4, 7.5, 7.6**

  - [x] 10.5 Implement services context, route reducer, error boundary and startup wiring
    - Create `ServicesProvider` (storage, preferences, clock, id generator), the `Route` reducer (`open`, `close`), a top-level error boundary with a reload button, and `main.tsx` bootstrap that reads preferences before first render and sets panel-size CSS variables and visibility on the editor root. Startup always shows the Project Library (decision 5). Tests provide `createMemoryStorage()` and a fake preferences store.
    - Unit tests: reducer transitions; preferences applied before first render; error boundary shows message and does not touch storage.
    - Acceptance: no router or state library added.
    - Verify: `npm run test -- apps/web`, `npm run typecheck -w @ghoststack/web`, `npm run build`.
    - _Requirements: 7.3, 13.5, 1.6_
    - _Design: Bootstrap; State and routing; Error Handling_

- [x] 11. Project Library (UI-01)
  - [x] 11.1 Implement the Project Library
    - Create `sortSummaries` (`updatedAt` descending, then `title` ascending by code unit, then `stackId`), `useProjectLibrary` (states `loading`, `ready`, `unavailable`, `error`), and the `ProjectLibrary` component: empty state with Create Project form (labeled input, trim and `createStack`, inline error via `aria-describedby`, text retained on error, `saveProject({ stack, assets: {} })`, on success set `lastProjectId`, request `navigator.storage.persist()` once inside `try`/`catch`, then open the workspace), list rows with title and formatted `updatedAt`, unavailable rows for load failures and `unreadable` records, `role="alert"` banner when storage is unavailable, stale `lastProjectId` reset, and disabled Import, Rename, Delete and Export buttons labeled "not available in this slice". No account or sign-in UI.
    - Component tests (Testing Library, `user-event`, memory storage): empty state shows Create and no list; valid create opens the workspace; empty, whitespace-only and 101-character titles show the error, keep the text and save nothing; failing port shows "not saved", does not open the workspace and does not list the stack; reload simulation via a fresh app over the same storage; unreadable record disabled while others stay selectable; unavailable banner and no success message; disabled actions are `disabled`; stale `lastProjectId` reset.
    - Acceptance: matches Requirement 12 criteria 1 to 10; wall-clock timing is not asserted.
    - Verify: `npm run test -- apps/web`, `npm run lint`, `npm run typecheck -w @ghoststack/web`.
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9, 12.10, 6.10, 6.12, 7.7_
    - _Design: Project Library (UI-01)_

  - [x] 11.2 Write property test for Project Library ordering
    - **Property 12: Project Library ordering**
    - **Validates: Requirements 12.4**

- [x] 12. Stack Workspace (UI-02)
  - [x] 12.1 Implement the Stack Workspace shell, session hook and persistence status
    - Create `useProjectSession(stackId)` (phases `loading`, `error`, `ready`, with `save` and `retrySave`), `StackWorkspace` (CSS grid with navigator, toolbox, canvas and inspector zones, labeled non-interactive placeholders, header with return button, title or "Untitled stack" placeholder label, "Cards" `nav` list in `cardOrder` order), `PersistenceStatus` (exactly "Saved" or "Save failed", `role="status"`, alert text "The project was not saved", Retry save only when failed), loading indicator that hides title, list and status, error state with return action. Wire into `App`. No editing, behavior, AI, preview or export controls.
    - Component and hook tests with a failing fake `StoragePort`: loading state shows only the indicator; failed load and not-found show the error and return action; empty title shows the placeholder without changing stored data; failed `save` switches to Save failed and keeps in-memory state; retry returns to Saved; return action goes to the Library; reload shows the same title and card list.
    - Disclose in the report that the failed-save state has no user-driven trigger in M1 and is covered by hook and component tests only.
    - Verify: `npm run test -- apps/web`, `npm run lint`, `npm run typecheck -w @ghoststack/web`, `npm run build`.
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 12.7_
    - _Design: Stack Workspace (UI-02)_

  - [x] 12.2 Write property test for Card navigator order
    - **Property 13: Card navigator follows `cardOrder`**
    - **Validates: Requirements 13.1**

  - [x] 12.3 Add accessibility and static boundary tests
    - Tests: every `button` and `textbox` has an accessible name; Tab order reaches controls in DOM order in both screens; landmarks (`header`, `nav` named Cards, `main`, named `aside` and toolbox `section`); `package.json` of `domain`, `project-format` and `storage` list no `react`, `react-dom` or DOM library; `apps/web` source contains no `eval`, `new Function`, `innerHTML` or `dangerouslySetInnerHTML`; application code issues no `fetch` or `XMLHttpRequest`; layout CSS has `min-width: 0` on grid children and `overflow-wrap: anywhere` on titles.
    - Acceptance: tests fail if a boundary is violated (confirm once by a temporary violation and report it).
    - Verify: `npm run test`, `npm run lint`.
    - _Requirements: 13.9, 13.10, 1.10, 1.12, 3.3, 14.5_
    - _Design: Accessibility; Layout resilience; Security considerations_

- [x] 13. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Documentation updates
  - [x] 14.1 Update ARCHITECTURE.md with verified facts
    - Run `npm run build`, then measure bundle sizes (Zod, `idb`, React, fonts) from `apps/web/dist` and record them in the dependency table; scan `apps/web/dist` for absolute `http(s)` URLs other than XML namespaces and record the result.
    - Update: current status, actual repository tree, ZIP library decision, GSP format version 1 layout, manifest, canonical JSON and deterministic ZIP, identifier pattern, size limits with units (marked per the owner's recorded status), IndexedDB database name, version and stores, `storage` packaging decision, owner of shared contracts, complete dependency list with reasons and costs, planned script table, and end-to-end tests listed as not available.
    - Keep every command in the command table marked "not yet verified" here. Marking verified happens only in 15.3 after evidence exists.
    - Acceptance: every statement matches the repository; no invented versions or commands.
    - Verify: `npm run format:check`, `git diff -- ARCHITECTURE.md` review.
    - _Requirements: 2.1, 2.8, 8.6, 8.7, 15.5, 15.4_
    - _Design: Documentation and repository updates; Dependency list_

- [x] 15. Final verification and report
  - [x] 15.1 Run the clean-checkout verification and write `docs/M1-VERIFICATION.md`
    - From a clean checkout of the working tree (for example `git stash`-free: use `git worktree add` or a fresh `git clone` of the local repository into a temporary directory, with the owner's agreement if uncommitted changes would need committing; otherwise report that a true clean checkout was Not_Available and run on the working tree after removing `node_modules`), run in order: `npm ci`, `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run test`, `npm run build`. Record each exit code and, on failure, the first failing file or test.
    - Record per-package results for domain, storage and project-format: `npm run typecheck -w <name>`, `npm run test -- packages/<dir>`, package manifest check for React and DOM libraries, non-DOM environment confirmation.
    - Record the forbidden-code search against the pre-M1 baseline commit with exact commands (for example `git diff --name-only <baseline>` and `git grep -nEi "openai|ollama|mcp|playwright|eval\(|new Function|innerHTML" -- apps packages`), the pattern-based secret scan from the design (state that no scanner was used), the diff review listing any changed file not attributable to an M1 requirement, `git grep` evidence that `.kiro/` is tracked, and the `LICENSE` hash.
    - List every Skipped, Failed or Not_Available check (end-to-end tests, CI, Playwright) with reasons. Mark nothing Passed without an observed exit code.
    - Acceptance: every M1 exit criterion in `MILESTONE.md` has a status and the exact command or manual step.
    - Verify: re-read the report against the recorded command output; `npm run format:check`.
    - _Requirements: 16.1, 16.2, 16.3, 16.6, 16.7, 16.8, 16.9, 15.8, 15.9, 2.4_
    - _Design: Commands and quality gates; Documentation and repository updates_

  - [x] 15.2 Add the manual browser check section and record owner-supplied results
    - Add the nine numbered manual steps from the design to `docs/M1-VERIFICATION.md` (create Stack with a known title and confirm one Card, reload, confirm Library lists the exact title, open it and confirm title and Card, offline repeat, horizontal scroll at 1024, 1280 and 3840 px, blocked fonts, Tab focus ring, informal open time).
    - Ask the owner (`user_input`) to run them with `npm run preview` after `npm run build` and report browser name and version plus pass or fail per step. Record only reported results. If the owner has not run them, record every step as Not_Available and mark M1 as not closed. A coding agent must not claim these steps passed.
    - Acceptance: each step has a status, browser name and version, or an explicit Not_Available.
    - Verify: review `docs/M1-VERIFICATION.md`; `npm run format:check`.
    - _Requirements: 16.4, 16.5, 16.7, 1.6, 1.9, 1.10, 6.9, 12.7, 13.10, 14.5_
    - _Design: Manual verification_

  - [x] 15.3 Update README, ARCHITECTURE command table, MILESTONE and CHANGELOG from evidence
    - README: setup and run commands, each listed only if it exited 0 in 15.1 (`dev` and `preview` are long-running; list them only if the owner reported they started in 15.2, otherwise mark not yet verified); License section naming Apache License 2.0 and linking `LICENSE`; end-to-end tests listed as not available.
    - ARCHITECTURE command table: mark Verified only for commands with exit code 0 in the report; all others stay not yet verified.
    - MILESTONE: mark an M1 item complete only if its acceptance criteria were verified; record the Apache-2.0 decision and the owner of the shared contract; leave the rest unmarked.
    - CHANGELOG: add one entry dated with the completion date listing the foundation changes, only if M1 items were verified.
    - Do not commit or push. Report the diff for the owner to review and commit.
    - Acceptance: no document claims more than the report shows.
    - Verify: `npm run format:check`, `git diff --stat`, and a manual comparison of each claim to `docs/M1-VERIFICATION.md`.
    - _Requirements: 15.2, 15.3, 15.4, 15.6, 15.7, 15.10, 3.10_
    - _Design: Documentation and repository updates_

- [x] 16. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional property tests and can be skipped for a faster MVP. Skipping them must be disclosed in the verification report, because Requirement 11 requires the round-trip, idempotence and byte-flip properties to run with at least 100 cases; tasks 8.7, 8.8 and 8.10 are the ones that satisfy those criteria.
- Each task references requirement clauses and design sections for traceability.
- Open design items resolved inside tasks: ESLint hooks-plugin keys (10.1), Zod 4 issue-code mapping (4.3), install scripts (2.2), `WebWorker` lib conflicts (2.3), bundle sizes (14.1), time-zone determinism guard (8.1).
- Task 1.1 needs the owner. If approvals are pending, tasks 2.x may proceed, but the tasks named in 1.1 must wait.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2"] },
    { "id": 3, "tasks": ["2.3"] },
    { "id": 4, "tasks": ["2.4"] },
    { "id": 5, "tasks": ["4.1"] },
    { "id": 6, "tasks": ["4.2"] },
    { "id": 7, "tasks": ["4.3"] },
    { "id": 8, "tasks": ["4.4"] },
    { "id": 9, "tasks": ["4.5", "4.6", "4.7", "4.8", "4.9", "4.10", "4.11", "4.12"] },
    { "id": 10, "tasks": ["6.1"] },
    { "id": 11, "tasks": ["6.2"] },
    { "id": 12, "tasks": ["6.3"] },
    { "id": 13, "tasks": ["6.4", "6.5", "6.6", "8.1"] },
    { "id": 14, "tasks": ["8.2", "8.3"] },
    { "id": 15, "tasks": ["8.4"] },
    { "id": 16, "tasks": ["8.5"] },
    { "id": 17, "tasks": ["8.6", "8.7", "8.8", "8.9", "8.10", "8.11", "8.12", "8.13", "8.14", "8.15", "8.16"] },
    { "id": 18, "tasks": ["10.1"] },
    { "id": 19, "tasks": ["10.2", "10.3"] },
    { "id": 20, "tasks": ["10.4", "10.5"] },
    { "id": 21, "tasks": ["11.1"] },
    { "id": 22, "tasks": ["11.2", "12.1"] },
    { "id": 23, "tasks": ["12.2", "12.3"] },
    { "id": 24, "tasks": ["14.1"] },
    { "id": 25, "tasks": ["15.1"] },
    { "id": 26, "tasks": ["15.2"] },
    { "id": 27, "tasks": ["15.3"] }
  ]
}
```
