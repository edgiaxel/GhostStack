import { useCallback, useState } from 'react';
import { PANEL_LIMITS, clampPanel, defaultPref, loadPref, resetPrefs, savePref } from './layoutPrefs';
import type { PanelId, PanelPref } from './layoutPrefs';

export type PanelPrefs = Record<PanelId, PanelPref>;

const load = (): PanelPrefs => ({
  navigator: loadPref('navigator'),
  inspector: loadPref('inspector'),
  drawer: loadPref('drawer'),
});

/** Panel sizes and collapsed flags, kept in React state and mirrored to localStorage (`gs.layout.*`). */
export function usePanels(): {
  prefs: PanelPrefs;
  setSize: (id: PanelId, size: number) => void;
  toggle: (id: PanelId) => void;
  reset: () => void;
} {
  const [prefs, setPrefs] = useState<PanelPrefs>(load);
  const update = useCallback((id: PanelId, change: (p: PanelPref) => PanelPref) => {
    setPrefs((all) => {
      const next = change(all[id]);
      savePref(id, next);
      return { ...all, [id]: next };
    });
  }, []);
  return {
    prefs,
    setSize: useCallback(
      (id, size) => update(id, (p) => ({ ...p, size: clampPanel(id, size), collapsed: false })),
      [update],
    ),
    toggle: useCallback((id) => update(id, (p) => ({ ...p, collapsed: !p.collapsed })), [update]),
    reset: useCallback(() => {
      resetPrefs();
      setPrefs({
        navigator: defaultPref('navigator'),
        inspector: defaultPref('inspector'),
        drawer: defaultPref('drawer'),
      });
    }, []),
  };
}

export { PANEL_LIMITS };
