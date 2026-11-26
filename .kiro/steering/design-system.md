---
inclusion: fileMatch
fileMatchPattern: "apps/web/**/*.css"
---

# GhostStack: Design System Rules (loaded when editing styles)

Source of truth: `docs/DESIGN.md` section 9 (visual direction and themes). The Stitch prototypes in `docs/design/prototypes/` are reference only. Follow DESIGN.md and do not copy a prototype one to one.

- Colors, spacing, radius, elevation and motion come from CSS variables in `apps/web/src/themes/tokens.css`. Do not add raw hex values to feature CSS.
- Three themes ship: Spectral Workstation (default), Studio Paper, Midnight Terminal. Every change must work in all three. `tests/e2e/audit-themes.spec.ts` checks WCAG AA text contrast (4.5:1) and the focus color (3:1) from the computed theme variables.
- Text on an accent color must meet 4.5:1. Borders of controls should reach 3:1 against their surface (known open item U5 in `docs/AUDIT-M2.md`).
- Respect `prefers-reduced-motion`. Motion must have a purpose, such as showing a state change.
- Do not add decoration without a reason: no stacked glows, glass on every panel, background grids, decorative emoji, or generic gradients. Write the one-line reason for each major visual choice in `docs/DESIGN.md`.
- Brand assets (logo, wordmark, favicon) are generated from code by the brand script. Edit the generator, not the exported files.
- Class prefix is `gs-<feature>-`. Feature CSS must not restyle `gs-*` base classes.
