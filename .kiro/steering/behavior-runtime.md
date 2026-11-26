---
inclusion: fileMatch
fileMatchPattern: "packages/behavior/**"
---

# GhostStack: Behavior AST and Runtime (loaded when editing `packages/behavior`)

- The AST in `packages/shared-contracts/src/behavior.ts` is closed: triggers, actions and expression kinds are a fixed set. Adding one means changing the contract, the domain checks, the runtime, the GhostScript parser and printer, and the block editor together. Only the orchestrator edits the contract.
- Never use `eval`, `new Function`, dynamic `import()` of project data, or string-built code. The `guard-writes` hook and the ESLint rules both reject it.
- The runtime is pure and deterministic: no DOM, no timers, no I/O. It never throws for a Stack that passed `validateStack`; problems go to `snapshot.errors`, capped, and never change the Stack.
- Keep the limits (`LIMITS`) so a loop cannot hang the preview.
- GhostScript and blocks must stay interchangeable: for every valid AST `parse(print(ast))` equals `ast`. Keep the `fast-check` round-trip property green when the grammar changes.
- Preview and the standalone export call the same runtime. Do not fork behavior for one of them.
- Document grammar changes in `packages/behavior/GHOSTSCRIPT.md`.
