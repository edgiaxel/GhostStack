import { defaultClock, generateId } from '@ghoststack/domain';
import { createIndexedDbStorage } from '@ghoststack/storage/indexeddb';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import './themes/spectral-workstation.css';
import { startApp } from './app/startApp';
import { registerServiceWorkerAfterLoad } from './pwa/registerServiceWorker';
import { createPreferencesStore, safeLocalStorage } from './preferences/preferences';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('Missing #root element in index.html.');
}

startApp(container, {
  // Preferences are read here, before the first render.
  preferences: createPreferencesStore(safeLocalStorage()),
  // The database opens lazily on the first storage call.
  storage: createIndexedDbStorage(),
  clock: defaultClock,
  newId: generateId,
});

registerServiceWorkerAfterLoad();
