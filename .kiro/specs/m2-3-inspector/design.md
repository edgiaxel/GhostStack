# Design: M2.3 Inspector
- `inspector-model.ts`: pure helpers (`MIXED`, `sharedValue`, `fixHint`, `describeBehavior`, `miniRect`). No React.
- `fields.tsx`: kit based field wrappers (text, textarea, number with steppers, select, check, color) that hold a draft and show the domain error.
- `Inspector.tsx`: `CardInspector` (slot) -> `ElementInspector` (`elements: Element[]`) or `CardSection`. Tab choice is kept across selections.
- `inspector-extras.tsx`: `PinPicker`, `ResponsivePreview`, `ScaleDiagram`.
- Styles: `inspector.css`, prefix `gs-ci-`.
- Writes only via `session.dispatch` with a `coalesceKey` per property and element. Image upload stays as before.
# Tasks
- [x] model + tests, fields, extras, inspector, css
- [x] unit and property tests, e2e `m2x-inspector.spec.ts`, update older e2e for tabs
