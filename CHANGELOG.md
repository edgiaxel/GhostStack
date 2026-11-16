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
