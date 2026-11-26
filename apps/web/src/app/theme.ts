export const THEMES = ['spectral', 'paper', 'midnight'] as const;
export type ThemeId = (typeof THEMES)[number];
/** Accent presets. `default` (no attribute) keeps the accent of the active theme. */
export const ACCENTS = ['violet', 'ember', 'azure', 'jade', 'rose'] as const;
export type AccentId = (typeof ACCENTS)[number] | 'default';
const KEY = 'gs.theme';
const ACCENT_KEY = 'gs.accent';
export function loadTheme(): ThemeId {
  const v = localStorage.getItem(KEY);
  return THEMES.find((t) => t === v) ?? 'spectral';
}
export function applyTheme(theme: ThemeId): void {
  document.documentElement.dataset['theme'] = theme;
  localStorage.setItem(KEY, theme);
}
export function loadAccent(): AccentId {
  const v = localStorage.getItem(ACCENT_KEY);
  return ACCENTS.find((a) => a === v) ?? 'default';
}
/** Interface preference only. Sets `data-accent` on `<html>` and stores it under `gs.accent`. */
export function applyAccent(accent: AccentId): void {
  if (accent === 'default') delete document.documentElement.dataset['accent'];
  else document.documentElement.dataset['accent'] = accent;
  localStorage.setItem(ACCENT_KEY, accent);
}
