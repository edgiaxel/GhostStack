import { useId, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';

export interface TabItem {
  id: string;
  label: string;
  panel: ReactNode;
  disabled?: boolean;
}
export interface TabsProps {
  tabs: TabItem[];
  label: string;
  value?: string;
  defaultValue?: string;
  onChange?: (id: string) => void;
}
/** ARIA tabs: arrow keys, Home and End move and select; only the active tab is in the tab order. */
export function Tabs({ tabs, label, value, defaultValue, onChange }: TabsProps): ReactNode {
  const base = useId();
  const [inner, setInner] = useState(defaultValue ?? tabs[0]?.id ?? '');
  const active = value ?? inner;
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const enabled = tabs.filter((t) => !t.disabled);
  const select = (id: string): void => {
    setInner(id);
    onChange?.(id);
    refs.current[id]?.focus();
  };
  const onKey = (e: KeyboardEvent): void => {
    const i = enabled.findIndex((t) => t.id === active);
    let next: number | undefined;
    if (e.key === 'ArrowRight') next = (i + 1) % enabled.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + enabled.length) % enabled.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = enabled.length - 1;
    const target = next === undefined ? undefined : enabled[next];
    if (!target) return;
    e.preventDefault();
    select(target.id);
  };
  const current = tabs.find((t) => t.id === active);
  return (
    <div className="gs-kit-tabs">
      <div role="tablist" aria-label={label} className="gs-kit-tablist" onKeyDown={onKey}>
        {tabs.map((t) => (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el;
            }}
            type="button"
            role="tab"
            id={`${base}-tab-${t.id}`}
            aria-selected={t.id === active}
            aria-controls={`${base}-panel-${t.id}`}
            tabIndex={t.id === active ? 0 : -1}
            disabled={t.disabled}
            className="gs-kit-tab"
            onClick={() => select(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {current ? (
        <div
          role="tabpanel"
          id={`${base}-panel-${current.id}`}
          aria-labelledby={`${base}-tab-${current.id}`}
          className="gs-kit-tabpanel"
        >
          {current.panel}
        </div>
      ) : null}
    </div>
  );
}
