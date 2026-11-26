import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { IconButton } from './Button';

export interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Buttons for the footer. */
  actions?: ReactNode;
}
/** Modal on the native `<dialog>`: focus is trapped by the browser, Escape and the close button call `onClose`. */
export function Dialog({ open, title, onClose, children, actions }: DialogProps): ReactNode {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      if (typeof el.showModal === 'function') el.showModal();
      else el.setAttribute('open', '');
    } else if (!open && el.open) {
      if (typeof el.close === 'function') el.close();
      else el.removeAttribute('open');
    }
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="gs-kit-dialog"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open ? (
        <div className="gs-kit-dialogbody">
          <header className="gs-kit-dialoghead">
            <h2 id={titleId} className="gs-kit-dialogtitle">
              {title}
            </h2>
            <IconButton icon="close" label="Close dialog" variant="ghost" onClick={onClose} />
          </header>
          <div>{children}</div>
          {actions ? <footer className="gs-kit-dialogfoot">{actions}</footer> : null}
        </div>
      ) : null}
    </dialog>
  );
}
