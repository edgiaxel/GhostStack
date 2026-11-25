import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from './router';
import { THEMES, applyTheme, loadTheme } from './theme';
import type { ThemeId } from './theme';

/** The only navbar. Features render inside `children`; they never render their own toolbar. */
export function AppShell({ children }: { children: ReactNode }): ReactNode {
  const [theme, setTheme] = useState<ThemeId>(loadTheme);
  return (
    <div className="gs-shell">
      <header className="gs-toolbar">
        <span className="gs-brand">GhostStack</span>
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
      </header>
      <main className="gs-main">{children}</main>
    </div>
  );
}

export interface WorkspaceLayoutProps {
  navigator: ReactNode;
  canvas: ReactNode;
  inspector: ReactNode;
  drawer?: ReactNode;
}

/** The only workspace layout (DESIGN section 2). Features fill slots; they never restyle the grid. */
export function WorkspaceLayout({ navigator, canvas, inspector, drawer }: WorkspaceLayoutProps): ReactNode {
  return (
    <div className="gs-workspace">
      <aside className="gs-panel gs-area-nav" aria-label="Navigator">
        {navigator}
      </aside>
      <section className="gs-area-canvas" aria-label="Card canvas">
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
