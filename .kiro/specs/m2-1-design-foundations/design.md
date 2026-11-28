# Design: M2.1 Design foundations

- Tokens v2 in `themes/tokens.css`: spacing `--gs-space-*`, type scale `--gs-text-*`, radius, elevation, motion, `--gs-border-strong`, status colors. Existing variable names are kept.
- Accents: `[data-accent='x']` blocks for dark themes, `[data-theme='paper'][data-accent='x']` overrides. No attribute or `default` keeps the theme native accent.
- `themes/contrast.ts` holds the ratio helper. `themes/tokens.test.ts` parses `tokens.css`, resolves each pair and checks P1.
- `app/theme.ts` gains `ACCENTS`, `loadAccent`, `applyAccent` (localStorage `gs.accent`, interface preference only).
- Brand: `scripts/brand/generate.mjs` exports `generateBrand()` (pure) and writes `apps/web/public/brand/` when run. Mark: a ghost silhouette on a card outline, using currentColor so it follows the theme.
- Kit: plain React components on `gs-*` classes, CSS in `components/kit.css` (prefix `gs-kit-`). Dialog uses the native `<dialog>`; Menu and Tabs follow the ARIA patterns with roving focus.
- Gallery `/design`: renders the kit with live state only (no data).
- Why no bundled font: adding one needs a dependency. Requested in HANDOFF.
