import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createBridgeCore } from './core';
import { loadSeed, parseSeedArgs, writeProposalsFile } from './seed';
import { createBridgeMcpServer } from './tools';

/**
 * stdio entry. stdout carries the protocol, so everything this process says goes to stderr.
 * A process the client spawns has its own memory, so it cannot see the browser's IndexedDB:
 * it serves whatever it was seeded with (--demo or --gsp <file>).
 */
async function main(): Promise<void> {
  const args = parseSeedArgs(process.argv.slice(2));
  const core = createBridgeCore({
    ...(args.proposalsOut === undefined
      ? {}
      : {
          onProposalQueued: (pending) => {
            void writeProposalsFile(args.proposalsOut as string, pending).catch(() => {
              process.stderr.write('ghoststack-bridge: could not write the proposals file\n');
            });
          },
        }),
  });
  const seed = await loadSeed(args);
  if (seed !== undefined) core.publishProject(seed);
  else process.stderr.write('ghoststack-bridge: no project seeded; use --demo or --gsp <file>\n');
  const server = createBridgeMcpServer(core, 'stdio-client');
  await server.connect(new StdioServerTransport());
  process.stderr.write('ghoststack-bridge: stdio server ready\n');
}

main().catch((error: unknown) => {
  process.stderr.write(`ghoststack-bridge: ${error instanceof Error ? error.message : 'failed'}\n`);
  process.exit(1);
});
