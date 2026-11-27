# Changelog

Notable completed changes to GhostStack are documented here.

This file records completed work only. Do not list planned features or unverified activity.

## [Unreleased]

### Added
- M3.0 to M3.5: AI plan contract and command allowlist; `ai-core` (plan parsing, dry run, summary, context, transaction with checkpoint and revert); `ai-providers` (offline demo, Ollama, OpenAI-compatible); AI panel with provider settings, consent, review, approve, progress, report and revert; MCP server (stdio plus loopback WebSocket bridge) with six tools and an approval queue. Provider and MCP paths were run against local test servers only.
- M2.1: tokens v2, five accent presets (AA checked in tests), generated brand, 16-component kit, `/design` gallery.
- M2.2: menu bar, tool rail, status bar, resizable and collapsible panels, console drawer, canvas zoom and pan, shortcut sheet.
- M2.3: tabbed inspector, 3 by 3 anchor picker, color swatches, card background and reference frame size.
- M2.4: library grid with thumbnails, search, sort, duplicate; five user-started templates; navigator thumbnails and drag reorder.
- M2.5: multi-select, copy and paste, duplicate, align, distribute, snap guides, in-place text edit, asset manager, orphan-free exports.
- M2.6: new elements scale by default, Fit preview, `Card.background` in player and export.
- M2.7: list state, list actions and expressions, next and previous card, GhostScript names and error lines, sentence blocks.
- M2.8 (part): GitHub Actions CI file, axe scan, path-safe id validation, split bundle with a budget check.

- M1 foundation: React + Vite web app with shared shell, hash router, three editor themes.
- Shared contracts (zod Stack model, commands, storage port) and pure domain commands for Stacks and Cards.
- IndexedDB Stack repository with validation on save.
- `.gsp` export and import library with checksum and path-traversal checks.
- Project Library and Card navigator screens.
- Vitest unit tests and a Playwright end-to-end flow.
- Apache-2.0 license.
- M2 core creation workflow, without AI: card editor (canvas, six element types, inspector, z-order, anchoring and scaling, viewport switcher, image upload with missing-file fallback).
- Canonical behavior AST, safe runtime, GhostScript parser and printer, visual action-stack editor and CodeMirror 6 script editor over the same AST.
- Editing session with undo and redo, debounced autosave, crash recovery and checkpoints.
- Preview, standalone web export (zip, runs from file://), .gsp export and import with integrity checks.
- IndexedDB v2 (assets, checkpoints) and domain integrity validation of references.
- Post-M2 audit report (`docs/AUDIT-M2.md`) with screenshots and 24 new end-to-end flows covering library, cards, elements, behavior, recovery, exports, theme contrast and layout at 390, 768 and 1024 px.

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
