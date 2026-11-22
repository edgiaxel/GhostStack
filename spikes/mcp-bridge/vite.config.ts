import { defineConfig } from 'vite';

// Bundles the two entry points into dist/ so they can be started with plain `node`.
// Workspace packages are TypeScript source, so they are bundled; node_modules packages stay external.
export default defineConfig({
  ssr: { noExternal: [/^@ghoststack\//] },
  build: {
    ssr: true,
    outDir: 'dist',
    emptyOutDir: true,
    target: 'node24',
    rollupOptions: {
      input: {
        stdio: 'src/stdio.ts',
        serve: 'src/serve.ts',
        'agent-demo': 'src/agent-demo.ts',
      },
      output: { entryFileNames: '[name].js' },
    },
  },
});
