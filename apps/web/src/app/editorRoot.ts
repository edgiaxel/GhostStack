import type { CSSProperties } from 'react';
import type { PreferencesStore } from '../preferences/preferences';

export interface EditorRootAttributes {
  style: CSSProperties;
  'data-gs-theme': string;
  'data-gs-navigator': 'visible' | 'hidden';
  'data-gs-toolbox': 'visible' | 'hidden';
  'data-gs-inspector': 'visible' | 'hidden';
}

const shown = (visible: boolean) => (visible ? 'visible' : 'hidden');

// Reads preferences synchronously so the first render already carries them.
export function editorRootAttributes(preferences: PreferencesStore): EditorRootAttributes {
  const sizes = preferences.get('panelSizes');
  const visibility = preferences.get('panelVisibility');
  return {
    style: {
      '--gs-nav-width': `${sizes.navigator}px`,
      '--gs-inspector-width': `${sizes.inspector}px`,
    } as CSSProperties,
    'data-gs-theme': preferences.get('theme'),
    'data-gs-navigator': shown(visibility.navigator),
    'data-gs-toolbox': shown(visibility.toolbox),
    'data-gs-inspector': shown(visibility.inspector),
  };
}
