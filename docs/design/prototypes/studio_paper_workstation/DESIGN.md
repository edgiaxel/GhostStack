---
name: Studio Paper Workstation
colors:
  surface: '#fcf8ff'
  surface-dim: '#dcd8e4'
  surface-bright: '#fcf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f2fe'
  surface-container: '#f1ecf8'
  surface-container-high: '#ebe6f2'
  surface-container-highest: '#e5e0ec'
  on-surface: '#1c1b23'
  on-surface-variant: '#594137'
  inverse-surface: '#312f38'
  inverse-on-surface: '#f3effb'
  outline: '#8d7165'
  outline-variant: '#e1bfb2'
  surface-tint: '#a23f00'
  primary: '#9e3d00'
  on-primary: '#ffffff'
  primary-container: '#c74e00'
  on-primary-container: '#fffbff'
  inverse-primary: '#ffb595'
  secondary: '#006c4d'
  on-secondary: '#ffffff'
  secondary-container: '#9af5cc'
  on-secondary-container: '#057352'
  tertiary: '#005caf'
  on-tertiary: '#ffffff'
  tertiary-container: '#0074db'
  on-tertiary-container: '#fefcff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbcd'
  primary-fixed-dim: '#ffb595'
  on-primary-fixed: '#360f00'
  on-primary-fixed-variant: '#7c2e00'
  secondary-fixed: '#9af5cc'
  secondary-fixed-dim: '#7fd8b1'
  on-secondary-fixed: '#002115'
  on-secondary-fixed-variant: '#005139'
  tertiary-fixed: '#d5e3ff'
  tertiary-fixed-dim: '#a8c8ff'
  on-tertiary-fixed: '#001b3c'
  on-tertiary-fixed-variant: '#004689'
  background: '#fcf8ff'
  on-background: '#1c1b23'
  surface-variant: '#e5e0ec'
typography:
  headline-xl:
    fontFamily: Space Grotesk
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.03em
  headline-xl-mobile:
    fontFamily: Space Grotesk
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: 0em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.005em
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.02em
  code-md:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: -0.01em
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-compact: 0.5rem
  margin: 1.5rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system embodies the precision, clarity, and utilitarian tactile focus of an advanced creative workstation environment. Grounded in high-contrast editorial and drafting studio paradigms, it rejects vaporous, low-contrast UI trends in favor of razor-sharp architectural panels, distinct ink-on-paper typographic hierarchy, and unambiguous functional affordances.

The experience is tuned for creators, technical designers, and power users who require absolute visual legibility during high-velocity workflows. It evokes disciplined competence, structural permanence, and industrial mechanical refinement. The visual movement fuses technical minimalism with physical drafting-table ergonomics: pure white panels float deliberately on a cool grey canvas, bound by hairline mechanical dividers and punctuated by a single high-intensity amber-orange primary signal.

## Colors

The palette establishes an ultra-high-contrast studio environment calibrated to exceed WCAG AAA accessibility thresholds across critical reading paths.

### Surface Hierarchy
- **Canvas / Workbench (`#F4F5F7`):** The cool grey foundation across which all operational modules and panels rest.
- **Structural Panels & Primary Workspaces (`#FFFFFF`):** High-reflectance drafting surfaces for code, artboards, and primary tool groups.
- **Secondary Containers & Recessed Wells (`#ECEEF2`):** Used for tool drawers, data table headers, deactivated controls, and code block insets.

### Typographic Contrast Hierarchy
- **Ink Primary (`#111018`):** Deep carbon black. Delivers an authoritative 14:1+ contrast against white surfaces for headlines, critical data, and active values.
- **Ink Secondary (`#4B4658`):** Slate graphite. Delivers 7:1+ contrast for structural UI labels, secondary instructions, and table rows.
- **Technical Muted (`#635E72`):** Cool slate. Strictly maintained above 4.8:1 contrast for timestamps, non-active metadata, and syntax comments. Never drop below this value for text.

### Signal & Accent Colors
- **Primary Signal (`#E65C00`):** Vivid industrial pumpkin orange. Applied to primary calls-to-action, active selection halos, active tabs, and primary scrubbers.
- **Secondary / Success / Operational Active (`#167A59`):** Deep pine mint. Used for validated build states, live system runtimes, and active connection pins.
- **Architectural Boundary (`#D7DAE2`):** A hairline mechanical divider (1px solid) that demarcates panels without relying on ambient shadow bleed.

## Typography

Typographic scale is structured around geometric distinction and operational legibility.

- **Display & Section Headers (`Space Grotesk`):** Technical, angular, and structured. Headlines use tight letter-spacing and strong weights to establish immediate structural landmarks across dense screens.
- **Interface & Reading Text (`Inter`):** Selected for its systematic, uncolored clarity. Body text is neutral and crisp, supporting prolonged reading without fatigue. Form fields, table contents, and tooltips strictly use Inter.
- **Technical & Terminal Readouts (`JetBrains Mono`):** Dedicated to technical metadata, raw coordinates, memory metrics, shortcuts, and inline code blocks.

### Rules of Usage
- Always render headings in `#111018` for uncompromised figure-ground definition.
- Never use font sizes below `11px` (`label-sm` or `code-sm`).
- All numeric tables and parameter listings must enable tabular numbers (`font-variant-numeric: tabular-nums`).

## Layout & Spacing

The workstation layout uses a dense, responsive structural grid designed for maximum information density without visual crowding.

