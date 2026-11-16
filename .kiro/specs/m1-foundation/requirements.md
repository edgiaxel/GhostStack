# Requirements Document

## Introduction

This document specifies GhostStack milestone M1, Foundation (vertical slice VS-00, "Repository and application foundation"). M0 is complete and the repository is pushed to `origin/main`. M1 delivers a running React + TypeScript + Vite browser application, a framework-independent domain model, project validation, a storage port with an IndexedDB adapter, an initial versioned `.gsp` archive with a tested round-trip, a workspace shell with the Spectral Workstation theme, and a verified quality toolchain.

Scope is limited to MILESTONE.md section M1. AI, MCP, the behavior runtime, canvas editing, Card editing UI, preview, standalone export, autosave debouncing, undo/redo, and checkpoints are out of scope.

Source documents: PRD F-001, F-015, F-018, F-019; DESIGN UI-01, UI-02, DQ-010 and the Spectral Workstation theme; ARCHITECTURE sections 3, 5, 6, 7, 8, 13 (decisions T-001 to T-006, T-015, T-016); `.kiro/steering/*`.

Values marked "proposed" (size limits, compression ratio, title length, version formats) are starting points to be confirmed in the design phase and recorded in ARCHITECTURE.md.

## Glossary

- **GhostStack_App**: The React + TypeScript + Vite browser application in `apps/web`.
- **Domain_Core**: The framework-independent TypeScript module defining Stack, Card, Element and Asset types, factories, and project invariants.
- **Project_Validator**: The component that checks a Project against schemas and reference-integrity rules and returns structured results.
- **Project**: A Stack together with its Cards, Elements and Asset registry entries, as defined by Domain_Core.
- **Stack**: The top-level project entity holding `stackId`, `title`, `formatVersion`, `createdAt`, `updatedAt`, `entryCardId`, `cardOrder`, `cards`, `assetRegistry` and `viewportDefaults`.
- **Card**: A screen within a Stack holding `cardId`, `title`, `elements` and metadata.
- **Element**: A visual item on a Card with `elementId`, `type`, `name`, `properties` and `layout`. Types for this slice are Text, Button, Input, Image, Shape and Line.
- **Asset**: A binary resource registered in the asset registry with `assetId`, `relativePath`, `mimeType`, `byteSize` and `checksum`.
- **Validation_Result**: A structured value listing zero or more errors, each with a machine-readable code, a message and a location path.
- **Storage_Port**: The storage interface used by application code to save, load, list and delete Projects, independent of any browser API.
- **IndexedDB_Adapter**: The Storage_Port implementation backed by IndexedDB through the `idb` library.
- **Preferences_Store**: The `localStorage`-backed store reserved for small UI preferences (theme, panel sizes, panel visibility, last opened project ID).
- **GSP_Format**: The versioned ZIP-based `.gsp` archive layout: `manifest.json`, `stack.json`, `cards/*.json`, `assets/*`.
- **GSP_Serializer**: The component that converts a Project and its asset bytes into `.gsp` archive bytes.
- **GSP_Importer**: The component that reads `.gsp` archive bytes, validates them, and returns a Project and asset bytes or a structured error.
- **Manifest**: The `manifest.json` entry holding the format version, listing of entries, and per-asset checksums.
- **Workspace_Shell**: The GhostStack_App layout containing a Project Library view (UI-01) and a Stack Workspace view (UI-02) with placeholder regions only.
- **Theme_System**: The CSS-variable-based mechanism that applies the Spectral Workstation theme to the Workspace_Shell.
- **Toolchain**: The set of lint, format, type-check, test and build scripts defined in the root `package.json`.
- **Repository**: The GhostStack Git repository at its root, including source, configuration and documentation.
- **Verification_Report**: The written record of M1 exit-criteria results, commands run, and skipped or failed checks, produced at the end of the slice.
- **Verified_Command**: A command that was executed in the repository and exited successfully.

## Requirements

### Requirement 1: Application and Workspace Foundation

**User Story:** As a developer, I want a running React + TypeScript + Vite application inside a minimal npm workspace, so that later slices have a stable base to build on.

#### Acceptance Criteria

