import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createBridgeHub } from './hub';
import { createMcpServer } from './tools';
/**
 * `node dist/cli.mjs [--allow-origin <origin>]...` launched by the agent. stdout carries the MCP
 * protocol only; everything meant for a person goes to stderr. Extra origins can also come from
 * `GS_MCP_ALLOWED_ORIGINS` (comma separated).
 */
function readOrigins(argv: readonly string[], env: Record<string, string | undefined>): string[] {
  const origins = (env['GS_MCP_ALLOWED_ORIGINS'] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--allow-origin' && argv[i + 1]) origins.push(String(argv[++i]));
  }
  return origins;
}
async function main(): Promise<void> {
  const hub = await createBridgeHub({ allowedOrigins: readOrigins(process.argv.slice(2), process.env) });
  const server = createMcpServer({ bridge: hub });
  hub.onPairingChange((paired) => {
    process.stderr.write(`GhostStack bridge: editor tab ${paired ? 'paired' : 'disconnected'}\n`);
  });
  process.stderr.write(
    [
      `GhostStack MCP bridge listening on ${hub.host}:${hub.port} (loopback only).`,
      `Pairing code: ${hub.pairingCode}`,
      'Enter the pairing code in GhostStack, AI assistant, Connect an agent. The code is valid until this process exits.',
      '',
    ].join('\n'),
  );
  const stop = (): void => {
    void hub.close().finally(() => process.exit(0));
  };
  process.stdin.on('end', stop);
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  await server.connect(new StdioServerTransport());
}
main().catch((e: unknown) => {
  process.stderr.write(
    `GhostStack MCP server failed to start: ${e instanceof Error ? e.message : 'unknown error'}\n`,
  );
  process.exit(1);
});
