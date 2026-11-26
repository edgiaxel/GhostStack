import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { Kbd } from '../../components';
import type { MenuDef, MenuEntry } from './menus';

/**
 * Editor menu bar. The kit `Menu` has no shortcut column and no bar traversal, so this bar reuses the kit
 * classes and `Kbd`. Left and Right move between menus, Up and Down between items, Escape closes.
 */
export function MenuBar({ menus }: { menus: MenuDef[] }): ReactNode {
  const [open, setOpen] = useState<number | undefined>();
  const [item, setItem] = useState(0);
  const [stop, setStop] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const tops = useRef<(HTMLButtonElement | null)[]>([]);
  const items = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (open === undefined) return;
    items.current[item]?.focus();
  }, [open, item]);

  useEffect(() => {
    if (open === undefined) return;
    const away = (e: MouseEvent): void => {
      if (!root.current?.contains(e.target as Node)) setOpen(undefined);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);

  const entries = (i: number): { entry: MenuEntry; index: number }[] =>
    (menus[i]?.items ?? []).flatMap((m, index) => (m === 'separator' ? [] : [{ entry: m, index }]));
  const firstEnabled = (i: number): number => entries(i).find((e) => !e.entry.disabled)?.index ?? 0;
  const openMenu = (i: number): void => {
    setStop(i);
    setItem(firstEnabled(i));
    setOpen(i);
  };
  const close = (focusTop: boolean): void => {
    const at = open;
    setOpen(undefined);
    if (focusTop && at !== undefined) tops.current[at]?.focus();
  };
  const shift = (i: number, dir: 1 | -1): number => (i + dir + menus.length) % menus.length;
  const onTopKey = (e: KeyboardEvent, i: number): void => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const n = shift(i, e.key === 'ArrowRight' ? 1 : -1);
      setStop(n);
      if (open !== undefined) openMenu(n);
      else tops.current[n]?.focus();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      openMenu(i);
    }
  };
  const onMenuKey = (e: KeyboardEvent, i: number): void => {
    const live = entries(i)
      .filter((x) => !x.entry.disabled)
      .map((x) => x.index);
    const at = live.indexOf(item);
    if (e.key === 'ArrowDown') setItem(live[(at + 1) % Math.max(1, live.length)] ?? 0);
    else if (e.key === 'ArrowUp') setItem(live[(at - 1 + live.length) % Math.max(1, live.length)] ?? 0);
    else if (e.key === 'Home') setItem(live[0] ?? 0);
    else if (e.key === 'End') setItem(live[live.length - 1] ?? 0);
    else if (e.key === 'Escape') close(true);
    else if (e.key === 'Tab') setOpen(undefined);
    else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      openMenu(shift(i, e.key === 'ArrowRight' ? 1 : -1));
    } else return;
    if (e.key !== 'Tab') e.preventDefault();
  };

  return (
    <div ref={root} className="gs-ws-menubar" role="menubar" aria-label="Editor menu">
      {menus.map((m, i) => (
        <div key={m.id} className="gs-kit-menu">
          <button
            ref={(el) => {
              tops.current[i] = el;
            }}
            type="button"
            role="menuitem"
            className="gs-btn gs-kit-btn gs-kit-btn--ghost gs-ws-menutop"
            aria-haspopup="menu"
            aria-expanded={open === i}
            tabIndex={stop === i ? 0 : -1}
            onFocus={() => setStop(i)}
            onClick={() => (open === i ? close(false) : openMenu(i))}
            onMouseEnter={() => {
              if (open !== undefined && open !== i) openMenu(i);
            }}
            onKeyDown={(e) => onTopKey(e, i)}
          >
            {m.label}
          </button>
          {open === i ? (
            <div
              role="menu"
              aria-label={m.label}
              className="gs-kit-menulist gs-ws-menulist"
              onKeyDown={(e) => onMenuKey(e, i)}
            >
              {m.items.map((entry, index) =>
                entry === 'separator' ? (
                  <div key={`sep-${index}`} role="separator" className="gs-ws-menusep" />
                ) : (
                  <button
                    key={entry.id}
                    ref={(el) => {
                      items.current[index] = el;
                    }}
                    type="button"
                    role={entry.checked === undefined ? 'menuitem' : 'menuitemradio'}
                    aria-checked={entry.checked}
                    aria-keyshortcuts={entry.shortcut}
                    disabled={entry.disabled}
                    tabIndex={index === item ? 0 : -1}
                    className="gs-kit-menuitem gs-ws-menuitem"
                    onClick={() => {
                      close(true);
                      entry.onSelect();
                    }}
                  >
                    <span className="gs-ws-menucheck" aria-hidden="true">
                      {entry.checked ? '•' : ''}
                    </span>
                    <span className="gs-ws-menulabel">{entry.label}</span>
                    {entry.shortcut ? (
                      <span aria-hidden="true" className="gs-ws-menukey">
                        <Kbd>{entry.shortcut}</Kbd>
                      </span>
                    ) : null}
                  </button>
                ),
              )}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
