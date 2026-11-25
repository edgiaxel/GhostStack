import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const here = (relative: string): string => fileURLToPath(new URL(relative, import.meta.url));

/** Builds the dependency-free player bundle that standalone exports ship. Run by `npm run build:player`. */
export default defineConfig({
  publicDir: false,
  build: {
    lib: {
      entry: here('./src/standalone.ts'),
      name: 'GhostStackPlayer',
      formats: ['iife'],
      fileName: () => 'player.standalone.js',
    },
    outDir: here('../../apps/web/public'),
    emptyOutDir: false,
    minify: true,
    target: 'es2020',
  },
});