1. THE Repository SHALL contain a root `package.json` that declares npm workspaces and a committed `package-lock.json`.
2. THE Repository SHALL contain the GhostStack_App in `apps/web` built with React, TypeScript and Vite.
3. THE Repository SHALL create workspace packages only for Domain_Core, GSP_Format and Storage_Port code that this slice implements, and SHALL contain no empty placeholder packages or directories for AI, MCP, behavior, desktop or other future milestones.
4. THE Repository SHALL record the exact installed version of every direct and transitive dependency in `package-lock.json`, with versions selected after checking official package documentation or the npm registry at implementation time.
5. WHEN a clean install is run with the verified install script using only `package.json` and `package-lock.json`, THE Toolchain SHALL exit with status 0 and leave `package-lock.json` unmodified.
6. WHEN the development server is started with the verified dev script, THE GhostStack_App SHALL render the Workspace_Shell in the current stable release of Chrome, Firefox or Safari on desktop, with zero console messages at error level within 5 seconds of page load.
7. WHEN the verified build script is run, THE Toolchain SHALL produce static build output in a single output directory, run the TypeScript type check with zero errors, and exit with status 0.
8. IF the verified build script encounters a TypeScript or bundling error, THEN THE Toolchain SHALL exit with a non-zero status and report the failing file and error.
9. WHEN the verified preview script is run against the build output, THE GhostStack_App SHALL render the Workspace_Shell with zero console messages at error level within 5 seconds of page load.
10. WHILE the browser has no network connection after the application assets have loaded, THE GhostStack_App SHALL render and operate the Workspace_Shell with zero failed network requests initiated by application code.
11. THE GhostStack_App SHALL include no AI provider, MCP, behavior runtime, canvas editing, preview or standalone export code.
12. THE Domain_Core, GSP_Format and Storage_Port packages SHALL declare no dependency on React, browser globals or UI components.

> Scope note (2026-11-16, owner-approved, ARCHITECTURE.md T-027): the built GhostStack_App also registers a same-origin service worker that precaches the app shell, so a reload while offline works in the production build. This adds code that criterion 11 does not list and relaxes nothing in criteria 10 and 12. The acceptance criteria above are unchanged.

### Requirement 2: Quality Toolchain

**User Story:** As a developer, I want linting, formatting, type checking and tests configured, so that every change can be verified with documented commands.

#### Acceptance Criteria

1. THE Toolchain SHALL provide root scripts for lint, format check, type check, unit test (single run, non-watch) and production build, and THE Repository SHALL document each script name and its purpose in ARCHITECTURE.md.
2. THE Toolchain SHALL run type checking across the GhostStack_App and every workspace package with TypeScript strict mode enabled, and the type-check script SHALL cover every TypeScript source file in those projects.
3. THE Toolchain SHALL run unit tests with Vitest and property-based tests with fast-check, and each property-based test SHALL execute at least 100 generated cases per run.
4. WHEN a lint, format check, type check, unit test or production build script is run on the committed repository state after a clean dependency install, THE Toolchain SHALL exit with status 0 and report 0 errors and 0 failing tests.
5. IF a lint, format check, type check, unit test or production build script detects an error, a formatting violation or a failing test, THEN THE Toolchain SHALL exit with a non-zero status and print a message that identifies the failing file or test.
6. THE Toolchain SHALL configure a component test environment and include at least one component test of the Workspace_Shell using Testing Library, and that test SHALL render the Workspace_Shell and assert at least one visible element.
7. THE Repository SHALL contain no `.gitignore` entry that excludes `.kiro/` or any file or directory within it.
8. WHEN a dependency is added, THE Repository SHALL record the reason for the dependency, its purpose, and its approximate bundle or maintenance cost in the design document or ARCHITECTURE.md within the same change.
9. THE Toolchain SHALL NOT define Playwright end-to-end scripts in this slice, and THE Repository documentation SHALL list end-to-end tests as not available.

### Requirement 3: Shared Domain Model

**User Story:** As a developer, I want Stack, Card, Element and Asset types in a framework-independent module, so that the editor, storage and project format share one model.

#### Acceptance Criteria

1. THE Domain_Core SHALL define Stack, Card, Element and Asset types with the fields listed in the Glossary and ARCHITECTURE section 6.1, and a type-level test SHALL fail compilation if any listed field is missing or has a different type.
2. THE Domain_Core SHALL define exactly six Element types: Text, Button, Input, Image, Shape and Line.
3. THE Domain_Core SHALL NOT import React, browser globals, `idb`, ZIP libraries, or any AI provider SDK, and a static check over all Domain_Core source files SHALL report zero such imports or references.
4. THE Domain_Core SHALL compile and its tests SHALL run in a Node environment without a DOM, and the test run SHALL exit with code 0 when no DOM global (`window`, `document`) is defined.
5. WHEN the stack factory is called with a title of 1 to 100 characters after trimming whitespace, THE Domain_Core SHALL return a new Stack with a unique `stackId`, the trimmed `title`, `formatVersion`, `createdAt` and `updatedAt` timestamps (equal to each other and to the injected clock value), exactly one initial Card, and `entryCardId` equal to that Card's identifier.
6. IF the stack factory is called with a title that is empty or whitespace-only after trimming, or longer than 100 characters after trimming, THEN THE Domain_Core SHALL reject the call with an error indicating an invalid title and SHALL NOT return a Stack.
7. WHEN a factory generates an identifier, THE Domain_Core SHALL produce an identifier that matches the identifier pattern documented in the design, and 1,000 consecutive generations with the default generator SHALL produce no duplicates.
8. THE Domain_Core SHALL accept an injected clock and identifier generator so that two factory runs with the same injected inputs produce deeply equal results.
9. THE Domain_Core SHALL represent Stacks, Cards, Elements and Assets as JSON-serializable data containing no functions, class instances or `undefined` values, such that `JSON.parse(JSON.stringify(x))` is deeply equal to `x` for every factory-produced value.
10. THE Repository SHALL record the Product Owner (`edgiaxel`) as owner of shared domain contracts in both ARCHITECTURE.md and MILESTONE.md.