### Layout Philosophy
- **Modular Docking Layout:** The system favors an edge-to-edge functional canvas with persistent 1px-bordered toolbars, fixed sidebar inspector docks, and a centered fluid viewport.
- **Desktop (>= 1280px):** 12-column or multi-dock layout. Docked sidebars have fixed widths (280px to 340px) while the primary workbench flexes fluidly. Gutter is `1rem`. Outer margins are `1.5rem`.
- **Tablet (768px - 1279px):** 8-column layout. Ancillary panels collapse into off-canvas sliding drawers. Primary toolbars condense icons and drop text labels.
- **Mobile (< 768px):** 4-column layout. Single-column flow with pinned bottom action sheets. Margin drops to `1rem` and gutter tightens to `0.5rem`.

### Spacing Rhythm
Spacing is strictly derived from an 8-point base grid (subdivided to 4px via `space-xs`). Tight paddings (`space-xs` to `space-sm`) are applied internally to controls, chips, and table cells to retain dense productivity metrics. Component-to-component separation relies on `space-md` or 1px structural dividing lines rather than exaggerated whitespace.

## Elevation & Depth

This design system repudiates ambient, diffuse drop-shadows and fuzzy glass effects. Depth is expressed through mechanical layering, planar shifts, and precise borders.

### Layering Hierarchy
1. **Level 0 (Canvas):** `#F4F5F7`. The bottom-most surface. Recessed tool docks, scroll tracks, and artboard negative space.
2. **Level 1 (Structural Panels):** `#FFFFFF`. Resting planar surfaces separated from Level 0 by a crisp `1px solid #D7DAE2` boundary.
3. **Level 2 (Active Toolbars & Flyouts):** `#FFFFFF` paired with an ultra-crisp mechanical contact border: `0 0 0 1px #D7DAE2, 0 4px 12px rgba(17, 16, 24, 0.06)`. The subtle shadow is directional, grounded, and tight—never exceeding 12px blur.
4. **Level 3 (Modal Dialogs & Context Menus):** Pure white container bounded by `1px solid #D7DAE2`, supported by an offset shadow: `0 12px 28px rgba(17, 16, 24, 0.12)`. Dimmed backdrops utilize an architectural veil of `#111018` at 30% opacity.

### Contrast Invariants
Surfaces never rely on shadows alone to define their boundaries. Every overlay, dropdown, popover, and floating palette must feature a definitive `1px solid #D7DAE2` stroke.

## Shapes

The design system implements a soft, engineered shape vocabulary (`roundedness: 1`). Radii are deliberately restrained to evoke calibrated instrument hardware rather than toy-like consumer surfaces.

- **Base Radius (`0.25rem` / `4px`):** Applied to buttons, text fields, chips, checkboxes, table rows, and segmented controls.
- **Panel Radius (`rounded-lg` / `0.5rem` / `8px`):** Applied to cards, detached inspector toolbars, floating palettes, and modal windows.
- **Container Radius (`rounded-xl` / `0.75rem` / `12px`):** Used strictly for outer application shells and large preview viewports.
- **Circular (`9999px`):** Restricted solely to status indicator dots, avatars, and discrete circular utility icon triggers.

## Components

### Buttons & Interactive Triggers
- **Primary Button:** Background `#E65C00`, text `#FFFFFF`, font `Inter` 600. Border: none. Focus ring: `0 0 0 2px #FFFFFF, 0 0 0 4px #E65C00`. Hover state shifts to `#ED6C14`. Active state shifts to `#CC5200`.
- **Secondary Button:** Background `#FFFFFF`, text `#111018`, border `1px solid #D7DAE2`. Hover: background `#ECEEF2`, border color `#4B4658`.
- **Ghost / Tool Button:** Background transparent, text `#4B4658`. Hover: background `#ECEEF2`, text `#111018`. Active: background `#D7DAE2`.
- **Destructive Button:** Background `#FFFFFF`, text `#C92A2A`, border `1px solid #F3B8B8`. Hover: background `#FFF5F5`.

### Input Fields & Controls
- **Text Inputs:** Background `#FFFFFF`, border `1px solid #D7DAE2`, text `#111018`, placeholder text `#635E72`. Height 36px (compact workstation standard). On focus: border color `#E65C00`, accompanied by an immediate `0 0 0 1px #E65C00` inner stroke.
- **Checkboxes & Radios:** 16px square/circle with `1px solid #D7DAE2` on `#FFFFFF`. When checked: fill `#E65C00` with high-contrast `#FFFFFF` check glyph. Focus ring matches button specifications.

### Chips & Parameter Tags
- **Filter / Meta Chip:** Height 24px, background `#ECEEF2`, border `1px solid #D7DAE2`, text `#4B4658`, font size 12px. Active / selected state: background `#FFFFFF`, border color `#E65C00`, text `#E65C00`, font weight 600.
- **Status Indicator Pill:** Background `#FFFFFF`, border `1px solid #D7DAE2`, containing a 6px solid dot (`#167A59` for operational/success, `#E65C00` for active/warning).

### Cards & Workstation Panes
- **Inspector Card:** Background `#FFFFFF`, border `1px solid #D7DAE2`, border-radius `0.5rem`. Card header features a bottom divider (`1px solid #D7DAE2`), padding `0.75rem 1rem`, with title set in `Space Grotesk` 14px bold `#111018`.
- **Recessed Well Card:** Background `#ECEEF2`, border `1px solid #D7DAE2`, border-radius `0.25rem`. Used to frame data outputs, log streams, and nested setting matrices.

### Lists & Data Grids
- **Header Cells:** Background `#ECEEF2`, text `#635E72`, font size 11px uppercase, tracking `0.02em`, height 32px, bottom border `1px solid #D7DAE2`.
- **Data Rows:** Background `#FFFFFF`, alternating hover highlight `#F4F5F7`. Height 36px. Cells feature `1px solid #ECEEF2` bottom borders. Selected row highlights with a 2px left border accent in `#E65C00` and a `#F4F5F7` fill.