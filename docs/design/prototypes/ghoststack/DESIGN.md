---
name: GhostStack
colors:
  surface: '#14121d'
  surface-dim: '#14121d'
  surface-bright: '#3a3844'
  surface-container-lowest: '#0f0d17'
  surface-container-low: '#1c1a25'
  surface-container: '#201e29'
  surface-container-high: '#2b2834'
  surface-container-highest: '#36333f'
  on-surface: '#e6e0f0'
  on-surface-variant: '#dbc1b3'
  inverse-surface: '#e6e0f0'
  inverse-on-surface: '#312f3b'
  outline: '#a38c7f'
  outline-variant: '#554338'
  surface-tint: '#ffb689'
  primary: '#ffb689'
  on-primary: '#512300'
  primary-container: '#f28c45'
  on-primary-container: '#622c00'
  inverse-primary: '#984800'
  secondary: '#a2d0c0'
  on-secondary: '#07372c'
  secondary-container: '#255145'
  on-secondary-container: '#94c2b2'
  tertiary: '#4bd7f3'
  on-tertiary: '#00363f'
  tertiary-container: '#00b6d1'
  on-tertiary-container: '#00424d'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdbc8'
  primary-fixed-dim: '#ffb689'
  on-primary-fixed: '#311300'
  on-primary-fixed-variant: '#743500'
  secondary-fixed: '#beecdc'
  secondary-fixed-dim: '#a2d0c0'
  on-secondary-fixed: '#002019'
  on-secondary-fixed-variant: '#234e42'
  tertiary-fixed: '#a7eeff'
  tertiary-fixed-dim: '#4bd7f3'
  on-tertiary-fixed: '#001f25'
  on-tertiary-fixed-variant: '#004e5b'
  background: '#14121d'
  on-background: '#e6e0f0'
  surface-variant: '#36333f'
typography:
  display-lg:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.03em
  display-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.02em
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 17px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  title-md:
    fontFamily: Space Grotesk
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Space Grotesk
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-sm:
    fontFamily: Space Grotesk
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.06em
  code-md:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-sm: 0.5rem
  gutter-lg: 1.5rem
  margin: 1.5rem
  margin-mobile: 0.75rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

This design system establishes an authentic creative workstation environment merging retro-hypermedia utility with a refined, nocturnal editorial mood. Inspired by classic local-first stack authoring environments, it delivers precision desktop density without visual clutter.

The aesthetic pairs utilitarian technical craftsmanship with subtle spectral warmth:
- **Atmospheric Nocturne:** A deep, obsidian-tinted backdrop layered with subtle obsidian-slate panels and crisp, hairline borders.
- **Editorial Tooling:** Monospaced data displays, geometric display titling, and clinical body text create an environment tuned for focus, authoring, and state composition.
- **Tactile Density:** Snappy physical-adjacent components, clear active states, and muted pumpkin and ghostly mint accents that draw the eye strictly to active tools, states, and cursor-interactable zones.

## Colors

The palette balances deep tonal black-purples with targeted spectral accents:

- **Primary Accent (`#F28C45`):** Muted pumpkin orange used for high-intent primary interactions, card compile states, active stack manipulation, and focus indicators.
- **Secondary Accent (`#A9D7C7`):** Ghostly mint used for runtime status, inspect modes, success confirmations, and link/hypermedia node connectors.
- **Canvas Base (`#111018`):** The primary root workspace background, mimicking dark cathode glass and negative canvas space.
- **Surface Tier 1 (`#191722`):** Primary structural docking panels, toolboxes, and active card canvases.
- **Surface Tier 2 (`#242131`):** Floating inspector panels, toolbar buckets, menu popovers, and inset component wells.
- **Hairline Border (`#343040`):** Precise 1px structural delimitation separating tools, cards, and canvas panels without heavy drop-shadows.
- **Text Layers:** Primary bone-white (`#F1EDE5`) for sharp legibility; muted slate-lavender (`#A8A2B3`) for metadata, parameter keys, and secondary states.

## Typography

The typography scale addresses three core operational domains:

1. **Space Grotesk (Titling, Tooling, & Structural UI):** Used for panel headers, tab strips, modal titles, and card-level headings. The geometric quirks reinforce a technical hardware console tone.
2. **Inter (Interface & Content Copy):** Provides crystal-clear rendering across compact control rows, inspector attribute labels, and micro-app runtime text.
3. **JetBrains Mono (Code, Logic, & Hypermedia Properties):** Bound strictly to script triggers, stack indices, property sheets, and coordinates (`X: 120, Y: 340`).