### Requirement 4: Project Validation

**User Story:** As a creator, I want projects checked for structure and reference integrity, so that corrupt or inconsistent data is detected before it is used.

#### Acceptance Criteria

1. THE Project_Validator SHALL validate Stack, Card, Element and Asset data against Zod schemas that agree with the Domain_Core types.
2. WHEN a Project is valid, THE Project_Validator SHALL return a Validation_Result with zero errors.
3. IF a Project contains a required field that is missing or has the wrong type, THEN THE Project_Validator SHALL return one error for each such field, and each error SHALL include an error code, a message, and the location path of the field.
4. IF `entryCardId` or any entry in `cardOrder` references a Card that does not exist in the Stack, THEN THE Project_Validator SHALL return one error for each dangling reference, and each error SHALL identify the missing `cardId` and the location path of the reference.
5. IF `cardOrder` contains a duplicate ID, THEN THE Project_Validator SHALL return an error identifying the duplicated `cardId`.
6. IF `cardOrder` omits the `cardId` of an existing Card, THEN THE Project_Validator SHALL return an error identifying the omitted `cardId`.
7. IF two Cards in a Stack share a `cardId`, THEN THE Project_Validator SHALL return an error identifying the duplicate `cardId`.
8. IF two Elements on one Card share an `elementId`, THEN THE Project_Validator SHALL return an error identifying the duplicate `elementId` and the owning `cardId`.
9. IF an Element references an `assetId` that is not in the asset registry, THEN THE Project_Validator SHALL return an error identifying the `elementId`, the owning `cardId`, and the missing `assetId`.
10. IF an Asset `relativePath` is absolute, contains a `..` segment, contains a backslash, contains a null character, or does not begin with `assets/`, THEN THE Project_Validator SHALL return an error identifying the `assetId` and the violated path rule.
11. IF an Asset `byteSize` is negative, is not an integer, or exceeds the per-asset size limit of 26,214,400 bytes (25 MiB, proposed and to be confirmed in the design phase and recorded in ARCHITECTURE.md), THEN THE Project_Validator SHALL return an error identifying the `assetId` and the violated size rule.
12. IF an identifier does not match the documented identifier pattern, THEN THE Project_Validator SHALL return an error identifying the field and its location path.
13. THE Project_Validator SHALL return all detected errors in a single Validation_Result instead of stopping at the first error.
14. THE Project_Validator SHALL return errors in a deterministic order, so that validating the same input twice produces identical Validation_Results.
15. THE Project_Validator SHALL NOT mutate its input.
16. WHEN the input is any JSON-shaped value, including `null`, arrays, primitives, and objects nested up to 1,000 levels deep, THE Project_Validator SHALL return a Validation_Result and SHALL NOT throw.
17. FOR ALL Projects produced by the Domain_Core factories, THE Project_Validator SHALL return zero errors (invariant property).

### Requirement 5: Storage Port

**User Story:** As a developer, I want a storage interface independent of the browser, so that persistence can be swapped, faked in tests, and reused by a future desktop shell.

#### Acceptance Criteria

1. THE Storage_Port SHALL define asynchronous operations to save a Project, load a Project by `stackId`, list Project summaries, and delete a Project by `stackId`, where each summary contains exactly the stack ID, title, and `updatedAt`.
2. THE Storage_Port SHALL define asynchronous operations to save, load, and delete Asset bytes, where each Asset is identified by the pair (`stackId`, asset ID) and the bytes are returned unchanged from what was saved.
3. THE Storage_Port SHALL return every failure as a structured error containing a machine-readable code from a closed set that includes at least not-found, validation-failed, quota-exceeded, and storage-unavailable, together with a human-readable message.
4. THE Storage_Port definition SHALL NOT import browser globals or React.
5. THE Repository SHALL provide an in-memory Storage_Port implementation for tests that passes the same contract test suite as the IndexedDB_Adapter, and that suite SHALL cover every operation in criteria 1 and 2 and every error code in criterion 3 that the implementation can produce.
6. WHEN loading a `stackId` that does not exist, THE Storage_Port SHALL return a result with the not-found error code and SHALL NOT throw an exception.
7. IF a save operation fails, THEN THE Storage_Port SHALL return a structured error and SHALL leave the previously stored Project and Assets for that `stackId` unchanged.
8. WHEN a Project is deleted by `stackId`, THE Storage_Port SHALL also delete all Assets scoped to that `stackId`, so that subsequent loads of those Assets return the not-found error code.

### Requirement 6: IndexedDB Persistence

**User Story:** As a creator, I want my Stacks saved in the browser, so that they are available after I reload the page (PRD F-001, F-015).

#### Acceptance Criteria

