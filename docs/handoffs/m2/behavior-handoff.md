# HANDOFF: behavior

1. Files: `packages/behavior/**` (runtime, ghostscript, tests, GHOSTSCRIPT.md), `apps/web/src/features/behavior-editor/**`, `tests/e2e/m2-behavior.spec.ts`, `apps/web/package.json` (+ `@codemirror/autocomplete`, `@lezer/highlight`).
2. Exports: `createRuntime`, `evaluate`, `LIMITS`, `parseGhostScript`, `printGhostScript`, `KEYWORDS`, `TRIGGER_NAMES`, `BehaviorEditorPanel`.
3. Contract changes: none. New deps are part of the CodeMirror 6 stack.
4. Caveats: the editor needs a selected element for element behaviors; selection comes from the card editor. The e2e covers card behaviors only. Script diagnostics from domain rejections are reported at line 1.
5. Next: wire preview to `createRuntime` (preview-export).
6. Commands: typecheck, lint, vitest (39 package tests, 8 editor tests), Playwright on port 5182 (passed).