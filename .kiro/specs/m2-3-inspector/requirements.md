# Requirements: M2.3 Inspector (closes U12)
Source: AUDIT-M2 U12; MILESTONE M2.3; brief `inspector` in docs/handoffs/m2x/README.md.

1. `CardInspector` keeps its name and `EditorSlotProps`; adds optional `onOpenBehavior`. With one element selected it shows tabs Content, Layout, Appearance, Behavior. Every property editable before stays editable.
2. Layout tab: X, Y, Width, Height (kit `NumberField`, stepper buttons, px unit), Anchor select plus a 3x3 pin picker, live mini previews at Tablet and Mobile from `resolveLayout`, Scaling select with a diagram and one-line explanation, z-order buttons.
3. Appearance tab: visibility, opacity, colors (token swatches resolved to hex, hex field, picker, Default), type specific properties.
4. Behavior tab: readable summary of the element's behaviors. The "Edit behaviors" button renders only when `onOpenBehavior` is supplied.
5. No element selected: card section with title (`RENAME_CARD`), background (`SET_CARD_BACKGROUND`), reference frame size (`SET_VIEWPORT`).
6. Internals take `elements: Element[]`. Shared values show; differing values show "Mixed" and the field commits to all. One selected element is the real path.
7. Rejected commands show the domain message and a fix hint beside the field. Nothing invalid reaches the Stack.
8. Keyboard only works: tabs (arrows), fields, pin picker, steppers. Nothing clips at the panel width.

## Correctness properties
- P1 Any value `inspector-model` accepts for a property, applied through `applyCommand`, yields a Stack that passes `validateStack`.
- P2 Values `inspector-model` rejects never change the Stack (dispatch returns an error).
- P3 `sharedValue` of equal values returns that value; of different values returns MIXED.
- P4 Pin picker anchors are exactly `ANCHORS`.
