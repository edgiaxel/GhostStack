import type { ReactNode } from 'react';
import { RENDER_DEFAULTS, resolveLayout } from '@ghoststack/shared-contracts';
import type { Element, Stack } from '@ghoststack/shared-contracts';

const SAFE_COLOR = /^(#[0-9a-fA-F]{3,8}|transparent)$/;
const color = (v: unknown, fallback: string): string =>
  typeof v === 'string' && SAFE_COLOR.test(v) ? v : fallback;
const num = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;
const firstLine = (v: unknown): string =>
  typeof v === 'string' ? (v.split('\n')[0] ?? '').slice(0, 80) : '';

function Shape({ el, design }: { el: Element; design: { width: number; height: number } }): ReactNode {
  const r = resolveLayout(el.layout, design, design);
  const p = el.properties;
  if (![r.x, r.y, r.width, r.height].every(Number.isFinite)) return null;
  const opacity = Math.min(1, Math.max(0, num(p.opacity, 1)));
  if (p.visible === false) return null;
  const common = { opacity };
  switch (el.type) {
    case 'shape': {
      const fill = color(p.fill, RENDER_DEFAULTS.shapeFill);
      const stroke = color(p.stroke, 'transparent');
      const sw = num(p.strokeWidth, 0);
      return p.shape === 'ellipse' ? (
        <ellipse
          cx={r.x + r.width / 2}
          cy={r.y + r.height / 2}
          rx={r.width / 2}
          ry={r.height / 2}
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
          {...common}
        />
      ) : (
        <rect
          x={r.x}
          y={r.y}
          width={r.width}
          height={r.height}
          rx={num(p.radius, 0)}
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
          {...common}
        />
      );
    }
    case 'line':
      return (
        <line
          x1={r.x}
          y1={p.flipY ? r.y + r.height : r.y}
          x2={r.x + r.width}
          y2={p.flipY ? r.y : r.y + r.height}
          stroke={color(p.stroke, RENDER_DEFAULTS.stroke)}
          strokeWidth={Math.max(2, num(p.strokeWidth, RENDER_DEFAULTS.strokeWidth))}
          {...common}
        />
      );
    case 'image':
      return (
        <rect
          x={r.x}
          y={r.y}
          width={r.width}
          height={r.height}
          fill="#9ca3af"
          fillOpacity={0.45}
          {...common}
        />
      );
    case 'text': {
      const fs = num(p.fontSize, RENDER_DEFAULTS.fontSize);
      return (
        <text
          x={r.x}
          y={r.y + fs}
          fontSize={fs}
          fontWeight={p.fontWeight === 'bold' ? 700 : 400}
          fill={color(p.color, RENDER_DEFAULTS.textColor)}
          {...common}
        >
          {firstLine(p.text)}
        </text>
      );
    }
    case 'button': {
      const fs = num(p.fontSize, RENDER_DEFAULTS.fontSize);
      return (
        <g {...common}>
          <rect
            x={r.x}
            y={r.y}
            width={r.width}
            height={r.height}
            rx={6}
            fill={color(p.background, RENDER_DEFAULTS.buttonBackground)}
          />
          <text
            x={r.x + r.width / 2}
            y={r.y + r.height / 2 + fs / 3}
            fontSize={fs}
            textAnchor="middle"
            fill={color(p.color, RENDER_DEFAULTS.textColor)}
          >
            {firstLine(p.text)}
          </text>
        </g>
      );
    }
    case 'input':
      return (
        <rect
          x={r.x}
          y={r.y}
          width={r.width}
          height={r.height}
          fill={RENDER_DEFAULTS.inputBackground}
          stroke={RENDER_DEFAULTS.inputBorder}
          strokeWidth={2}
          {...common}
        />
      );
    default:
      return null;
  }
}

export interface CardThumbnailProps {
  stack: Stack | undefined;
  /** Defaults to the first card in `cardOrder`. */
  cardId?: string | undefined;
  className?: string;
}

/**
 * Small picture of a card, drawn from `resolveLayout` at the design size. It never loads asset
 * bytes (images are neutral boxes), so a missing asset or a bad layout cannot throw.
 */
export function CardThumbnail({ stack, cardId, className }: CardThumbnailProps): ReactNode {
  const card = stack ? stack.cards[cardId ?? stack.cardOrder[0] ?? stack.entryCardId] : undefined;
  const vp = stack?.viewportDefaults;
  const design =
    vp && vp.width > 0 && vp.height > 0
      ? { width: vp.width, height: vp.height }
      : { width: 1280, height: 720 };
  const elements = card ? [...card.elements].sort((a, b) => a.layout.zIndex - b.layout.zIndex) : [];
  return (
    <svg
      className={className}
      viewBox={`0 0 ${design.width} ${design.height}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={card ? `Preview of ${card.title || 'card'}` : 'No preview available'}
    >
      <rect
        width={design.width}
        height={design.height}
        fill={color(card?.background, RENDER_DEFAULTS.cardBackground)}
      />
      {elements.map((el) => (
        <Shape key={el.elementId} el={el} design={design} />
      ))}
    </svg>
  );
}
