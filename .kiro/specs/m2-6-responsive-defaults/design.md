# Design: M2.6 Responsive defaults

- `resolveLayout` and `resolveFontScale` are unchanged; every renderer calls them.
- Player option `fit: 'frame' | 'window'` (default `frame`). `frame`: the stage has the design size and is CSS-scaled by `min(cw/dw, ch/dh)`, centered in the container. Text and strokes follow because the whole stage scales. `window`: stage fills the container and elements are placed with `resolveLayout`; font size, stroke width and radius are multiplied by `resolveFontScale`.
- Preview: select `Fit (whole card)` (frame), `Window size` (window), or a device preset (window mode, fixed frame size).
- Web export HTML: letterbox background is a neutral gray, `#app` fills the window; the player runs in `frame` mode.
- Editor: `ElementContent` multiplies stroke width and radius by `fontScale`. `ApplyScalingButton` sits in the canvas bar and only uses `session.dispatch`.
