import type { CSSProperties, ReactNode } from 'react';
import { RENDER_DEFAULTS } from '@ghoststack/shared-contracts';
import type { Element } from '@ghoststack/shared-contracts';
import { useAssetUrl } from '../../app/assets';

const str = (v: unknown, fallback: string): string => (typeof v === 'string' ? v : fallback);
const num = (v: unknown, fallback: number): number => (typeof v === 'number' ? v : fallback);

function ImageContent({ stackId, element }: { stackId: string; element: Element }): ReactNode {
  const asset = useAssetUrl(stackId, element.assetId);
  const alt = str(element.properties['alt'], '');
  const fit = str(element.properties['fit'], 'contain') as CSSProperties['objectFit'];
  if (element.assetId === undefined) {
    return <div className="gs-ce-fallback">No image chosen. Pick a file in the inspector.</div>;
  }
  if (asset.status === 'loading') return <div className="gs-ce-fallback">Loading image…</div>;
  if (asset.status === 'missing') {
    return (
      <div className="gs-ce-fallback" role="img" aria-label={alt || 'Image file missing'}>
        Image file missing{alt ? `: ${alt}` : ''}
      </div>
    );
  }
  return (
    <img
      src={asset.url}
      alt={alt}
      draggable={false}
      style={{ width: '100%', height: '100%', objectFit: fit }}
    />
  );
}

/** Text a sighted user reads on the element. Part of its accessible name (WCAG 2.5.3). */
export function visibleText(element: Element): string {
  const p = element.properties;
  const raw =
    element.type === 'text' || element.type === 'button'
      ? str(p['text'], '')
      : element.type === 'input'
        ? str(p['defaultValue'], '') || str(p['placeholder'], '')
        : '';
  return raw.replace(/\s+/g, ' ').trim();
}
/** Accessible name of a canvas element: the visible text first, then its name and type. */
export function elementLabel(element: Element, hidden = false): string {
  const text = visibleText(element);
  const base = `${element.name} (${element.type})${hidden ? ', hidden' : ''}`;
  return text ? `${text}, ${base}` : base;
}

/** Inert rendering of one element at its size. Placement is done by the caller. */
export function ElementContent({
  stackId,
  element,
  fontScale = 1,
  assetVersion,
}: {
  stackId: string;
  element: Element;
  fontScale?: number;
  /** Changes when the asset file is replaced under the same id, so the image reloads. */
  assetVersion?: string | undefined;
}): ReactNode {
  const p = element.properties;
  const fontSize = num(p['fontSize'], RENDER_DEFAULTS.fontSize) * fontScale;
  switch (element.type) {
    case 'text':
      return (
        <div
          className="gs-ce-text"
          style={{
            fontSize,
            fontWeight: p['fontWeight'] === 'bold' ? 700 : 400,
            textAlign: (p['align'] as CSSProperties['textAlign']) ?? 'left',
            color: str(p['color'], RENDER_DEFAULTS.textColor),
          }}
        >
          {str(p['text'], '')}
        </div>
      );
    case 'button':
      return (
        <div
          className="gs-ce-button"
          style={{
            fontSize,
            color: str(p['color'], RENDER_DEFAULTS.textColor),
            background: str(p['background'], RENDER_DEFAULTS.buttonBackground),
          }}
        >
          {str(p['text'], '')}
        </div>
      );
    case 'input':
      return (
        <div
          className="gs-ce-input"
          style={{
            fontSize,
            background: RENDER_DEFAULTS.inputBackground,
            borderColor: RENDER_DEFAULTS.inputBorder,
          }}
        >
          {str(p['defaultValue'], '') || (
            <span className="gs-ce-placeholder">{str(p['placeholder'], '')}</span>
          )}
        </div>
      );
    case 'image':
      return <ImageContent key={assetVersion} stackId={stackId} element={element} />;
    case 'shape':
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            background: str(p['fill'], RENDER_DEFAULTS.shapeFill),
            border: `${num(p['strokeWidth'], 0) * fontScale}px solid ${str(p['stroke'], RENDER_DEFAULTS.stroke)}`,
            borderRadius: p['shape'] === 'ellipse' ? '50%' : num(p['radius'], 0) * fontScale,
          }}
        />
      );
    case 'line': {
      const w = Math.max(element.layout.width, 1);
      const h = Math.max(element.layout.height, 1);
      const flip = p['flipY'] === true;
      return (
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${w} ${h}`}
          preserveAspectRatio="none"
          overflow="visible"
          aria-hidden="true"
        >
          <line
            x1={0}
            y1={flip ? h : 0}
            x2={w}
            y2={flip ? 0 : h}
            stroke={str(p['stroke'], RENDER_DEFAULTS.stroke)}
            strokeWidth={num(p['strokeWidth'], RENDER_DEFAULTS.strokeWidth) * fontScale}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      );
    }
  }
}
