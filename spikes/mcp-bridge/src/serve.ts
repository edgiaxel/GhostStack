import { createBridgeCore } from './core';
import { createBridgeHttpServer } from './httpServer';
import { loadSeed, parseSeedArgs } from './seed';

const DEFAULT_PORT = 17878;

/**
 * Long-running loopback bridge. The token comes from GHOSTSTACK_BRIDGE_TOKEN and is never printed.
 * Generate one with: export GHOSTSTACK_BRIDGE_TOKEN=$(openssl rand -hex 32)
 */
async function main(): Promise<void> {
  const token = process.env['GHOSTSTACK_BRIDGE_TOKEN'] ?? '';
  const port = Number(process.env['GHOSTSTACK_BRIDGE_PORT'] ?? DEFAULT_PORT);
  const allowedOrigins = (process.env['GHOSTSTACK_ALLOWED_ORIGINS'] ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin !== '');
  const core = createBridgeCore();
  const seed = await loadSeed(parseSeedArgs(process.argv.slice(2)));
  if (seed !== undefined) core.publishProject(seed);
  const running = await createBridgeHttpServer({ core, token, port, allowedOrigins }).start();
  process.stderr.write(`ghoststack-bridge listening on ${running.url} (loopback only)\n`);
  const stop = () => void running.close().then(() => process.exit(0));
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((error: unknown) => {
  process.stderr.write(`ghoststack-bridge: ${error instanceof Error ? error.message : 'failed'}\n`);
  process.exit(1);
});
