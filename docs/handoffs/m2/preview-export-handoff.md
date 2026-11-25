# HANDOFF: preview-export

1. Files: `packages/player/**` (player, standalone entry, tests), `packages/project-format/**` (domain integrity checks, `exportWebApp`, tests), `apps/web/src/features/{preview,export}/**`, `apps/web/src/features/project-library/index.tsx` (mounts `ImportGspButton`), `apps/web/package.json` (+ `@ghoststack/project-format`), `tests/e2e/m2-preview-export.spec.ts`. Orchestrator additions: `resolveFontScale` in `shared-contracts/src/layout.ts`.
2. Exports: `mountPlayer`, `boot`, `assetUrl`, `exportWebApp`, `renderIndexHtml`, `jsonForScript`, `PreviewPage`, `ExportMenu`, `ImportGspButton`, `importGspBytes`, `safeFileName`.
3. Contract changes: `exportGsp` and `importGsp` now run `validateStack`; archives with dangling references or invalid element properties are rejected.
4. Caveats: card ids must be path-safe for `.gsp` (UI ids are UUIDs). The standalone bundle includes zod through `shared-contracts`. Web export needs `/player.standalone.js` (built by `npm run build:player`, run by `npm run dev` and `npm run build`). `.gsp` export refuses when image bytes are missing; web export continues with placeholders and lists them.
5. Next: end-to-end check of behavior inside the exported page.
6. Commands: typecheck, lint, vitest, Playwright on port 5184 (passed).