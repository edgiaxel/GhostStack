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

export interface IdBox {
  id: string;
  box: Box;
}
export type Align = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';
export type Axis = 'horizontal' | 'vertical';
export type Position = Partial<Pick<Box, 'x' | 'y'>>;

/** Smallest box that contains every box. Empty input gives a zero box. */
export function boundsOf(boxes: Box[]): Box {
  if (boxes.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.width));
  const bottom = Math.max(...boxes.map((b) => b.y + b.height));
  return { x, y, width: right - x, height: bottom - y };
}

/** New positions that line the boxes up on an edge or center of their common bounds. Sizes never change. */
export function alignBoxes(items: IdBox[], mode: Align): Record<string, Position> {
  const b = boundsOf(items.map((i) => i.box));
  const out: Record<string, Position> = {};
  for (const { id, box } of items) {
    switch (mode) {
      case 'left':
        out[id] = { x: round1(b.x) };
        break;
      case 'center':
        out[id] = { x: round1(b.x + b.width / 2 - box.width / 2) };
        break;
      case 'right':
        out[id] = { x: round1(b.x + b.width - box.width) };
        break;
      case 'top':
        out[id] = { y: round1(b.y) };
        break;
      case 'middle':
        out[id] = { y: round1(b.y + b.height / 2 - box.height / 2) };
        break;
      case 'bottom':
        out[id] = { y: round1(b.y + b.height - box.height) };
        break;
    }
  }
  return out;
}

/**
 * Equal gaps between three or more boxes along `axis`. The first and last box in reading order stay
 * where they are. Returns no positions for fewer than three boxes.
 */
export function distributeBoxes(items: IdBox[], axis: Axis): Record<string, Position> {
  if (items.length < 3) return {};
  const horizontal = axis === 'horizontal';
  const start = (b: Box): number => (horizontal ? b.x : b.y);
  const size = (b: Box): number => (horizontal ? b.width : b.height);
  const sorted = [...items].sort((a, b) => start(a.box) - start(b.box));
  const first = sorted[0]!.box;
  const last = sorted[sorted.length - 1]!.box;
  const total = sorted.reduce((sum, i) => sum + size(i.box), 0);
  const gap = (start(last) + size(last) - start(first) - total) / (sorted.length - 1);
  const out: Record<string, Position> = {};
  let at = start(first);
  for (const { id, box } of sorted) {
    out[id] = horizontal ? { x: round1(at) } : { y: round1(at) };
    at += size(box) + gap;
  }
  return out;
}

export const SNAP_THRESHOLD = 6;
export interface Guide {
  /** `v` is a vertical line at x = `at`, `h` a horizontal line at y = `at`. */
  orientation: 'v' | 'h';
  at: number;
  from: number;
  to: number;
}
export interface Snap {
  dx: number;
  dy: number;
  guides: Guide[];
}

interface Line {
  at: number;
  from: number;
  to: number;
}
function bestSnap(
  mine: number[],
  targets: Line[],
  threshold: number,
): { delta: number; at: number } | undefined {
  let best: { delta: number; at: number } | undefined;
  for (const m of mine) {
    for (const t of targets) {
      const delta = t.at - m;
      if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) {
        best = { delta, at: t.at };
      }
    }
  }
  return best;
}

/**
 * Snaps `box` (already moved) to the frame edges, the frame center and the edges and centers of
 * `others`. The shift on each axis is at most `threshold`. Guides run through every matching line.
 */
export function snapMove(
  box: Box,
  others: Box[],
  frame: { width: number; height: number },
  threshold = SNAP_THRESHOLD,
): Snap {
  const frameBox: Box = { x: 0, y: 0, width: frame.width, height: frame.height };
  const targets = [frameBox, ...others];
  const xs = (b: Box): number[] => [b.x, b.x + b.width / 2, b.x + b.width];
  const ys = (b: Box): number[] => [b.y, b.y + b.height / 2, b.y + b.height];
  const sx = bestSnap(
    xs(box),
    targets.flatMap((t) => xs(t).map((at) => ({ at, from: t.y, to: t.y + t.height }))),
    threshold,
  );
  const sy = bestSnap(
    ys(box),
    targets.flatMap((t) => ys(t).map((at) => ({ at, from: t.x, to: t.x + t.width }))),
    threshold,
  );
  const dx = sx?.delta ?? 0;
  const dy = sy?.delta ?? 0;
  const moved: Box = { ...box, x: box.x + dx, y: box.y + dy };
  const guides: Guide[] = [];
  const eps = 0.001;
  if (sx) {
    for (const t of targets) {
      if (xs(t).some((v) => Math.abs(v - sx.at) < eps)) {
        guides.push({
          orientation: 'v',
          at: sx.at,
          from: Math.min(t.y, moved.y),
          to: Math.max(t.y + t.height, moved.y + moved.height),
        });
      }
    }
  }
  if (sy) {
    for (const t of targets) {
      if (ys(t).some((v) => Math.abs(v - sy.at) < eps)) {
        guides.push({
          orientation: 'h',
          at: sy.at,
          from: Math.min(t.x, moved.x),
          to: Math.max(t.x + t.width, moved.x + moved.width),
        });
      }
    }
  }
  return { dx, dy, guides };
}

/** Ids of boxes that touch the marquee rectangle. */
export function marqueeHits(marquee: Box, items: IdBox[]): string[] {
  const r = marquee.x + marquee.width;
  const b = marquee.y + marquee.height;
  return items
    .filter(
      ({ box }) =>
        box.x <= r && box.x + box.width >= marquee.x && box.y <= b && box.y + box.height >= marquee.y,
    )
    .map((i) => i.id);
}

/** Normalizes two corner points into a box with non-negative size. */
export function boxFromPoints(ax: number, ay: number, bx: number, by: number): Box {
  return { x: Math.min(ax, bx), y: Math.min(ay, by), width: Math.abs(ax - bx), height: Math.abs(ay - by) };
}
