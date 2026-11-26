import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react';
import {
  ELEMENT_DEFAULTS,
  resolveFontScale,
  DEFAULT_ELEMENT_PLACEMENT,
  RENDER_DEFAULTS,
  VIEWPORT_PRESETS,
  resolveLayout,
} from '@ghoststack/shared-contracts';
import type {
  Element,
  ElementType,
  Stack,
  StackSession,
  ViewportPresetId,
} from '@ghoststack/shared-contracts';
import { useSessionStack } from '../../app/useStackSession';
import type { EditorSlotProps } from '../../app/editorContext';
import { ApplyScalingButton } from './ApplyScalingButton';
import { ElementContent } from './ElementView';
import { HANDLES, arrowDelta, cascadePosition, minSize, moveBox, resizeBox, toCss } from './geometry';
import type { Box, Handle } from './geometry';
import {
  FIT,
  clampZoom,
  fitZoom,
  pointUnderCursor,
  resolveZoom,
  scrollDeltaToPin,
  wheelFactor,
} from './zoom';
import type { ZoomState } from './zoom';
import './card-editor.css';
import './zoom.css';

const HANDLE_CURSOR: Record<Handle, string> = {
  n: 'ns',
  s: 'ns',
  e: 'ew',
  w: 'ew',
  ne: 'nesw',
  sw: 'nesw',
  nw: 'nwse',
  se: 'nwse',
};

interface Drag {
  elementId: string;
  mode: 'move' | Handle;
  startX: number;
  startY: number;
  box: Box;
  type: ElementType;
}

/** Elements back to front. Ties keep authoring order. */
export const inZOrder = (elements: Element[]): Element[] =>
  elements
    .map((e, i) => ({ e, i }))
    .sort((a, b) => a.e.layout.zIndex - b.e.layout.zIndex || a.i - b.i)
    .map(({ e }) => e);

/** True when the viewport preset is the Stack's design size, the only size where elements can be edited. */
export const isDesignViewport = (stack: Stack, viewport: ViewportPresetId): boolean => {
  const preset = VIEWPORT_PRESETS[viewport];
  return preset.width === stack.viewportDefaults.width && preset.height === stack.viewportDefaults.height;
};

/** Adds one element of `type` to the card with the type defaults, through `session.dispatch`. */
export function addElementToCard(
  session: StackSession,
  cardId: string,
  type: ElementType,
): { ok: true; elementId: string } | { ok: false; message: string } {
  const card = session.getStack().cards[cardId];
  if (!card) return { ok: false, message: 'That card no longer exists.' };
  const d = ELEMENT_DEFAULTS[type];
  const sameType = card.elements.filter((e) => e.type === type).length;
  const pos = cascadePosition(card.elements.length);
  const elementId = `${type}-${crypto.randomUUID().slice(0, 6)}`;
  const r = session.dispatch({
    type: 'ADD_ELEMENT',
    cardId,
    element: {
      elementId,
      type,
      name: `${d.name} ${sameType + 1}`,
      properties: { ...d.properties },
      layout: { ...pos, width: d.width, height: d.height, zIndex: 0, ...DEFAULT_ELEMENT_PLACEMENT },
      behaviors: [],
    },
  });
  return r.ok ? { ok: true, elementId } : { ok: false, message: r.error.message };
}

/** Space starts a pan unless the key belongs to a control. Canvas elements do not count as controls. */
const isTypingTarget = (t: EventTarget | null): boolean =>
  t instanceof HTMLElement &&
  (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(t.tagName));

export interface CardCanvasProps extends EditorSlotProps {
  /** Zoom owned by the shell. Defaults to Fit. */
  zoom?: ZoomState;
  onZoomChange?: (zoom: ZoomState) => void;
  /** Reports the scale actually applied (Fit resolves to a number). */
  onScaleChange?: (scale: number) => void;
  /** True while the Hand tool is active. Space-drag and middle-button drag always pan. */
  panMode?: boolean;
}

