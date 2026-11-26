import { cloneElement, useId, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';

export interface TooltipProps {
  text: string;
  /** One focusable element. It gets `aria-describedby`. */
  children: ReactElement<{ 'aria-describedby'?: string }>;
}
/** Shows on hover and keyboard focus, hides on Escape. Supplements a visible or accessible name; never replaces it. */
export function Tooltip({ text, children }: TooltipProps): ReactNode {
  const id = useId();
  const [show, setShow] = useState(false);
  return (
    <span
      className="gs-kit-tooltipwrap"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setShow(false);
      }}
    >
      {cloneElement(children, { 'aria-describedby': id })}
      <span id={id} role="tooltip" className="gs-kit-tooltip" hidden={!show}>
        {text}
      </span>
    </span>
  );
}