1. THE IndexedDB_Adapter SHALL implement the Storage_Port using `idb`.
2. THE IndexedDB_Adapter SHALL use a versioned database schema with explicit upgrade handling and stores `stacks` and `assets`, keyed by project-scoped stable IDs.
3. WHEN a Project is saved, THE IndexedDB_Adapter SHALL resolve only after the IndexedDB transaction has completed.
4. WHEN a Project is saved, THE IndexedDB_Adapter SHALL validate the Project with the Project_Validator and write the Stack record and its Asset records in one transaction.
5. IF the Project_Validator returns one or more errors for a Project to be saved, THEN THE IndexedDB_Adapter SHALL reject the save with a structured error that lists the validator errors, and SHALL leave all previously stored data unchanged.
6. IF a write fails or the transaction aborts, THEN THE IndexedDB_Adapter SHALL reject the save with a structured error identifying the Project and the failure cause (including quota exceeded as a distinct cause), and SHALL leave the previously stored version of that Project unchanged, including its Asset records.
7. IF the stored data for a Project fails validation by the Project_Validator when the Project is loaded, THEN THE IndexedDB_Adapter SHALL return a structured error identifying the Project and the validator errors, and SHALL NOT modify or remove the stored data.
8. IF a requested Project does not exist when a load is requested, THEN THE IndexedDB_Adapter SHALL return a structured not-found error identifying the requested Project ID, and SHALL NOT create a record.
9. WHEN a Project that was saved is loaded after the page is reloaded, THE IndexedDB_Adapter SHALL return data equal to the saved Project, where equality is determined by comparing both Projects after normalization (a defined, deterministic ordering of collections and omission of volatile fields), and Asset binary content SHALL be byte-identical.
10. IF IndexedDB is unavailable or blocked when the GhostStack_App starts or when a save is attempted, THEN THE GhostStack_App SHALL display a visible message stating that projects cannot be saved in this browser session, SHALL keep the Workspace_Shell usable, and SHALL NOT report any save as successful.
11. IF the stored database version is newer than the version the GhostStack_App supports, THEN THE IndexedDB_Adapter SHALL return a structured error stating that the stored version is unsupported, and SHALL NOT downgrade, modify, or delete the database.
12. WHERE the browser supports `navigator.storage.persist`, THE GhostStack_App MAY request persistent storage; IF the request is denied or the API is unsupported, THEN THE GhostStack_App SHALL continue to load, edit and save Projects without displaying an error.
13. THE IndexedDB_Adapter SHALL store no API keys, tokens or credentials.

### Requirement 7: Preferences Store

**User Story:** As a creator, I want my interface preferences remembered, so that the workspace opens as I left it.

#### Acceptance Criteria

1. THE Preferences_Store SHALL use `localStorage` only for theme, panel sizes, panel visibility and last opened project ID.
2. THE Preferences_Store SHALL NOT store Project data, Asset bytes, or credentials.
3. WHEN the Workspace_Shell starts, THE Preferences_Store SHALL read the stored theme, panel sizes, panel visibility and last opened project ID and SHALL apply them before the first Workspace_Shell render completes.
4. WHEN a theme, panel size, panel visibility or last opened project ID value changes, THE Preferences_Store SHALL write the new value to `localStorage` within 500 ms of the change.
5. IF a stored preference value is missing, malformed or fails validation, THEN THE Preferences_Store SHALL return the documented default value for that preference, SHALL leave the other preferences unchanged, and SHALL NOT display an error to the creator.
6. IF `localStorage` is unavailable, throws on read, or throws on write (including quota exceeded), THEN THE Preferences_Store SHALL return the documented defaults for reads, SHALL keep the changed preference in memory for the current session, and SHALL NOT interrupt rendering of the Workspace_Shell.
7. IF the last opened project ID refers to a Project that no longer exists, THEN THE GhostStack_App SHALL open the Project Library and SHALL reset the stored last opened project ID to its documented default.

### Requirement 8: GSP Archive Format Definition

**User Story:** As a creator, I want a versioned, portable project format, so that I can move projects between sessions and implementations (PRD F-018).

#### Acceptance Criteria

1. THE GSP_Format SHALL define an archive containing exactly one `manifest.json`, exactly one `stack.json`, zero or more `cards/<cardId>.json` entries, and zero or more `assets/<file>` entries, where each `<cardId>` matches the `cardId` of the Card stored in that entry, and the total entry count is bounded by the limit in Requirement 10.
2. THE Manifest SHALL contain a format version identifier, the identifier of the producing application, the `stackId`, and, for each Asset, its `assetId`, `relativePath`, `mimeType`, `byteSize` (integer from 0 to 26,214,400 bytes) and `checksum`, where the checksum value is paired with a named checksum algorithm.
3. THE GSP_Format SHALL define the format version using a documented scheme and SHALL define the set of versions the GSP_Importer supports.
4. THE GSP_Format SHALL define JSON schemas, implemented in Zod, for Manifest, `stack.json` and each Card entry, and the GSP_Format module SHALL be independent of React and editor UI code.
5. THE GSP_Format SHALL exclude API keys, tokens, credentials, provider configuration and preferences from every archive entry.
6. THE Repository SHALL document the GSP_Format layout and version in ARCHITECTURE.md.
7. THE Repository SHALL select a ZIP library, record the candidates evaluated (at least two), the selection rationale (including bundle size, maintenance status, license compatibility with Apache-2.0, support for browsers and Node-based tests, and safe-extraction capability) and the verified version in ARCHITECTURE.md before the library is added.
8. IF an archive entry path is absolute, contains a `..` segment, contains a backslash, or lies outside the `manifest.json`, `stack.json`, `cards/` and `assets/` locations, THEN THE GSP_Format SHALL treat the archive as invalid, and THE GSP_Importer SHALL reject it with an error indicating an unsafe or unrecognized entry path, leaving the active project unchanged.
9. IF the Manifest references an Asset whose entry is absent from `assets/`, or whose `byteSize` or `checksum` does not match the stored entry, THEN THE GSP_Importer SHALL reject the archive with an error identifying the affected `assetId`, leaving the active project unchanged.
10. IF the Manifest format version is not in the set of versions the GSP_Importer supports, THEN THE GSP_Importer SHALL reject the archive with an error indicating the unsupported version and the supported versions, leaving the active project unchanged.