export function CardEditorCanvas({
  session,
  cardId,
  selectedElementId,
  onSelectElement,
  viewport,
  onViewportChange,
  zoom = FIT,
  onZoomChange,
  onScaleChange,
  panMode = false,
}: CardCanvasProps): ReactNode {
  const stack = useSessionStack(session);
  const card = stack.cards[cardId];
  const area = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | undefined>(undefined);
  const panning = useRef<{ x: number; y: number; left: number; top: number } | undefined>(undefined);
  const pin = useRef<{ cx: number; cy: number; px: number; py: number } | undefined>(undefined);
  const view = useRef<{ scale: number; left: number; top: number } | undefined>(undefined);
  const scaleRef = useRef(1);
  const [areaSize, setAreaSize] = useState({ w: 0, h: 0 });
  const [spaceDown, setSpaceDown] = useState(false);
  const [notice, setNotice] = useState<string | undefined>();
  const hasCard = card !== undefined;
  const preset = VIEWPORT_PRESETS[viewport];
  const design = stack.viewportDefaults;
  const editable = isDesignViewport(stack, viewport);
  // The frame has a 1px border and the area 2px padding on each side: keep Fit clear of scrollbars.
  const fit = fitZoom(Math.max(0, areaSize.w - 6), Math.max(0, areaSize.h - 6), preset.width, preset.height);
  const scale = resolveZoom(zoom, fit);
  const panActive = panMode || spaceDown;

  useEffect(() => {
    const node = area.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      setAreaSize({ w: Math.round(r?.width ?? 0), h: Math.round(r?.height ?? 0) });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasCard]);

  useEffect(() => {
    onScaleChange?.(scale);
  }, [scale, onScaleChange]);

  // After a scale change keep the point under the cursor (wheel) or the middle of the view (buttons) fixed.
  useLayoutEffect(() => {
    scaleRef.current = scale;
    const a = area.current;
    const s = stageRef.current;
    if (!a || !s) return;
    const ar = a.getBoundingClientRect();
    const prev = view.current;
    if (prev && prev.scale !== scale) {
      const cx = a.clientWidth / 2;
      const cy = a.clientHeight / 2;
      const at = pin.current ?? {
        cx,
        cy,
        px: pointUnderCursor(cx, prev.left, prev.scale),
        py: pointUnderCursor(cy, prev.top, prev.scale),
      };
      const sr = s.getBoundingClientRect();
      a.scrollLeft += scrollDeltaToPin(at.cx, sr.left - ar.left, at.px, scale);
      a.scrollTop += scrollDeltaToPin(at.cy, sr.top - ar.top, at.py, scale);
    }
    pin.current = undefined;
    const sr = s.getBoundingClientRect();
    view.current = { scale, left: sr.left - ar.left, top: sr.top - ar.top };
  });

  useEffect(() => {
    const a = area.current;
    if (!a) return;
    const remember = (): void => {
      const s = stageRef.current;
      if (!s) return;
      const ar = a.getBoundingClientRect();
      const sr = s.getBoundingClientRect();
      view.current = { scale: scaleRef.current, left: sr.left - ar.left, top: sr.top - ar.top };
    };
    const onWheel = (e: WheelEvent): void => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const s = stageRef.current;
      if (!onZoomChange || !s) return;
      const ar = a.getBoundingClientRect();
      const sr = s.getBoundingClientRect();
      pin.current = {
        cx: e.clientX - ar.left,
        cy: e.clientY - ar.top,
        px: pointUnderCursor(e.clientX, sr.left, scaleRef.current),
        py: pointUnderCursor(e.clientY, sr.top, scaleRef.current),
      };
      onZoomChange({ mode: 'manual', scale: clampZoom(scaleRef.current * wheelFactor(e.deltaY)) });
    };
    a.addEventListener('wheel', onWheel, { passive: false });
    a.addEventListener('scroll', remember, { passive: true });
    return () => {
      a.removeEventListener('wheel', onWheel);
      a.removeEventListener('scroll', remember);
    };
  }, [onZoomChange, hasCard]);

  useEffect(() => {
    const down = (e: globalThis.KeyboardEvent): void => {
      if (e.code !== 'Space' || e.repeat || isTypingTarget(e.target)) return;
      e.preventDefault();
      setSpaceDown(true);
    };
    const up = (e: globalThis.KeyboardEvent): void => {
      if (e.code === 'Space') setSpaceDown(false);
    };
    const reset = (): void => setSpaceDown(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', reset);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', reset);
    };
  }, []);

  if (!card) return null;
  const elements = inZOrder(card.elements);
  const selected = elements.find((e) => e.elementId === selectedElementId);

  const update = (elementId: string, layout: Partial<Box>, key: string): void => {
    const r = session.dispatch(
      { type: 'UPDATE_ELEMENT', cardId, elementId, patch: { layout } },
      { coalesceKey: key },
    );
    setNotice(r.ok ? undefined : r.error.message);
  };

  const remove = (elementId: string): void => {
    const r = session.dispatch({ type: 'DELETE_ELEMENT', cardId, elementId });
    setNotice(r.ok ? undefined : r.error.message);
    if (r.ok) onSelectElement(undefined);
  };

  const begin = (e: PointerEvent<HTMLElement>, element: Element, mode: Drag['mode']): void => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      elementId: element.elementId,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      box: element.layout,
      type: element.type,
    };
  };

  const onMove = (e: PointerEvent<HTMLElement>): void => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) / scale;
    const dy = (e.clientY - d.startY) / scale;
    if (d.mode === 'move') update(d.elementId, moveBox(d.box, dx, dy), `move:${d.elementId}`);
    else update(d.elementId, resizeBox(d.box, d.mode, dx, dy, minSize(d.type)), `resize:${d.elementId}`);
  };

  const end = (e: PointerEvent<HTMLElement>): void => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    drag.current = undefined;
  };

  const onKey = (e: KeyboardEvent<HTMLElement>, element: Element): void => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Escape') return onSelectElement(undefined);
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      return onSelectElement(element.elementId);
    }
    if (!editable) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      return remove(element.elementId);
    }
    const delta = arrowDelta(e.key, e.shiftKey);
    if (!delta) return;
    e.preventDefault();
    if (e.altKey) {
      update(
        element.elementId,
        resizeBox(element.layout, 'se', delta.dx, delta.dy, minSize(element.type)),
        `resize:${element.elementId}`,
      );
    } else {
      update(element.elementId, moveBox(element.layout, delta.dx, delta.dy), `move:${element.elementId}`);
    }
  };

  return (
    <div className="gs-ce">
      <div className="gs-ce-bar">
        <div role="radiogroup" aria-label="Viewport" className="gs-ce-group">
          {(Object.keys(VIEWPORT_PRESETS) as ViewportPresetId[]).map((id) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={viewport === id}
              className={`gs-btn${viewport === id ? ' gs-btn--primary' : ''}`}
              onClick={() => onViewportChange(id)}
            >
              {VIEWPORT_PRESETS[id].label}
            </button>
          ))}
        </div>
      </div>
      <div className="gs-ce-row">
        <p className="gs-ce-note" role="note">
          {editable
            ? `${card.title || 'Untitled card'} · ${preset.width} × ${preset.height}`
            : `Previewing anchoring at ${preset.label} (${preset.width} × ${preset.height}). Switch to ${VIEWPORT_PRESETS.desktop.label} to move or resize.`}
        </p>
        <ApplyScalingButton session={session} cardId={cardId} disabled={!editable} />
      </div>
      {notice ? (
        <p className="gs-error" role="alert">
          {notice}
        </p>
      ) : null}
      {card.elements.length === 0 ? (
        <p className="gs-empty">
          This card is empty. Pick a tool in the tool rail or use the Insert menu to place the first element.
        </p>
      ) : null}
      <div
        ref={area}
        className="gs-ce-area"
        data-pan={panActive}
        data-testid="canvas-area"
        onPointerDownCapture={(e) => {
          if (!(panActive && e.button === 0) && e.button !== 1) return;
          e.preventDefault();
          e.stopPropagation();
          e.currentTarget.setPointerCapture(e.pointerId);
          panning.current = {
            x: e.clientX,
            y: e.clientY,
            left: e.currentTarget.scrollLeft,
            top: e.currentTarget.scrollTop,
          };
        }}
        onPointerMove={(e) => {
          const p = panning.current;
          if (!p) return;
          e.currentTarget.scrollLeft = p.left - (e.clientX - p.x);
          e.currentTarget.scrollTop = p.top - (e.clientY - p.y);
        }}
        onPointerUp={(e) => {
          if (panning.current && e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
          }
          panning.current = undefined;
        }}
        onPointerCancel={() => {
          panning.current = undefined;
        }}
      >
        <div className="gs-ce-frame" style={{ width: preset.width * scale, height: preset.height * scale }}>
          <div
            ref={stageRef}
            className="gs-ce-stage"
            data-testid="card-stage"
            style={{
              width: preset.width,
              height: preset.height,
              transform: `scale(${scale})`,
              background: card.background ?? RENDER_DEFAULTS.cardBackground,
            }}
            onPointerDown={(e) => {
              if (e.target === e.currentTarget) onSelectElement(undefined);
            }}
          >
            {elements.map((element) => {
              const rect = resolveLayout(element.layout, design, preset);
              const isSelected = selected?.elementId === element.elementId;
              const hidden = element.properties['visible'] === false;
              const opacity =
                typeof element.properties['opacity'] === 'number' ? element.properties['opacity'] : 1;
              return (
                <div
                  key={element.elementId}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  aria-label={`${element.name} (${element.type})${hidden ? ', hidden' : ''}`}
                  className="gs-ce-el"
                  data-selected={isSelected}
                  data-hidden={hidden}
                  style={{
                    ...toCss(rect),
                    opacity: hidden ? Math.min(opacity, 0.35) : opacity,
                    zIndex: element.layout.zIndex,
                    cursor: editable ? 'move' : 'pointer',
                  }}
                  onFocus={() => onSelectElement(element.elementId)}
                  onPointerDown={(e) => {
                    onSelectElement(element.elementId);
                    if (editable && e.button === 0) begin(e, element, 'move');
                  }}
                  onPointerMove={onMove}
                  onPointerUp={end}
                  onPointerCancel={end}
                  onKeyDown={(e) => onKey(e, element)}
                >
                  <ElementContent
                    stackId={stack.stackId}
                    element={element}
                    fontScale={resolveFontScale(element.layout, rect)}
                  />
                  {isSelected && editable
                    ? HANDLES.map((h) => (
                        <span
                          key={h}
                          aria-hidden="true"
                          className={`gs-ce-handle gs-ce-handle--${h}`}
                          style={{ cursor: `${HANDLE_CURSOR[h]}-resize` }}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            begin(e, element, h);
                          }}
                          onPointerMove={onMove}
                          onPointerUp={end}
                          onPointerCancel={end}
                        />
                      ))
                    : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
