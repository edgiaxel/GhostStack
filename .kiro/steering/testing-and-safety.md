---
inclusion: auto
name: testing-and-safety
description: Use when adding or changing tests, project persistence, import/export, behavior execution, AI planning or transactions, MCP integration, security boundaries, or recovery logic.
---

# GhostStack — Testing and Safety Rules

## General

- Test observable behavior and invariants, not implementation details alone.
- Include failure and edge cases for every persistence or mutation path.
- Keep test fixtures deterministic where possible.
- Do not weaken or delete a test merely to make a change pass.

## High-Value Invariants

As applicable to the implemented slice, test that:

- Invalid imported archives are rejected before the active workspace changes.
- Every referenced card and asset exists or is represented by an explicit supported missing-asset state.
- Visual blocks and GhostScript produce equivalent canonical AST data.
- The behavior runtime only executes registered actions and supported expressions.
- A failed AI patch batch leaves the active project unchanged.
- A successful AI batch is committed atomically only after validation.
- A whole-operation rollback restores the pre-operation project state.
- A project can be exported and imported without losing its supported data.
- Core editing, save/load, preview, and export remain usable with no AI provider, API key, MCP client, or internet.

## Security

Treat imported `.gsp` archives, assets, behavior source, AI responses, provider responses, and MCP requests as untrusted.

- Validate schemas, sizes, paths, identifiers, and references.
- Prevent path traversal and unsafe archive extraction.
- Do not execute project content as JavaScript.
- Keep API keys out of project files and exported apps.
- Make local/cloud provider selection explicit.
- Do not silently transmit local project content to a cloud provider.
- Keep local MCP bridges loopback-only with explicit authentication and origin validation if/when implemented.
- Apply least-privilege filesystem permissions in the desktop shell.

## Verification Discipline

Use the repository's actual scripts and test setup. If a test category is not configured yet, report it as not available rather than inventing a command.
