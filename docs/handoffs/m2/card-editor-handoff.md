# HANDOFF: card-editor

1. Files: `apps/web/src/features/card-editor/**` (CardCanvas, Inspector, ElementView, fields, geometry, css, tests), `tests/e2e/m2-card-editor.spec.ts`. Contract edits by the orchestrator: `RENDER_DEFAULTS` in `shared-contracts/src/elements.ts`, `null` removes a property in `UPDATE_ELEMENT` (domain + test).
2. Exports: `CardEditorCanvas`, `CardInspector`, `inZOrder`.
3. Contract changes: see above. No new dependencies.
4. Caveats: editing (add, move, resize) is enabled only at the design viewport (Desktop 1280x720). Other presets preview anchoring. Pointer drag dispatches on every move; undo coalesces by `move:<id>`. Selection follows focus. Hidden elements show dimmed.
5. Next: preview and export must use `resolveLayout` and `RENDER_DEFAULTS`.
6. Commands: typecheck, lint, vitest, Playwright on port 5181 (5 specs passed).