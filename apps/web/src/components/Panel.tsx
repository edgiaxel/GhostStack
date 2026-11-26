import { useId } from 'react';
import type { ReactNode } from 'react';

export interface PanelProps {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}
export function Panel({ title, actions, children }: PanelProps): ReactNode {
  const id = useId();
  return (
    <section className="gs-kit-panel" aria-labelledby={id}>
      <div className="gs-kit-panelhead">
        <h3 id={id} className="gs-panel-title">
          {title}
        </h3>
        {actions}
      </div>
      {children}
    </section>
  );
}

export interface ToolbarProps {
  label: string;
  children: ReactNode;
}
/** Action row. Left and Right arrows move focus between its buttons. */
export function Toolbar({ label, children }: ToolbarProps): ReactNode {
  return (
    <div
      role="toolbar"
      aria-label={label}
      className="gs-kit-toolbar"
      onKeyDown={(e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const items = [
          ...e.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), a[href], select:not(:disabled)',
          ),
        ];
        const at = items.indexOf(document.activeElement as HTMLElement);
        if (at < 0) return;
        e.preventDefault();
        items[(at + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length]?.focus();
      }}
    >
      {children}
    </div>
  );
}
