import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

declare const process: { env: Record<string, string | undefined> };
/** Worktrees run on their own port (GS_PORT) so parallel dev servers and e2e runs do not collide. */
const port = Number(process.env['GS_PORT'] ?? 5173);

export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', port, strictPort: true },
});
