import { defineConfig } from 'vite';

// A fixed origin so the bridge can allow-list exactly this page (T-030).
export const PROBE_ORIGIN = 'http://127.0.0.1:5199';

export default defineConfig({
  server: { host: '127.0.0.1', port: 5199, strictPort: true },
});
