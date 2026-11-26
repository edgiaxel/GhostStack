/** Panel sizes are interface preferences: they live in localStorage and never touch project data. */
export type PanelId = 'navigator' | 'inspector' | 'drawer';
export interface PanelPref {
  size: number;
  collapsed: boolean;
}
export interface PanelLimits {
  min: number;
  max: number;
  initial: number;
}
export const PANEL_LIMITS: Record<PanelId, PanelLimits> = {
  navigator: { min: 160, max: 420, initial: 240 },
  inspector: { min: 240, max: 560, initial: 320 },
  drawer: { min: 120, max: 640, initial: 220 },
};
export const COLLAPSED_SIZE = 36;
export const storageKey = (id: PanelId): string => `gs.layout.${id}`;
export const clampPanel = (id: PanelId, size: number): number => {
  const { min, max, initial } = PANEL_LIMITS[id];
  if (!Number.isFinite(size)) return initial;
  return Math.round(Math.min(max, Math.max(min, size)));
};
export const defaultPref = (id: PanelId): PanelPref => ({
  size: PANEL_LIMITS[id].initial,
  collapsed: false,
});
/** Parses a stored value. Anything unreadable falls back to the default. The result is always inside the limits. */
export function parsePref(id: PanelId, raw: string | null): PanelPref {
  if (!raw) return defaultPref(id);
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v !== 'object' || v === null) return defaultPref(id);
    const o = v as Record<string, unknown>;
    return {
      size: typeof o['size'] === 'number' ? clampPanel(id, o['size']) : PANEL_LIMITS[id].initial,
      collapsed: o['collapsed'] === true,
    };
  } catch {
    return defaultPref(id);
  }
}
const storage = (): Storage | undefined => {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
};
export const loadPref = (id: PanelId): PanelPref => parsePref(id, storage()?.getItem(storageKey(id)) ?? null);
export function savePref(id: PanelId, pref: PanelPref): void {
  try {
    storage()?.setItem(
      storageKey(id),
      JSON.stringify({ size: clampPanel(id, pref.size), collapsed: pref.collapsed }),
    );
  } catch {
    // A full or blocked store only loses the preference.
  }
}
export function resetPrefs(): void {
  for (const id of Object.keys(PANEL_LIMITS) as PanelId[]) {
    try {
      storage()?.removeItem(storageKey(id));
    } catch {
      // Nothing to reset.
    }
  }
}
