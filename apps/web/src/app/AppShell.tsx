import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from './router';
import { ACCENTS, THEMES, applyAccent, applyTheme, loadAccent, loadTheme } from './theme';
import type { AccentId, ThemeId } from './theme';
import { ToastProvider } from '../components';
/** The only navbar. Features render inside `children`; they never render their own toolbar. */
export function AppShell({ children }: { children: ReactNode }): ReactNode {
  const [theme, setTheme] = useState<ThemeId>(loadTheme);
  const [accent, setAccent] = useState<AccentId>(loadAccent);
  useEffect(() => applyAccent(loadAccent()), []);
  return (
    <ToastProvider>
      <div className="gs-shell">
        <header className="gs-toolbar">
          <span className="gs-brand">
            <img src={`${import.meta.env.BASE_URL}brand/mark.svg`} alt="" width={24} height={24} />
            GhostStack
          </span>
          <nav className="gs-nav" aria-label="Primary">
            <Link to="/library">Library</Link>
          </nav>
          <span className="gs-spacer" />
          <label>
            <span className="gs-panel-title" style={{ marginRight: 8 }}>
              Theme
            </span>
            <select
              className="gs-input"
              value={theme}
              onChange={(e) => {
                const next = THEMES.find((t) => t === e.target.value) ?? 'spectral';
                applyTheme(next);
                setTheme(next);
              }}
            >
              {THEMES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="gs-panel-title" style={{ marginRight: 8 }}>
              Accent
            </span>
            <select
              className="gs-input"
              value={accent}
              onChange={(e) => {
                const next = ACCENTS.find((a) => a === e.target.value) ?? 'default';
                applyAccent(next);
                setAccent(next);
              }}
            >
              <option value="default">default</option>
              {ACCENTS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
        </header>
        <main className="gs-main">{children}</main>
      </div>
    </ToastProvider>
  );
}
export interface WorkspaceLayoutProps {
  navigator: ReactNode;
  canvas: ReactNode;
  inspector: ReactNode;
  /** Action row above the canvas (history, preview, export). Not a navbar. */
  toolbar?: ReactNode;
  drawer?: ReactNode;
}

/** The only workspace layout (DESIGN section 2). Features fill slots; they never restyle the grid. */
export function WorkspaceLayout({
  navigator,
  canvas,
  inspector,
  toolbar,
  drawer,
}: WorkspaceLayoutProps): ReactNode {
  return (
    <div className="gs-workspace">
      <aside className="gs-panel gs-area-nav" aria-label="Navigator">
        {navigator}
      </aside>
      <section className="gs-area-canvas" aria-label="Card canvas">
        {toolbar ? (
          <div className="gs-canvas-toolbar" role="toolbar" aria-label="Stack actions">
            {toolbar}
          </div>
        ) : null}
        {canvas}
      </section>
      <aside className="gs-panel gs-area-inspector" aria-label="Inspector">
        {inspector}
      </aside>
      {drawer ? (
        <footer className="gs-panel gs-area-drawer" aria-label="Console">
          {drawer}
        </footer>
      ) : null}
    </div>
  );
}
