import type { CSSProperties, ReactNode } from 'react';
import { IconButton } from '../../components';
import { COLLAPSED_SIZE, PANEL_LIMITS } from './layoutPrefs';
import type { PanelId } from './layoutPrefs';
import { Splitter } from './Splitter';
import type { PanelPrefs } from './usePanels';

export interface EditorShellProps {
  prefs: PanelPrefs;
  onSize: (id: PanelId, size: number) => void;
  onToggle: (id: PanelId) => void;
  menubar: ReactNode;
  toolbar: ReactNode;
  toolrail: ReactNode;
  navigator: ReactNode;
  canvas: ReactNode;
  inspector: ReactNode;
  drawer: ReactNode;
  statusbar: ReactNode;
}

function PanelHead({
  title,
  id,
  collapsed,
  onToggle,
  side,
}: {
  title: string;
  id: PanelId;
  collapsed: boolean;
  onToggle: (id: PanelId) => void;
  side: 'left' | 'right' | 'bottom';
}): ReactNode {
  const verb = collapsed ? 'Expand' : 'Collapse';
  const bottom = side === 'bottom';
  // Chevrons point at the direction the panel will move: toward its edge when expanded.
  const flip = bottom ? collapsed : side === 'left' ? !collapsed : collapsed;
  return (
    <div className="gs-ws-panelhead">
      <h2 className="gs-panel-title gs-ws-paneltitle">{title}</h2>
      <IconButton
        variant="ghost"
        icon={bottom ? 'chevron-down' : 'chevron-right'}
        label={`${verb} ${title.toLowerCase()}`}
        aria-expanded={!collapsed}
        className="gs-ws-chev"
        data-flip={flip}
        onClick={() => onToggle(id)}
      />
    </div>
  );
}

/**
 * The editor grid: menu bar, action toolbar, tool rail, navigator, canvas, inspector, console and status bar.
 * Panels keep the `gs-panel gs-area-*` classes so the audit specs and base styles still find them.
 */
export function EditorShell(p: EditorShellProps): ReactNode {
  const { prefs } = p;
  const size = (id: PanelId): number => (prefs[id].collapsed ? COLLAPSED_SIZE : prefs[id].size);
  const style = {
    '--ws-nav': `${size('navigator')}px`,
    '--ws-insp': `${size('inspector')}px`,
    '--ws-drawer': `${size('drawer')}px`,
  } as CSSProperties;
  const lim = PANEL_LIMITS;
  return (
    <div className="gs-ws" style={style}>
      <div className="gs-ws-top">
        {p.menubar}
        <div className="gs-ws-actions">{p.toolbar}</div>
      </div>
      <div className="gs-ws-body">
        <aside
          className="gs-panel gs-area-nav gs-ws-pane"
          aria-label="Navigator"
          data-collapsed={prefs.navigator.collapsed}
        >
          <PanelHead
            title="Cards"
            id="navigator"
            collapsed={prefs.navigator.collapsed}
            onToggle={p.onToggle}
            side="left"
          />
          <div className="gs-ws-panebody" hidden={prefs.navigator.collapsed}>
            {p.navigator}
          </div>
        </aside>
        <Splitter
          label="Resize navigator"
          orientation="vertical"
          value={prefs.navigator.size}
          min={lim.navigator.min}
          max={lim.navigator.max}
          grows="with-pointer"
          onChange={(n) => p.onSize('navigator', n)}
          onToggle={() => p.onToggle('navigator')}
        />
        <section className="gs-area-canvas gs-ws-canvas" aria-label="Card canvas">
          {p.toolrail}
          <div className="gs-ws-canvascol">{p.canvas}</div>
        </section>
        <Splitter
          label="Resize inspector"
          orientation="vertical"
          value={prefs.inspector.size}
          min={lim.inspector.min}
          max={lim.inspector.max}
          grows="against-pointer"
          onChange={(n) => p.onSize('inspector', n)}
          onToggle={() => p.onToggle('inspector')}
        />
        <aside
          className="gs-panel gs-area-inspector gs-ws-pane"
          aria-label="Inspector"
          data-collapsed={prefs.inspector.collapsed}
        >
          <PanelHead
            title="Inspector"
            id="inspector"
            collapsed={prefs.inspector.collapsed}
            onToggle={p.onToggle}
            side="right"
          />
          <div className="gs-ws-panebody" hidden={prefs.inspector.collapsed}>
            {p.inspector}
          </div>
        </aside>
        <Splitter
          label="Resize console"
          orientation="horizontal"
          value={prefs.drawer.size}
          min={lim.drawer.min}
          max={lim.drawer.max}
          grows="against-pointer"
          onChange={(n) => p.onSize('drawer', n)}
          onToggle={() => p.onToggle('drawer')}
        />
        <footer
          className="gs-panel gs-area-drawer gs-ws-pane"
          aria-label="Console"
          data-collapsed={prefs.drawer.collapsed}
        >
          <PanelHead
            title="Console"
            id="drawer"
            collapsed={prefs.drawer.collapsed}
            onToggle={p.onToggle}
            side="bottom"
          />
          <div className="gs-ws-panebody" hidden={prefs.drawer.collapsed}>
            {p.drawer}
          </div>
        </footer>
      </div>
      {p.statusbar}
    </div>
  );
}
