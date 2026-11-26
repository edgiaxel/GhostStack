import { useRef } from 'react';
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react';

export interface SplitterProps {
  label: string;
  /** `vertical` is a bar between columns; `horizontal` a bar above a row. */
  orientation: 'vertical' | 'horizontal';
  value: number;
  min: number;
  max: number;
  /** True when dragging toward the start (left or up) makes the panel larger. */
  grows: 'with-pointer' | 'against-pointer';
  onChange: (size: number) => void;
  onToggle: () => void;
}

const STEP = 16;

/** Resize handle. Pointer drag and arrow keys resize, Home and End jump to the limits, Enter collapses. */
export function Splitter({
  label,
  orientation,
  value,
  min,
  max,
  grows,
  onChange,
  onToggle,
}: SplitterProps): ReactNode {
  const start = useRef<{ at: number; size: number } | undefined>(undefined);
  const axis = (e: { clientX: number; clientY: number }): number =>
    orientation === 'vertical' ? e.clientX : e.clientY;
  const sign = grows === 'with-pointer' ? 1 : -1;
  const onPointerDown = (e: PointerEvent<HTMLDivElement>): void => {
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { at: axis(e), size: value };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>): void => {
    const s = start.current;
    if (s) onChange(s.size + sign * (axis(e) - s.at));
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>): void => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    start.current = undefined;
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    const bigger =
      orientation === 'vertical'
        ? grows === 'with-pointer'
          ? 'ArrowRight'
          : 'ArrowLeft'
        : grows === 'with-pointer'
          ? 'ArrowDown'
          : 'ArrowUp';
    const smaller =
      orientation === 'vertical'
        ? grows === 'with-pointer'
          ? 'ArrowLeft'
          : 'ArrowRight'
        : grows === 'with-pointer'
          ? 'ArrowUp'
          : 'ArrowDown';
    const step = e.shiftKey ? STEP * 4 : STEP;
    if (e.key === bigger) onChange(value + step);
    else if (e.key === smaller) onChange(value - step);
    else if (e.key === 'Home') onChange(min);
    else if (e.key === 'End') onChange(max);
    else if (e.key === 'Enter') onToggle();
    else return;
    e.preventDefault();
  };
  return (
    <div
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation={orientation}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      className={`gs-ws-splitter gs-ws-splitter--${orientation}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onToggle}
      onKeyDown={onKeyDown}
    />
  );
}