### Requirement 9: GSP Serialization

**User Story:** As a creator, I want to export a project to a `.gsp` file, so that I can back it up and move it (PRD F-018, F-019).

#### Acceptance Criteria

1. WHEN serialization is requested for a Project, THE GSP_Serializer SHALL run the Project_Validator before creating any archive entry.
2. IF the Project_Validator result contains one or more errors, THEN THE GSP_Serializer SHALL return a structured error containing the validator errors, SHALL NOT produce an archive, and SHALL leave the input Project unmodified.
3. WHEN serialization succeeds, THE GSP_Serializer SHALL produce a ZIP archive containing exactly the Manifest, `stack.json`, one `cards/<cardId>.json` entry per Card, and one `assets/` entry per registered Asset, with no other entries.
4. WHEN serialization succeeds, THE GSP_Serializer SHALL compute a checksum of each Asset from the Asset bytes and record the checksum in the Manifest entry for that Asset.
5. IF a registered Asset has no bytes available, THEN THE GSP_Serializer SHALL return a structured error identifying the `assetId`, SHALL NOT produce a partial archive, and SHALL leave the input Project unmodified.
6. WHEN serialization is requested twice with identical input Projects and the same fixed clock value, THE GSP_Serializer SHALL produce archives whose entry names, entry order, and entry content bytes are identical.
7. WHEN serialization succeeds, THE GSP_Serializer SHALL reopen the produced archive with the GSP_Importer and validate it before returning it.
8. IF the GSP_Importer reopen-and-validate step reports any error, THEN THE GSP_Serializer SHALL return a structured error containing the importer errors and SHALL NOT return the archive.

### Requirement 10: GSP Import and Untrusted-Input Handling

**User Story:** As a creator, I want malformed or hostile `.gsp` files rejected safely, so that importing a file cannot corrupt or compromise my workspace (PRD F-018, UI-01 invalid-file states).

#### Acceptance Criteria

1. WHEN archive bytes are provided, THE GSP_Importer SHALL parse and validate the Manifest before reading the contents of any other entry.
2. IF the Manifest is missing, is not valid JSON, or fails schema validation, THEN THE GSP_Importer SHALL return an error with code `PROJECT_IMPORT_FAILED` and a message naming which of the three causes occurred, and SHALL NOT produce a Project.
3. IF the archive format version is not in the supported set, whether newer or older, THEN THE GSP_Importer SHALL return an unsupported-version error stating the archive version and the supported versions, and SHALL NOT produce a Project.
4. IF the input bytes are not a valid ZIP archive (including empty input, truncated archives, and corrupt central directories), THEN THE GSP_Importer SHALL return an error with code `PROJECT_IMPORT_FAILED` and SHALL NOT produce a Project.
5. IF any entry name is absolute, contains a `..` segment, contains a backslash, contains a null character, or is not `manifest.json`, `stack.json`, or located under `cards/` or `assets/`, THEN THE GSP_Importer SHALL reject the whole archive with code `PROJECT_IMPORT_FAILED`, identify the offending entry name, and SHALL NOT produce a Project.
6. IF the archive exceeds any of the following limits, THEN THE GSP_Importer SHALL reject the archive with code `PROJECT_IMPORT_FAILED` naming the exceeded limit, and SHALL stop decompressing the offending entry once its limit is exceeded: 50 MiB compressed archive size, 25 MiB per uncompressed entry, 100 MiB total uncompressed size, and 1000 entries. These limits are proposed and require owner approval in `ARCHITECTURE.md` before implementation.
7. IF the declared uncompressed size of an entry differs from its actual decompressed size, or the compression ratio of an entry exceeds the documented maximum ratio (proposed: 100:1), THEN THE GSP_Importer SHALL reject the archive with code `PROJECT_IMPORT_FAILED` and identify the entry name. The maximum ratio requires owner approval and documentation in `ARCHITECTURE.md`.
8. IF an Asset checksum in the Manifest does not match the checksum computed from the Asset bytes, THEN THE GSP_Importer SHALL reject the archive with code `PROJECT_IMPORT_FAILED` and identify the `assetId`.
9. IF the Manifest lists an Asset whose entry is absent from the archive, or the archive contains an `assets/` entry not listed in the Manifest, THEN THE GSP_Importer SHALL reject the archive with code `PROJECT_IMPORT_FAILED` and identify the Asset or entry name.
10. IF a Card entry referenced by `stack.json` is missing from the archive, or a Card entry under `cards/` is not referenced by `stack.json`, THEN THE GSP_Importer SHALL reject the archive with code `PROJECT_IMPORT_FAILED` and identify the Card entry.
11. WHEN all entries are parsed, THE GSP_Importer SHALL assemble the Project and run the Project_Validator.
12. IF the Project_Validator result contains one or more errors, THEN THE GSP_Importer SHALL reject the archive with code `PROJECT_IMPORT_FAILED` and include the validation errors in the returned error.
13. THE GSP_Importer SHALL treat all archive content as data, and SHALL NOT evaluate any archive content as JavaScript or HTML.
14. WHEN import succeeds, THE GSP_Importer SHALL return the Project with a `stackId` that differs from the `stackId` of every Project currently in local storage, and SHALL NOT overwrite or modify any existing stored Project.
15. IF import fails for any reason, THEN THE GhostStack_App SHALL leave all stored Projects and the active Project unchanged and SHALL display an error indicating the failure cause.
16. THE GSP_Importer SHALL return every failure as a structured error containing a code and a message, and SHALL NOT throw an unstructured exception for any byte input, including empty input, truncated archives, and random bytes.

