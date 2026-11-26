import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon } from './Icon';
import { IconButton } from './Button';

export type ToastKind = 'info' | 'success' | 'warning' | 'error';
export interface ToastInput {
  kind?: ToastKind;
  message: string;
}
interface ToastItem extends ToastInput {
  id: number;
  kind: ToastKind;
}
interface ToastApi {
  push: (t: ToastInput) => void;
}
const Ctx = createContext<ToastApi | null>(null);
const ICON = { info: 'info', success: 'check', warning: 'alert', error: 'alert' } as const;

export function useToast(): ToastApi {
  const api = useContext(Ctx);
  if (!api) throw new Error('useToast needs a ToastProvider');
  return api;
}
/** Errors stay until dismissed. Other kinds close after 6 seconds. */
export function ToastProvider({
  children,
  duration = 6000,
}: {
  children: ReactNode;
  duration?: number;
}): ReactNode {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const dismiss = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const push = useCallback((t: ToastInput) => {
    seq.current += 1;
    setItems((l) => [...l, { ...t, kind: t.kind ?? 'info', id: seq.current }]);
  }, []);
  const api = useMemo(() => ({ push }), [push]);
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="gs-kit-toasts" role="region" aria-label="Notifications">
        {items.map((t) => (
          <ToastView key={t.id} item={t} duration={duration} onDismiss={dismiss} />
        ))}
      </div>
    </Ctx.Provider>
  );
}
function ToastView({
  item,
  duration,
  onDismiss,
}: {
  item: ToastItem;
  duration: number;
  onDismiss: (id: number) => void;
}): ReactNode {
  useEffect(() => {
    if (item.kind === 'error') return;
    const t = setTimeout(() => onDismiss(item.id), duration);
    return () => clearTimeout(t);
  }, [item, duration, onDismiss]);
  return (
    <div
      className={`gs-kit-toast gs-kit-toast--${item.kind}`}
      role={item.kind === 'error' ? 'alert' : 'status'}
    >
      <Icon name={ICON[item.kind]} />
      <span className="gs-kit-toastmsg">{item.message}</span>
      <IconButton
        icon="close"
        label="Dismiss notification"
        variant="ghost"
        onClick={() => onDismiss(item.id)}
      />
    </div>
  );
}
