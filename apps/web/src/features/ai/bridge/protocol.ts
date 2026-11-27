/**
 * Browser side of the MCP bridge wire protocol. The server side lives in
 * `packages/mcp-server/src/protocol.ts` (Node only, so the web bundle cannot import it). Keep both
 * in step: `bridge.integration.test.ts` runs the real server against this client.
 */
export const BRIDGE_PROTOCOL_VERSION = 1 as const;
export const MAX_FRAME_BYTES = 256 * 1024;
export const BRIDGE_METHODS = [
  'stack.summary',
  'card.details',
  'project.validate',
  'proposal.submit',
  'checkpoint.create',
] as const;
export type BridgeMethod = (typeof BRIDGE_METHODS)[number];
export const isBridgeMethod = (m: unknown): m is BridgeMethod =>
  typeof m === 'string' && (BRIDGE_METHODS as readonly string[]).includes(m);
export function parsePairingCode(text: string): { port: number; token: string } | undefined {
  const m = /^gs-mcp:(\d{4,5}):([A-Za-z0-9_-]{22,128})$/.exec(text.trim());
  if (!m) return undefined;
  const port = Number(m[1]);
  if (port < 1024 || port > 65535) return undefined;
  return { port, token: m[2] as string };
}
export const CLOSE_CODES = { unauthorized: 4401, forbidden: 4403, busy: 4409, badFrame: 4400 } as const;
