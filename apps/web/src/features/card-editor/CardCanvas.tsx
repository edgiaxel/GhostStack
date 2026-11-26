import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react';
import {
  ELEMENT_DEFAULTS,
  resolveFontScale,
  DEFAULT_ELEMENT_PLACEMENT,
  RENDER_DEFAULTS,
  VIEWPORT_PRESETS,
  resolveLayout,
} from '@ghoststack/shared-contracts';
import type { Element, ElementType, ViewportPresetId } from '@ghoststack/shared-contracts';
import { useSessionStack } from '../../app/useStackSession';
import type { EditorSlotProps } from '../../app/editorContext';
import { ApplyScalingButton } from './ApplyScalingButton';
import { ElementContent } from './ElementView';
import {
  HANDLES,
  arrowDelta,
  cascadePosition,
  fitScale,
  minSize,
  moveBox,
  resizeBox,
  toCss,
} from './geometry';
import type { Box, Handle } from './geometry';
import './card-editor.css';

const TYPES: ElementType[] = ['text', 'button', 'input', 'image', 'shape', 'line'];
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

export function CardEditorCanvas({
  session,
  cardId,
  selectedElementId,
  onSelectElement,
  viewport,
  onViewportChange,
}: EditorSlotProps): ReactNode {
  const stack = useSessionStack(session);
  const card = stack.cards[cardId];
  const area = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | undefined>(undefined);
  const [areaWidth, setAreaWidth] = useState(0);
  const [notice, setNotice] = useState<string | undefined>();

  useEffect(() => {
    const node = area.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => setAreaWidth(entries[0]?.contentRect.width ?? 0));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  if (!card) return null;
  const preset = VIEWPORT_PRESETS[viewport];
  const design = stack.viewportDefaults;
  const editable = preset.width === design.width && preset.height === design.height;
  const scale = fitScale(areaWidth, preset.width);
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

  const add = (type: ElementType): void => {
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
    setNotice(r.ok ? undefined : r.error.message);
    if (r.ok) onSelectElement(elementId);
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
        <div role="group" aria-label="Add element" className="gs-ce-group">
          {TYPES.map((t) => (
            <button key={t} type="button" className="gs-btn" disabled={!editable} onClick={() => add(t)}>
              Add {t}
            </button>
          ))}
        </div>
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
        <p className="gs-empty">This card is empty. Use the Add buttons above to place the first element.</p>
      ) : null}
      <div ref={area} className="gs-ce-area">
        <div className="gs-ce-frame" style={{ width: preset.width * scale, height: preset.height * scale }}>
          <div
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
