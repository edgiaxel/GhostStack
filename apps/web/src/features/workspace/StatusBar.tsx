import type { ReactNode } from 'react';
import { MAX_ZOOM, MIN_ZOOM } from '../card-editor/zoom';

export interface StatusBarProps {
  cardPosition: string;
  saveText: string;
  saveError: boolean;
  selected: string;
  scale: number;
  fitMode: boolean;
  viewport: string;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onActual: () => void;
  /** Provider chip from `features/ai`, wired by the workspace. */
  aiChip?: ReactNode;
}

/** Card position, save state, selection, zoom and viewport. The zoom buttons repeat the View menu. */
export function StatusBar(p: StatusBarProps): ReactNode {
  const pct = Math.round(p.scale * 100);
  const btn = 'gs-btn gs-kit-btn gs-kit-btn--ghost gs-ws-statusbtn';
  return (
    <div className="gs-ws-status" role="group" aria-label="Status bar">
      <span data-testid="status-card">{p.cardPosition}</span>
      <span data-testid="status-save" className={p.saveError ? 'gs-error' : undefined}>
        {p.saveText}
      </span>
      <span data-testid="status-selection">{p.selected}</span>
      <span className="gs-spacer" />
      {p.aiChip}
      <span data-testid="status-viewport">{p.viewport}</span>
      <span className="gs-ws-zoom" role="group" aria-label="Zoom">
        <button
          type="button"
          className={btn}
          aria-label="Zoom out"
          disabled={p.scale <= MIN_ZOOM + 1e-6}
          onClick={p.onZoomOut}
        >
          −
        </button>
        <span data-testid="status-zoom" aria-label={`Zoom ${pct} percent${p.fitMode ? ', fit' : ''}`}>
          {pct}%
        </span>
        <button
          type="button"
          className={btn}
          aria-label="Zoom in"
          disabled={p.scale >= MAX_ZOOM - 1e-6}
          onClick={p.onZoomIn}
        >
          +
        </button>
        <button type="button" className={btn} aria-pressed={p.fitMode} onClick={p.onFit}>
          Fit
        </button>
        <button type="button" className={btn} aria-label="100%, Actual size" onClick={p.onActual}>
          100%
        </button>
      </span>
    </div>
  );
}
