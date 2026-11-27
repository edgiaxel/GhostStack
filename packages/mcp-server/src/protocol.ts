import { z } from 'zod';
import { ERROR_CODES } from '@ghoststack/shared-contracts';
/**
 * Wire protocol between the MCP server process and the one paired editor tab (WebSocket, JSON text
 * frames). The browser side keeps a small copy of these shapes in
 * `apps/web/src/features/ai/bridge/protocol.ts`; keep both in step.
 * Pure: no Node imports, safe to import from tests on either side.
 */
export const BRIDGE_PROTOCOL_VERSION = 1 as const;
/** Largest frame either side accepts. A plan is at most 64 kB, so 256 kB leaves room for envelopes. */
export const MAX_FRAME_BYTES = 256 * 1024;
/** Before the token check passes only a tiny hello frame is accepted. */
export const MAX_HELLO_BYTES = 1024;
/** Requests the server may send to the tab. This is the whole allowlist. */
export const BRIDGE_METHODS = [
  'stack.summary',
  'card.details',
  'project.validate',
  'proposal.submit',
  'checkpoint.create',
] as const;
export type BridgeMethod = (typeof BRIDGE_METHODS)[number];
export const PAIRING_PREFIX = 'gs-mcp';
/** `gs-mcp:<port>:<token>`. The token is base64url. */
export function formatPairingCode(port: number, token: string): string {
  return `${PAIRING_PREFIX}:${port}:${token}`;
}
export function parsePairingCode(text: string): { port: number; token: string } | undefined {
  const m = /^gs-mcp:(\d{4,5}):([A-Za-z0-9_-]{22,128})$/.exec(text.trim());
  if (!m) return undefined;
  const port = Number(m[1]);
  if (port < 1024 || port > 65535) return undefined;
  return { port, token: m[2] as string };
}
const WireError = z.strictObject({
  code: z.enum(ERROR_CODES),
  message: z.string().max(2000),
});
/** Tab to server. */
export const ClientFrameSchema = z.union([
  z.strictObject({
    t: z.literal('hello'),
    token: z.string().min(1).max(256),
    protocol: z.literal(BRIDGE_PROTOCOL_VERSION),
  }),
  z.strictObject({
    t: z.literal('res'),
    id: z.number().int().nonnegative(),
    ok: z.literal(true),
    result: z.unknown(),
  }),
  z.strictObject({
    t: z.literal('res'),
    id: z.number().int().nonnegative(),
    ok: z.literal(false),
    error: WireError,
  }),
]);
export type ClientFrame = z.infer<typeof ClientFrameSchema>;
/** Server to tab. */
export type ServerFrame =
  | { t: 'welcome'; protocol: typeof BRIDGE_PROTOCOL_VERSION }
  | { t: 'req'; id: number; method: BridgeMethod; params: unknown }
  | { t: 'bye'; reason: string };
/** Close codes. 4xxx are private-use. */
export const CLOSE = {
  unauthorized: 4401,
  forbidden: 4403,
  busy: 4409,
  badFrame: 4400,
} as const;
