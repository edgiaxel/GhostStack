import type { Layout } from './project';

export const ANCHORS = [
  'top-left',
  'top',
  'top-right',
  'left',
  'center',
  'right',
  'bottom-left',
  'bottom',
  'bottom-right',
] as const;
export type Anchor = (typeof ANCHORS)[number];

/**
 * `fixed`: keeps pixel size, offsets to the anchored edges stay constant.
 * `scale`: size and offsets scale by min(vw/dw, vh/dh), proportions are kept.
 * `stretch`: x/width scale by vw/dw and y/height by vh/dh, anchor is ignored.
 */
export const SCALE_MODES = ['fixed', 'scale', 'stretch'] as const;
export type ScaleMode = (typeof SCALE_MODES)[number];

export interface Size {
  width: number;
  height: number;
}
export interface Rect extends Size {
  x: number;
  y: number;
}

export const VIEWPORT_PRESETS = {
  desktop: { label: 'Desktop', width: 1280, height: 720 },
  tablet: { label: 'Tablet', width: 768, height: 1024 },
  mobile: { label: 'Mobile', width: 390, height: 844 },
} as const;
export type ViewportPresetId = keyof typeof VIEWPORT_PRESETS;

type Axis = 'start' | 'center' | 'end';
const horizontal = (a: Anchor): Axis =>
  a.endsWith('left') ? 'start' : a.endsWith('right') ? 'end' : 'center';
const vertical = (a: Anchor): Axis =>
  a.startsWith('top') ? 'start' : a.startsWith('bottom') ? 'end' : 'center';

function place(pos: number, size: number, design: number, view: number, s: number, axis: Axis): number {
  const scaled = size * s;
  if (axis === 'start') return pos * s;
  if (axis === 'end') return view - (design - pos - size) * s - scaled;
  return view / 2 + (pos + size / 2 - design / 2) * s - scaled / 2;
}

/**
 * Pure placement of an Element's authored layout (in `design` pixels) inside a `view` of another
 * size. The authoring canvas, preview and exported player all call this so they cannot drift.
 */
export function resolveLayout(layout: Layout, design: Size, view: Size): Rect {
  const mode: ScaleMode = layout.scaleMode ?? 'fixed';
  const anchor: Anchor = layout.anchor ?? 'top-left';
  const sx = view.width / design.width;
  const sy = view.height / design.height;
  if (mode === 'stretch') {
    return { x: layout.x * sx, y: layout.y * sy, width: layout.width * sx, height: layout.height * sy };
  }
  const s = mode === 'scale' ? Math.min(sx, sy) : 1;
  return {
    x: place(layout.x, layout.width, design.width, view.width, s, horizontal(anchor)),
    y: place(layout.y, layout.height, design.height, view.height, s, vertical(anchor)),
    width: layout.width * s,
    height: layout.height * s,
  };
}

/** Factor to apply to font sizes and line widths so text follows its element's scaling. */
export function resolveFontScale(layout: Layout, rect: Rect): number {
  return layout.height > 0 ? rect.height / layout.height : layout.width > 0 ? rect.width / layout.width : 1;
}
