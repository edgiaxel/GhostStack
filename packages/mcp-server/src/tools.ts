import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getRegisteredActions, parsePlan } from '@ghoststack/ai-core';
import { AI_ALLOWED_COMMAND_TYPES, MAX_PLAN_BYTES, MAX_PLAN_STEPS } from '@ghoststack/shared-contracts';
import type { GhostError, Result } from '@ghoststack/shared-contracts';
import type { Bridge } from './hub';
import type { BridgeMethod } from './protocol';
/** Largest tool answer, in characters. Anything bigger is refused rather than cut mid-JSON. */
export const MAX_TOOL_OUTPUT_CHARS = 60_000;
export const CHECKPOINT_LIMIT = { max: 5, windowMs: 60_000 } as const;
export interface McpServerOptions {
  bridge: Bridge;
  version?: string;
  /** Injectable clock for the checkpoint rate limit. */
  nowMs?: () => number;
}
const PENDING_NOTICE =
  'Proposal received and pending user approval. Nothing in the Stack has been changed. The creator must review and approve it in GhostStack.';
interface ToolResult {
  [key: string]: unknown;
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}
function success(value: unknown): ToolResult {
  const text = JSON.stringify(value, null, 2);
  if (text.length > MAX_TOOL_OUTPUT_CHARS) {
    return failure({
      code: 'MCP_CONNECTION_FAILED',
      message: 'The answer is too large to return. Ask for one Card at a time with get_card_details.',
    });
  }
  return { content: [{ type: 'text', text }] };
}
function failure(error: GhostError): ToolResult {
  return { isError: true, content: [{ type: 'text', text: JSON.stringify({ error }, null, 2) }] };
}
const fromResult = (r: Result<unknown, GhostError>): ToolResult =>
  r.ok ? success(r.value) : failure(r.error);
/** Sliding-window limiter. `take` returns the wait in ms, or 0 when the call may go ahead. */
export function createRateLimiter(max: number, windowMs: number, nowMs: () => number): { take(): number } {
  const stamps: number[] = [];
  return {
    take() {
      const now = nowMs();
      while (stamps.length > 0 && now - (stamps[0] as number) >= windowMs) stamps.shift();
      if (stamps.length >= max) return windowMs - (now - (stamps[0] as number));
      stamps.push(now);
      return 0;
    },
  };
}
const CardId = z.string().min(1).max(128);
/**
 * The MCP surface. No tool holds a Stack and none changes one: reads ask the paired tab, a proposal
 * goes to the tab's approval queue, and a checkpoint is a named copy kept beside the project.
 */
export function createMcpServer(options: McpServerOptions): McpServer {
  const { bridge } = options;
  const nowMs = options.nowMs ?? Date.now;
  const checkpoints = createRateLimiter(CHECKPOINT_LIMIT.max, CHECKPOINT_LIMIT.windowMs, nowMs);
  const server = new McpServer({ name: 'ghoststack', version: options.version ?? '0.0.0' });
  const ask = async (method: BridgeMethod, params: unknown): Promise<ToolResult> =>
    fromResult(await bridge.request(method, params));
  server.registerTool(
    'get_stack_summary',
    {
      title: 'Get Stack summary',
      description:
        'Read-only. Title, Card list (id, title, element count, which Cards it links to), state variables and viewport of the Stack open in the paired editor tab.',
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    () => ask('stack.summary', {}),
  );
  server.registerTool(
    'get_card_details',
    {
      title: 'Get Card details',
      description:
        'Read-only. Every element and behavior of one Card in the open Stack. Use a Card id from get_stack_summary.',
      inputSchema: { cardId: CardId },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ({ cardId }) => ask('card.details', { cardId }),
  );
  server.registerTool(
    'list_registered_actions',
    {
      title: 'List registered actions',
      description:
        'Read-only. The behavior actions a plan may use, the command types a plan may contain and the plan limits. Needs no paired tab.',
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    () =>
      success({
        actions: getRegisteredActions(),
        allowedCommandTypes: [...AI_ALLOWED_COMMAND_TYPES],
        limits: { maxSteps: MAX_PLAN_STEPS, maxPlanBytes: MAX_PLAN_BYTES },
      }),
  );
  server.registerTool(
    'validate_project',
    {
      title: 'Validate project',
      description:
        'Read-only. Runs the project validator on the Stack open in the paired tab and reports the first problem.',
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    () => ask('project.validate', {}),
  );
  server.registerTool(
    'propose_stack_patch',
    {
      title: 'Propose a Stack change',
      description: [
        'Gated. Submits a plan for the creator to review. It never changes the Stack: the plan waits in the approval queue until the creator approves it.',
        `Plan: { schemaVersion: 1, summary, affectedCardIds, steps: [{ id, rationale, command: { type, ... }, dependsOn? }] }, at most ${MAX_PLAN_STEPS} steps and ${MAX_PLAN_BYTES} bytes.`,
        `Command types: ${AI_ALLOWED_COMMAND_TYPES.join(', ')}.`,
        'Call get_stack_summary and list_registered_actions first. A plan that does not apply to the current Stack is refused with the reason.',
      ].join(' '),
      inputSchema: { plan: z.record(z.string(), z.unknown()) },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ plan }) => {
      const parsed = parsePlan(plan);
      if (!parsed.ok) return failure(parsed.error);
      const r = await bridge.request('proposal.submit', { plan: parsed.value });
      if (!r.ok) return failure(r.error);
      const value = r.value as Record<string, unknown> | null;
      return success({ status: 'pending_user_approval', message: PENDING_NOTICE, ...(value ?? {}) });
    },
  );
  server.registerTool(
    'create_checkpoint',
    {
      title: 'Create a checkpoint',
      description: `Safe write. Saves a named copy of the open Stack so the creator can restore it. The Stack itself is not changed. At most ${CHECKPOINT_LIMIT.max} per minute.`,
      inputSchema: { label: z.string().trim().min(1).max(80) },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ label }) => {
      if (!bridge.isPaired()) return fromResult(await bridge.request('checkpoint.create', { label }));
      const wait = checkpoints.take();
      if (wait > 0) {
        return failure({
          code: 'CHECKPOINT_FAILED',
          message: `Too many checkpoints. Try again in ${Math.ceil(wait / 1000)} seconds.`,
        });
      }
      return ask('checkpoint.create', { label });
    },
  );
  return server;
}
