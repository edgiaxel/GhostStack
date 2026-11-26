/** Pure zoom math for the authoring canvas. No React, no DOM. */
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 4;
/** Steps used by the zoom buttons and shortcuts. */
export const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4] as const;
export type ZoomState = { mode: 'fit' } | { mode: 'manual'; scale: number };
export const FIT: ZoomState = { mode: 'fit' };
export const clampZoom = (scale: number): number =>
  Number.isFinite(scale) ? Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale)) : 1;
/** Next preset above (dir 1) or below (dir -1) `scale`. Stays at the end of the range. */
export function stepZoom(scale: number, dir: 1 | -1): number {
  const s = clampZoom(scale);
  if (dir === 1) return ZOOM_STEPS.find((z) => z > s + 1e-6) ?? MAX_ZOOM;
  return [...ZOOM_STEPS].reverse().find((z) => z < s - 1e-6) ?? MIN_ZOOM;
}
/**
 * Scale that shows the whole view inside the area, never above 100% and never below the minimum.
 * An unmeasured side (0, as in jsdom) is ignored.
 */
export function fitZoom(areaW: number, areaH: number, viewW: number, viewH: number): number {
  if (!(viewW > 0) || !(viewH > 0)) return 1;
  const w = areaW > 0 ? areaW / viewW : Infinity;
  const h = areaH > 0 ? areaH / viewH : Infinity;
  const fit = Math.min(w, h, 1);
  return clampZoom(fit);
}
export const resolveZoom = (zoom: ZoomState, fit: number): number =>
  zoom.mode === 'fit' ? fit : clampZoom(zoom.scale);
/** Design-space coordinate that is under `cursor`, given where the view starts (same screen axis) and the scale. */
export const pointUnderCursor = (cursor: number, viewStart: number, scale: number): number =>
  (cursor - viewStart) / scale;
/**
 * How far to scroll (positive = content moves toward the start) after a zoom so that `point` sits under
 * `cursor` again. `viewStartAfter` is where the view starts on screen after the new scale rendered.
 */
export const scrollDeltaToPin = (
  cursor: number,
  viewStartAfter: number,
  point: number,
  nextScale: number,
): number => viewStartAfter + point * nextScale - cursor;
/** Zoom factor for a wheel event (negative deltaY zooms in). */
export const wheelFactor = (deltaY: number): number =>
  Math.exp(-Math.max(-200, Math.min(200, deltaY)) * 0.0025);
