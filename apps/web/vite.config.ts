import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { precacheServiceWorker } from './pwa/precacheServiceWorkerPlugin.ts';

// Same timeout as the node projects in the root vitest.config.ts.
const testTimeout = 30_000;

export default defineConfig({
  plugins: [react(), precacheServiceWorker()],
  test: {
    name: 'web',
    environment: 'jsdom',
    testTimeout,
    // Vitest replaces CSS with an empty string unless listed; tests read the source via ?raw.
    css: { include: [/(themes|library|workspace)\/.*\.css/] },
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'pwa/**/*.test.ts'],
  },
});