### Requirement 11: GSP Round-Trip Verification

**User Story:** As a developer, I want the project format proven by round-trip tests, so that export and import do not lose supported data.

#### Acceptance Criteria

1. FOR ALL valid Projects generated by fast-check, with a minimum of 100 generated cases per run, THE GSP_Importer applied to the output of the GSP_Serializer SHALL produce a Project deeply equal to the original in every field, except that `stackId` MAY differ only when a collision with an existing Project exists, in which case the imported `stackId` SHALL be a newly generated value that differs from the original (round-trip property).
2. THE GSP_Format test suite SHALL include a fixture Project with at least three Cards and at least two Assets, including one Asset of zero bytes, and SHALL verify that the imported Project is deeply equal to the fixture and that each imported Asset's bytes are identical to the original bytes, including the zero-byte Asset having length 0.
3. THE GSP_Format test suite SHALL include at least one fixture for each failure condition defined in Requirement 10, including path traversal entries, an unsupported version, a checksum mismatch, a missing Card entry, a truncated archive and an oversized entry, and SHALL verify that the GSP_Importer returns a structured error identifying the failure category for each fixture without throwing.
4. IF the GSP_Importer rejects a fixture archive, THEN THE GSP_Format test suite SHALL verify that no Project is returned and that the active Project and persisted state used by the test remain unchanged.
5. FOR ALL valid Projects generated by fast-check, with a minimum of 100 generated cases per run, serializing, importing, then serializing again SHALL produce Manifest content and `stack.json` content byte-for-byte equal to the first serialization, excluding any Manifest field that records export time or a regenerated `stackId` (idempotence property).
6. FOR ALL archives generated by fast-check from valid Projects with exactly one byte flipped at a random offset, with a minimum of 100 generated cases per run, THE GSP_Importer SHALL return either a Project that passes the Project_Validator or a structured error, and SHALL NOT throw an exception (error-condition property).
7. THE GSP_Format tests SHALL run in the Node-based test environment without a DOM and SHALL complete without any network access.

### Requirement 12: Project Library and Stack Creation (UI-01, F-001)

**User Story:** As a creator, I want to create a Stack and see it in a library, so that I can start a project and find it again (PRD F-001, DESIGN UI-01).

#### Acceptance Criteria

1. WHEN the GhostStack_App starts and the Storage_Port reports zero stored Projects, THE Workspace_Shell SHALL display the Project Library empty state with a visible Create Project action and SHALL NOT display a Project list.
2. WHEN the creator submits a Stack title that contains 1 to 100 characters after leading and trailing whitespace is trimmed through the Create Project action, THE GhostStack_App SHALL create a Stack through the Domain_Core factory with the trimmed title, save it through the Storage_Port, and open the Stack Workspace for it within 2 seconds.
3. IF the submitted Stack title is empty, consists only of whitespace, or exceeds 100 characters after trimming, THEN THE GhostStack_App SHALL display an error message beside the title field indicating the title requirement that failed, SHALL NOT create or save a Stack, and SHALL retain the entered title text in the field.
4. WHEN Projects are stored, THE Project Library SHALL list each Project's title and last modification time, ordered by `updatedAt` descending, and SHALL order Projects with equal `updatedAt` values by title in ascending alphabetical order.
5. WHEN the creator selects a Project in the Project Library, THE GhostStack_App SHALL load it from the Storage_Port and open the Stack Workspace for it within 2 seconds.
6. IF a stored Project fails to load or validate, THEN THE Project Library SHALL show that Project as unavailable with an error message indicating that it could not be loaded, SHALL NOT open the Stack Workspace for it, SHALL NOT modify or delete the stored data, and SHALL keep all other Projects listed and selectable.
7. WHEN the page is reloaded, THE GhostStack_App SHALL list all previously saved Projects and SHALL open each of them with its saved title and Card list unchanged.
8. IF saving a newly created Stack fails, THEN THE GhostStack_App SHALL display an error message indicating that the Stack was not saved, SHALL NOT open the Stack Workspace, SHALL NOT add the Stack to the Project Library list, and SHALL retain the entered title in the Create Project field so the creator can retry.
9. THE Project Library SHALL NOT require sign-in or an account.
10. THE Project Library SHALL either omit import, rename and delete actions or display them as disabled with a label indicating they are not available in this slice, and SHALL NOT present any non-functional action as enabled.

