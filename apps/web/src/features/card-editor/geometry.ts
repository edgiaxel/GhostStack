import type { Layout, Rect } from '@ghoststack/shared-contracts';

export type Handle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';
export const HANDLES: Handle[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];

/** Largest scale that fits `viewWidth` into `areaWidth`, never above 1. Falls back to 1 when unmeasured. */
export function fitScale(areaWidth: number, viewWidth: number): number {
  if (!(areaWidth > 0) || !(viewWidth > 0)) return 1;
  return Math.min(1, areaWidth / viewWidth);
}

/** Rounds to one decimal so stored values stay readable. */
export const round1 = (n: number): number => Math.round(n * 10) / 10;

/** Minimum width and height of an element type. A line may have zero height. */
export function minSize(type: string): { width: number; height: number } {
  return { width: 1, height: type === 'line' ? 0 : 1 };
}

export type Box = Pick<Layout, 'x' | 'y' | 'width' | 'height'>;

export function moveBox(start: Box, dx: number, dy: number): Pick<Box, 'x' | 'y'> {
  return { x: round1(start.x + dx), y: round1(start.y + dy) };
}

/** Resizes from `handle` by a pointer delta in design pixels. The opposite edge stays fixed. */
export function resizeBox(
  start: Box,
  handle: Handle,
  dx: number,
  dy: number,
  min: { width: number; height: number },
): Box {
  let { x, y, width, height } = start;
  if (handle.includes('e')) width = Math.max(min.width, start.width + dx);
  if (handle.includes('s')) height = Math.max(min.height, start.height + dy);
  if (handle.includes('w')) {
    width = Math.max(min.width, start.width - dx);
    x = start.x + start.width - width;
  }
  if (handle.includes('n')) {
    height = Math.max(min.height, start.height - dy);
    y = start.y + start.height - height;
  }
  return { x: round1(x), y: round1(y), width: round1(width), height: round1(height) };
}

/** Keyboard step for arrow keys: 1 design pixel, 10 with Shift. */
export function arrowDelta(key: string, shift: boolean): { dx: number; dy: number } | undefined {
  const step = shift ? 10 : 1;
  switch (key) {
    case 'ArrowLeft':
      return { dx: -step, dy: 0 };
    case 'ArrowRight':
      return { dx: step, dy: 0 };
    case 'ArrowUp':
      return { dx: 0, dy: -step };
    case 'ArrowDown':
      return { dx: 0, dy: step };
    default:
      return undefined;
  }
}

/** Position for the n-th newly added element so they cascade instead of stacking exactly. */
export function cascadePosition(count: number): { x: number; y: number } {
  const step = (count % 10) * 24;
  return { x: 40 + step, y: 40 + step };
}

export const toCss = (r: Rect): { left: number; top: number; width: number; height: number } => ({
  left: r.x,
  top: r.y,
  width: r.width,
  height: r.height,
});
