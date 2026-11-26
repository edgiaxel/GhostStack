import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { Icon } from './Icon';
import type { IconName } from './Icon';

export interface MenuItem {
  id: string;
  label: string;
  onSelect: () => void;
  icon?: IconName;
  disabled?: boolean;
  danger?: boolean;
}
export interface MenuProps {
  label: string;
  items: MenuItem[];
}
/** Menu button. Arrow keys move, Enter or Space selects, Escape closes and returns focus to the trigger. */
export function Menu({ label, items }: MenuProps): ReactNode {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    if (!open) return;
    refs.current[index]?.focus();
  }, [open, index]);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent): void => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);
  const live = items.map((m, i) => (m.disabled ? -1 : i)).filter((i) => i >= 0);
  const close = (): void => {
    setOpen(false);
    trigger.current?.focus();
  };
  const move = (dir: 1 | -1): void => {
    if (live.length === 0) return;
    const at = live.indexOf(index);
    setIndex(live[(at + dir + live.length) % live.length]!);
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'ArrowDown') move(1);
    else if (e.key === 'ArrowUp') move(-1);
    else if (e.key === 'Home') setIndex(live[0] ?? 0);
    else if (e.key === 'End') setIndex(live[live.length - 1] ?? 0);
    else if (e.key === 'Escape') close();
    else if (e.key === 'Tab') setOpen(false);
    else return;
    if (e.key !== 'Tab') e.preventDefault();
  };
  return (
    <div className="gs-kit-menu" ref={root}>
      <button
        ref={trigger}
        type="button"
        className="gs-btn gs-kit-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => {
          setIndex(live[0] ?? 0);
          setOpen((o) => !o);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            setIndex(live[0] ?? 0);
            setOpen(true);
          }
        }}
      >
        {label}
        <Icon name="chevron-down" size={14} />
      </button>
      {open ? (
        <div id={id} role="menu" aria-label={label} className="gs-kit-menulist" onKeyDown={onKey}>
          {items.map((m, i) => (
            <button
              key={m.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="menuitem"
              disabled={m.disabled}
              tabIndex={i === index ? 0 : -1}
              className={`gs-kit-menuitem${m.danger ? ' gs-kit-menuitem--danger' : ''}`}
              onClick={() => {
                close();
                m.onSelect();
              }}
            >
              {m.icon ? <Icon name={m.icon} size={16} /> : null}
              {m.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