## Layout & Spacing

The workspace uses a dense, technical fixed-panel layout designed for multi-pane workflows, state authoring, and live canvas testing:

- **Desktop Layout:** A three-pane architecture consisting of a persistent left-hand stack explorer (240px–280px), a central fluid workspace with fixed aspect-ratio card mounts, and a context-aware right-hand property inspector (300px).
- **Responsive Adaptations:**
  - **Desktop (1200px+):** Full three-column layout with 16px grid gutters and persistent toolbars.
  - **Tablet (768px–1199px):** Inspector transitions into a sliding auxiliary drawer; toolbar contracts to iconography with tooltip prompts.
  - **Mobile (<768px):** Single-surface view focused on the active card canvas; workspace controls collapse into bottom sheets with reduced outer margins (`0.75rem`).
- **Rhythm:** Dense spacing driven by a 4px sub-grid (`0.25rem` through `1.5rem`). Component paddings remain compact (`0.5rem` to `0.75rem`) to maximize viewable data in inspector panes.

## Elevation & Depth

Visual hierarchy is communicated through structural tonal zoning and hairline borders rather than heavy diffuse drop-shadows:

- **Surface Tiers:**
  - **Layer 0 (Canvas Floor):** `#111018`, neutral recessed backdrop.
  - **Layer 1 (Authoring Cards & Work Panels):** `#191722`, bound with a 1px border of `#343040`.
  - **Layer 2 (Overlays, Floating Palettes, Dropdowns):** `#242131`, edged with `#443E54` and a high-precision shadow: `0 4px 16px -2px rgba(0, 0, 0, 0.6)`.
- **Ghost Borders:** Outlines remain low-contrast (`#343040`) in neutral states, shifting to `#A9D7C7` during inspect/wiring operations and `#F28C45` during active edit/focus modes.
- **Tactile Indents:** Inset wells, code blocks, and canvas stages use an inner line highlight: `inset 0 1px 0 0 rgba(255, 255, 255, 0.03)`.

## Shapes

The design system maintains strict geometric discipline tuned to software craftsmanship:

- **Standard Components:** 8px to 10px corner radius (`roundedness: 2`), applying to input fields, buttons, action chips, and nested inspector items.
- **Panels & Canvas Cards:** 12px outer radius for stack cards, floating toolboxes, and top-level dockable panels, providing a contained hardware module look.
- **Pill Badges:** Small auxiliary status indicators and tool tags may utilize fully rounded pills for instant peripheral differentiation against orthogonal tool panels.

## Components

### Buttons
- **Primary:** Solid `#F28C45` fill, `#111018` bold typography (`Space Grotesk`), 8px border radius, 32px height for compact toolbars, 40px for primary actions. Active state: slight scale down (`0.98`) with darkened fill (`#DB7731`).
- **Secondary / Ghost:** Transparent background with 1px `#343040` border, `#F1EDE5` text. On hover: background `#242131` with `#A8A2B3` border.
- **Destructive:** Transparent with `#FF5C5C` border; shifts to muted red fill on confirmation clicks.

### Chips & Node Tags
- Height: 24px, 6px radius or pill shape.
- Surface `#242131`, 1px border `#343040`. Text is formatted with `label-sm` in `JetBrains Mono` or `Space Grotesk`.
- Secondary accent chips (`#A9D7C7`) indicate active data links or micro-app output listeners.

### Micro-App Cards (The HyperCard Metaphor)
- Base dimensions adhere to scalable fixed rations (e.g., 4:3, 16:10) centered on the workspace canvas.
- Background: `#191722`, border: 1px `#343040`, border-radius: 12px.
- Card Header: Integrated title strip with stack numbering (`#01 / 12`), drag handle, and rapid edit toggles.

### Input Fields & Controls
- **Inputs:** Background `#111018`, border: 1px `#343040`, text `#F1EDE5`. Focus: 1px outline in `#F28C45` with subtle 2px glow ring (`rgba(242, 140, 69, 0.2)`).
- **Checkboxes & Radios:** 16px square/circle, background `#111018`, checked state filled with `#F28C45` featuring sharp bone-white glyph check marks.
- **Sliders & Steppers:** Scrubbable micro-inputs with `JetBrains Mono` values, calibrated for rapid numeric card adjustments.

### Lists & Navigation
- Dense, item-height 28px–32px. Hover highlight: `#242131` with left-edge 2px indicator bar in `#F28C45` for the selected card or logic trigger.