### Requirement 13: Stack Workspace Shell (UI-02)

**User Story:** As a creator, I want a workspace shell showing my Stack, so that I can confirm it was created and persisted (PRD F-001, DESIGN UI-02).

#### Acceptance Criteria

1. WHEN a Stack is opened, THE Workspace_Shell SHALL display the Stack title and a Card navigation list containing one entry for each Card in the Stack, ordered exactly as the Card IDs appear in `cardOrder`.
2. IF the Stack title is an empty string, THEN THE Workspace_Shell SHALL display a visible placeholder label in place of the title and SHALL NOT modify the stored title.
3. WHEN a Stack is opened, THE Workspace_Shell SHALL display a persistence status that shows exactly one of two states, Saved or Save failed, as determined by the result of the most recent save operation on the Storage_Port.
4. IF a save operation fails, THEN THE Workspace_Shell SHALL change the persistence status to Save failed within 1 second of the failure being reported, SHALL display an error message indicating that the Project was not saved, and SHALL retain the in-memory Project state unchanged.
5. WHEN the creator activates the return action, THE Workspace_Shell SHALL navigate to the Project Library within 1 second.
6. THE Workspace_Shell SHALL render regions for the Card canvas, inspector, and elements toolbox as labeled non-interactive placeholders, and SHALL NOT provide element editing, behavior editing, AI, preview, or export controls.
7. WHILE a Project is loading from the Storage_Port, THE Workspace_Shell SHALL display a loading indicator and SHALL NOT display the Stack title, Card navigation list, or persistence status.
8. IF loading a Project from the Storage_Port fails or the Project is not found, THEN THE Workspace_Shell SHALL remove the loading indicator, display an error message indicating the Project could not be opened, and provide the return action to the Project Library.
9. THE Workspace_Shell SHALL make every interactive control reachable by keyboard Tab navigation, SHALL display a visible focus indicator on the focused control, and SHALL provide a non-empty accessible name for each interactive control.
10. THE Workspace_Shell SHALL render without horizontal page scrolling at every viewport width from 1024 px to 3840 px inclusive.

### Requirement 14: Spectral Workstation Theme

**User Story:** As a creator, I want the default Spectral Workstation look, so that the editor has its intended visual identity (DESIGN DQ-010).

#### Acceptance Criteria

1. THE Theme_System SHALL define Spectral Workstation as CSS custom properties with base `#111017`, panels `#191724`, text `#F4F3F8`, primary accent `#FF6B2B`, and secondary accent `#9D6BFF`.
2. THE Theme_System SHALL apply Inter to all interface text and JetBrains Mono to all code and monospace text in the editor.
3. THE Theme_System SHALL load Inter and JetBrains Mono from files bundled with the GhostStack_App, and SHALL NOT issue any network request to an external host for fonts at runtime.
4. THE Theme_System SHALL keep the contrast ratio between text `#F4F3F8` and base `#111017`, and between text `#F4F3F8` and panels `#191724`, at 4.5:1 or higher, and an automated test SHALL compute both ratios from the defined custom property values and fail if either is below 4.5:1.
5. IF a bundled font file fails to load within 3000 ms, THEN THE Theme_System SHALL render text with the system sans-serif font in place of Inter or the system monospace font in place of JetBrains Mono, and SHALL keep every editor region visible, with no overlapping text and no horizontal scrollbar introduced at a 1280 px viewport width.
6. THE Theme_System SHALL NOT implement the Studio Paper theme, the Midnight Terminal theme, or a theme switcher in this slice.
7. THE Theme_System SHALL scope theme custom properties and styles to the editor, SHALL NOT apply them to the authored-application preview or exported-application content, and SHALL define them under names that do not collide with authored-application styling.

### Requirement 15: Licensing, Ownership and Documentation

**User Story:** As the Product Owner, I want licensing, ownership and verified commands recorded, so that the repository meets submission requirements and documentation matches reality.

#### Acceptance Criteria

