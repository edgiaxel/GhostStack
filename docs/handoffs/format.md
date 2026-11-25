# HANDOFF — format (VS-06)

1. **Files touched**: `packages/project-format/src/{gsp.ts,sha256.ts,index.ts,gsp.test.ts}`.
2. **Exports** (`@ghoststack/project-format`): `exportGsp(stack, assets?) -> Result<Uint8Array>`, `importGsp(bytes) -> Result<{stack, assets}>`, `GSP_LIMITS`, `sha256Hex`. `assets` is keyed by `assetId`.
3. **Requested changes**: add `"zod": "^4.6.7"` to `packages/project-format/package.json` dependencies (imported directly; resolves today only via hoisting) and refresh the lockfile. No other changes.
4. **Caveats**
   - Layout: `manifest.json` {formatVersion, stackId, title, cards[{cardId,path}], assets[{...Asset, path}]}, `stack.json` (Stack minus `cards`), `cards/<cardId>.json`, `assets/<relativePath>`. Card order = `cardOrder`.
   - SHA-256 is a small pure-TS implementation (`sha256.ts`): `lib` has no DOM and `types` is empty, so `crypto.subtle` is not typed. Synchronous, tested against known vectors.
   - Missing assets: no warning channel. Registered asset with no file on import returns `ASSET_MISSING`. Unlisted extra files, checksum/byteSize mismatch, and manifest/stack.json disagreement return `PROJECT_IMPORT_FAILED`. Export returns `ASSET_MISSING` if bytes are not supplied, `PROJECT_EXPORT_FAILED` if they do not match the registry. Export re-imports its output before returning.
   - Limits: 5000 entries, 64 MiB per entry, 256 MiB total, 8 MiB per JSON. Size checks use the ZIP header's declared size before inflating, and actual sizes are re-checked after. A forged header is not a hard memory guarantee.
   - Entry names rejected: leading `/`, `\`, `:`, control chars, empty/`.`/`..` segments, duplicates. Only format version 1 is accepted (no migrations).
   - Export mtime is fixed so output is deterministic.
5. **Next step needs**: library UI can wire import/export buttons. Importing as a new workspace (new id on collision) is the caller's job.
6. **Commands run (in worktree)**: `npm run typecheck`, `npm run lint`, `npm test` (30 passed), `npm run format:check`, `npm run build`: all passed.
