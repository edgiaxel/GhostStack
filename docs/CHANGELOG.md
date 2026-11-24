# Changelog

Notable completed changes to GhostStack are documented here.

This file records completed work only. Do not list planned features or unverified activity.

## [Unreleased]

### Added

- M1 foundation (2026-11-16), checked in `docs/M1-VERIFICATION.md`:
  - npm workspaces with `apps/web` (React, TypeScript, Vite) and the packages `@ghoststack/domain`, `@ghoststack/storage` and `@ghoststack/project-format`.
  - Stack, Card, Element and Asset schemas with validation, independent of React and the DOM.
  - IndexedDB storage behind a storage interface, with an in-memory implementation for tests.
  - `.gsp` project archive format version 1 with a tested serialize and import round-trip.
  - Project Library and Stack workspace shell with the Spectral Workstation theme and locally bundled fonts.
  - Service worker that caches the built app shell so the production build reloads offline.
  - Lint, format check, type check, test (62 files, 539 tests) and build scripts.
  - Apache License 2.0.
- M2 AI feasibility spike (2026-11-23), report in `docs/M2-FEASIBILITY.md`:
  - `@ghoststack/ai-core`: `AIPlan` schema and seven patch commands, plan application on an isolated copy, a transaction manager with checkpoints, atomic commit, whole-operation rollback and crash recovery, a provider contract with a no-silent-fallback privacy gate, plan review, and an offline demo adapter.
  - Durable AI checkpoints: IndexedDB database version 2 with a `checkpoints` store and a tested upgrade from version 1.
  - Spikes (throwaway until promoted in M4): OpenAI-compatible and Ollama adapters, an MCP server with six tools over stdio and loopback HTTP, separate agent and editor tokens, and a browser probe page.
  - `npm run scan:secrets`, `npm run spike:demo`, and opt-in `npm run spike:openrouter`.
  - Tests: 729 passed, 1 skipped (live OpenRouter, opt-in).

### Changed

-

### Fixed

-

### Removed

-

## [0.1.0] — YYYY-MM-DD

Initial public release.

### Added

-

### Changed

-

### Fixed

-
