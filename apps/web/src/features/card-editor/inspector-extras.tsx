import type { ReactNode } from 'react';
import { ANCHORS, VIEWPORT_PRESETS } from '@ghoststack/shared-contracts';
import type { Anchor, Layout, ScaleMode, Size } from '@ghoststack/shared-contracts';
import { MIXED } from './inspector-model';
import type { Shared } from './inspector-model';
import { miniRect } from './inspector-model';

const ANCHOR_TEXT: Record<Anchor, string> = {
  'top-left': 'top left',
  top: 'top',
  'top-right': 'top right',
  left: 'left',
  center: 'center',
  right: 'right',
  'bottom-left': 'bottom left',
  bottom: 'bottom',
  'bottom-right': 'bottom right',
};

/** Row-major 3 by 3 order of `ANCHORS` as shown in the picker. */
export const PIN_GRID: readonly Anchor[] = ANCHORS;

export function PinPicker({
  value,
  onPick,
}: {
  value: Shared<Anchor>;
  onPick: (anchor: Anchor) => void;
}): ReactNode {
  return (
    <div className="gs-ci-pin" role="group" aria-label="Pin to">
      {PIN_GRID.map((a) => (
        <button
          key={a}
          type="button"
          className="gs-ci-pin-cell"
          aria-label={`Pin ${ANCHOR_TEXT[a]}`}
          aria-pressed={value !== MIXED && value === a}
          title={`Pin ${ANCHOR_TEXT[a]}`}
          onClick={() => onPick(a)}
        >
          <span className="gs-ci-pin-dot" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

const MINI_WIDTH = 72;

/** Where the element lands in Tablet and Mobile, from the same `resolveLayout` as every renderer. */
export function ResponsivePreview({ layout, design }: { layout: Layout; design: Size }): ReactNode {
  const views = [VIEWPORT_PRESETS.tablet, VIEWPORT_PRESETS.mobile];
  return (
    <div className="gs-ci-minis" role="group" aria-label="Mini previews">
      {views.map((v) => {
        const k = MINI_WIDTH / v.width;
        const r = miniRect(layout, design, v);
        return (
          <figure key={v.label} className="gs-ci-mini">
            <div className="gs-ci-mini-frame" style={{ width: MINI_WIDTH, height: v.height * k }}>
              <span
                className="gs-ci-mini-el"
                style={{ left: r.x * k, top: r.y * k, width: r.width * k, height: r.height * k }}
              />
            </div>
            <figcaption>{v.label}</figcaption>
          </figure>
        );
      })}
    </div>
  );
}

const SCALE_TEXT: Record<ScaleMode, string> = {
  fixed: 'Fixed keeps the pixel size on every screen. Only the pinned position moves.',
  scale: 'Scale grows and shrinks the element with the screen and keeps its proportions.',
  stretch: 'Stretch changes width and height separately to follow the screen shape.',
};

export function ScaleDiagram({ mode }: { mode: Shared<ScaleMode> }): ReactNode {
  if (mode === MIXED)
    return <p className="gs-ci-hint">Elements use different modes. Choose one to set them all.</p>;
  const small = { fixed: [20, 12], scale: [14, 9], stretch: [30, 8] }[mode];
  const big = { fixed: [20, 12], scale: [22, 14], stretch: [30, 18] }[mode];
  return (
    <figure className="gs-ci-scale">
      <svg viewBox="0 0 100 40" width="100" height="40" role="img" aria-label={`Diagram of the ${mode} mode`}>
        <rect x="2" y="6" width="36" height="28" className="gs-ci-scale-frame" />
        <rect x="62" y="2" width="36" height="36" className="gs-ci-scale-frame" />
        <rect
          x={20 - small[0]! / 2}
          y={20 - small[1]! / 2}
          width={small[0]}
          height={small[1]}
          className="gs-ci-scale-el"
        />
        <rect
          x={80 - big[0]! / 2}
          y={20 - big[1]! / 2}
          width={big[0]}
          height={big[1]}
          className="gs-ci-scale-el"
        />
        <path d="M44 20h12m-4-4l4 4-4 4" className="gs-ci-scale-arrow" />
      </svg>
      <figcaption>{SCALE_TEXT[mode]}</figcaption>
    </figure>
  );
}
