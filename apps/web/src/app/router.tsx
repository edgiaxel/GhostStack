import { useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';

/** Hash router. Central file: features never edit it. */
export interface RouteMatch {
  params: Record<string, string>;
}

export interface RouteDef {
  /** e.g. `/stack/:stackId/card/:cardId` */
  path: string;
  render: (match: RouteMatch) => ReactNode;
}

function subscribe(cb: () => void): () => void {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}
const snapshot = (): string => window.location.hash.replace(/^#/, '') || '/';

export function useLocation(): string {
  return useSyncExternalStore(subscribe, snapshot);
}

export function navigate(path: string): void {
  window.location.hash = path;
}

export function matchPath(pattern: string, path: string): RouteMatch | undefined {
  const p = pattern.split('/').filter(Boolean);
  const q = path.split('?')[0]!.split('/').filter(Boolean);
  if (p.length !== q.length) return undefined;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    const seg = p[i]!;
    const val = q[i]!;
    if (seg.startsWith(':')) params[seg.slice(1)] = decodeURIComponent(val);
    else if (seg !== val) return undefined;
  }
  return { params };
}

export function Router({ routes, fallback }: { routes: RouteDef[]; fallback: ReactNode }): ReactNode {
  const loc = useLocation();
  for (const r of routes) {
    const m = matchPath(r.path, loc);
    if (m) return r.render(m);
  }
  return fallback;
}

export function Link({ to, children }: { to: string; children: ReactNode }): ReactNode {
  const loc = useLocation();
  const active = loc === to || loc.startsWith(to + '/');
  return (
    <a href={`#${to}`} aria-current={active ? 'page' : undefined}>
      {children}
    </a>
  );
}