1. THE Repository SHALL contain a `LICENSE` file at the repository root whose text is the unmodified, complete Apache License 2.0 text as published by the Apache Software Foundation, with no added, removed or reworded lines.
2. THE Repository SHALL declare the SPDX identifier `Apache-2.0` in the license field of the root `package.json` and in a license section of README.md that names Apache License 2.0 and references the `LICENSE` file.
3. WHEN the slice is complete, THE README.md SHALL list each setup and run command it documents, and each listed command SHALL be a Verified_Command that was executed from a clean checkout and exited with code 0.
4. WHEN the slice is complete, THE ARCHITECTURE.md command table SHALL mark a command as verified only if it was run and exited with code 0, and SHALL keep every command that was not run, or that failed, marked as not yet verified.
5. WHEN the slice is complete, THE ARCHITECTURE.md SHALL record each of the following: the selected ZIP library with its rationale, the GSP_Format version and layout, the identifier pattern, the size limits (each stated as a number with its unit), and every dependency added in the slice with the reason it was added.
6. WHEN the slice is complete, THE MILESTONE.md SHALL mark an M1 item as complete only if its acceptance criteria were verified, SHALL leave all other M1 items unmarked, and SHALL record the license decision (Apache-2.0) and the named owner of the shared contract.
7. WHEN the slice is complete, THE CHANGELOG.md SHALL contain one new entry, dated with the completion date, that lists the completed foundation changes.
8. THE Repository SHALL contain no credentials, API keys or tokens in source, fixtures, logs, documentation or build output.
9. IF a secret scan of the tracked files and build output finds a credential, API key or token, THEN THE Repository SHALL be treated as failing this requirement, and the slice SHALL NOT be marked complete until the finding is removed and the scan is re-run with zero findings.
10. IF a command listed in README.md or marked verified in ARCHITECTURE.md fails or cannot be run when re-executed, THEN THE documentation SHALL be corrected to mark that command as not yet verified before the slice is marked complete.

### Requirement 16: Milestone Verification

**User Story:** As the Product Owner, I want the M1 exit criteria demonstrated with evidence, so that the milestone is closed on facts.

#### Acceptance Criteria

1. WHEN verification is performed, THE Verification_Report SHALL list every M1 exit criterion defined in MILESTONE.md, and each entry SHALL state one status (Passed, Failed, Skipped or Not_Available) and the exact command or numbered manual step used to determine it.
2. WHEN verification is performed on a clean checkout after `npm ci` or the documented install command, THE Toolchain SHALL run lint, format check, type check, unit tests and production build in a single run, and THE Verification_Report SHALL record the exit code of each of the five checks, with Passed meaning exit code 0.
3. IF any of the five Toolchain checks exits with a non-zero code, THEN THE Verification_Report SHALL mark that check Failed, include the name of the failing check and the first failing file or test, and mark the M1 milestone as not closed.
4. WHEN verification is performed, THE Verification_Report SHALL show a manual browser check with these numbered steps: create a Stack with a known title, confirm it contains one Card, reload the page, confirm the Stack appears in the Project Library with that exact title, open it, and confirm the saved title and the Card are displayed.
5. WHEN verification is performed, THE Verification_Report SHALL record the browser name and version used for the manual browser check and the pass or fail result of each numbered step.
6. WHEN verification is performed, THE Verification_Report SHALL show that the Domain_Core, GSP_Format and Storage_Port packages each complete type-check and unit tests with exit code 0, that none of their package manifests lists React or a DOM library as a dependency, and that their tests run in a non-DOM test environment.
7. WHEN verification is performed, THE Verification_Report SHALL list every check that was skipped, failed or not available (for example end-to-end tests and CI), each with its status and reason, and SHALL NOT mark any such check as Passed.
8. WHEN verification is performed, THE Verification_Report SHALL confirm, from a search of the diff against the pre-M1 baseline, that no AI, MCP, behavior, canvas editing, preview or export code was added, and SHALL list the search terms or commands used.
9. WHEN verification is performed, THE Verification_Report SHALL record the diff review result, listing each changed file that is not attributable to an M1 requirement (or stating "none found") and the result of a secrets scan of the diff (or stating that no scan tool was available).

## Traceability

| Requirement | PRD feature | DESIGN / ARCHITECTURE | M1 exit criterion |
|---|---|---|---|
| 1, 2 | Constraints | ARCH 2, 9, 10 | App runs; lint, typecheck, tests, build work |
| 3 | F-001 | ARCH 6.1, T-004 | Domain types usable independently of React |
| 4 | F-001, F-018, F-019 | ARCH 6, 8 | Domain types usable independently of React |
| 5, 6 | F-001, F-015 | ARCH 6.4, T-005 | Stack persisted; loads after reload |
| 7 | F-015 | ARCH 6.4 | Stack persisted; loads after reload |
| 8, 9, 10, 11 | F-018, F-019 | ARCH 4.5, 6.3, 8.1, T-006 | Tested initial format round-trip |
| 12 | F-001 | UI-01 | Stack created and persisted |
| 13 | F-001 | UI-02 | Project loads after reload |
| 14 | Constraints | DQ-010, theme spec | App runs |
| 15 | Constraints | ARCH 9, 15 | Documentation accuracy |
| 16 | All above | AGENTS.md completion standard | All |
