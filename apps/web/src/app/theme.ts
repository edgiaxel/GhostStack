export const THEMES = ['spectral', 'paper', 'midnight'] as const;
export type ThemeId = (typeof THEMES)[number];
const KEY = 'gs.theme';

export function loadTheme(): ThemeId {
  const v = localStorage.getItem(KEY);
  return THEMES.find((t) => t === v) ?? 'spectral';
}

export function applyTheme(theme: ThemeId): void {
  document.documentElement.dataset['theme'] = theme;
  localStorage.setItem(KEY, theme);
}
