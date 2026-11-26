# Requirements: M2.1 Design foundations

Closes U5 (border contrast), U6 (identity), U16 (type scale). Scope: `docs/handoffs/m2x/README.md` "design-system".

1. WHEN any theme and accent pair is active, THE tokens SHALL give text 4.5:1, control borders and focus 3:1, and the primary accent 3:1 against page and panel, with `on-accent` text at 4.5:1 on the accent.
2. THE accent presets (at least 5) SHALL be selectable with `data-accent` on `<html>`, independent of `data-theme`, and persisted as the interface preference `gs.accent`.
3. WHEN the brand generator runs twice, THE output files SHALL be byte-identical.
4. THE AppShell SHALL show the generated mark and wordmark.
5. THE kit in `apps/web/src/components/` SHALL provide Button, IconButton, Field, NumberField, Select, Tabs, Menu, Dialog, Tooltip, Panel, Toolbar, Toast, EmptyState, Swatch, Kbd and Icon, each keyboard operable, named, and visibly focused.
6. THE route `/design` SHALL render each component in each state.
7. Feature folders SHALL NOT be restyled in this chunk.

## Correctness properties

- P1: for every (theme, accent) pair, the contrast thresholds of requirement 1 hold, computed from `tokens.css`.
- P2: `generateBrand()` is a pure function: two calls return identical bytes.
- P3: `contrastRatio(a, b) = contrastRatio(b, a)` and is at least 1.
