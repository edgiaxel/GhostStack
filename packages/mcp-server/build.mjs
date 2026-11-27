// Bundles the stdio entry into dist/cli.mjs. Workspace packages are inlined; ws and the MCP SDK stay
// external and load from node_modules. Run: node packages/mcp-server/build.mjs
import { build } from 'vite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(fileURLToPath(import.meta.url));
await build({
  root,
  configFile: false,
  logLevel: 'warn',
  build: {
    ssr: resolve(root, 'src/cli.ts'),
    outDir: resolve(root, 'dist'),
    emptyOutDir: true,
    target: 'node20',
    minify: false,
    rollupOptions: { output: { format: 'es', entryFileNames: 'cli.mjs' } },
  },
  ssr: { noExternal: [/^@ghoststack\//] },
});
