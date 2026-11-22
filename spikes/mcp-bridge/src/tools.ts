import { aiPlanJsonSchema } from '@ghoststack/ai-core';
import type { AIIssue } from '@ghoststack/ai-core';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { BridgeCore } from './core';

export const TOOL_NAMES = [
  'get_stack_summary',
  'get_card_details',
  'list_registered_actions',
  'propose_stack_patch',
  'validate_project',
  'create_checkpoint',
] as const;

const PATCH_COMMANDS = [
  'ADD_CARD',
  'DELETE_CARD',
  'ADD_ELEMENT',
  'UPDATE_ELEMENT',
  'DELETE_ELEMENT',
  'UPDATE_BEHAVIOR',
  'UPDATE_STATE_SCHEMA',
] as const;

const asText = (value: unknown): CallToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
});

const failure = (issues: readonly AIIssue[]): CallToolResult => ({
  isError: true,
  content: [
    {
      type: 'text',
      text: JSON.stringify(
        { issues: issues.map(({ code, message, path }) => ({ code, message, path })) },
        null,
        2,
      ),
    },
  ],
});

/**
 * Builds one MCP server for one connection. `source` labels proposals so the creator can see which
 * client sent them. No tool here can change the editor's project: proposals only enter a queue.
 */
export function createBridgeMcpServer(core: BridgeCore, source: string): McpServer {
  const server = new McpServer({ name: 'ghoststack-bridge', version: '0.0.0' });

  server.registerTool(
    'get_stack_summary',
    {
      title: 'Get stack summary',
      description:
        'Read-only. Title, card list in order, element counts, state keys and asset count of the active project.',
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    () => {
      const read = core.readProject();
      if (!read.ok) return failure([read.error]);
      const { stack } = read.value.bundle;
      return asText({
        revision: read.value.revision,
        stackId: stack.stackId,
        title: stack.title,
        updatedAt: stack.updatedAt,
        entryCardId: stack.entryCardId,
        cards: stack.cardOrder.map((cardId) => ({
          cardId,
          title: stack.cards[cardId]?.title ?? '',
          elementCount: stack.cards[cardId]?.elements.length ?? 0,
        })),
        stateKeys: Object.keys(stack.stateSchema).sort(),
        assetCount: Object.keys(stack.assetRegistry).length,
      });
    },
  );

  server.registerTool(
    'get_card_details',
    {
      title: 'Get card details',
      description:
        'Read-only. Elements, layout and properties of one card. Asset bytes are never returned.',
      inputSchema: { cardId: z.string().min(1).max(100) },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ({ cardId }) => {
      const read = core.readProject();
      if (!read.ok) return failure([read.error]);
      const { stack } = read.value.bundle;
      if (!Object.hasOwn(stack.cards, cardId)) {
        return failure([
          {
            code: 'INVALID_PATCH_COMMAND',
            message: 'No card with this identifier.',
            path: ['cardId'],
          },
        ]);
      }
      const card = stack.cards[cardId];
      return asText({ revision: read.value.revision, card });
    },
  );

  server.registerTool(
    'list_registered_actions',
    {
      title: 'List registered actions',
      description:
        'Read-only. The patch commands a proposal may use, and the JSON Schema a plan must satisfy. ' +
        'Runtime behavior actions do not exist yet, so that list is empty.',
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    () =>
      asText({
        patchCommands: PATCH_COMMANDS,
        unsupportedPatchCommands: ['UPDATE_BEHAVIOR'],
        runtimeActions: [],
        note: 'The behavior runtime arrives in M3, so there are no runtime actions to register yet.',
        planSchema: aiPlanJsonSchema(),
      }),
  );

  server.registerTool(
    'propose_stack_patch',
    {
      title: 'Propose a stack patch',
      description:
        'Submits a plan for the creator to review. It does NOT change the project: the plan is checked ' +
        'against a copy, then waits in an approval queue. Get the plan schema from list_registered_actions.',
      inputSchema: { plan: z.unknown().describe('An AIPlan object (planVersion 1).') },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    ({ plan }) => {
      const submitted = core.submitProposal(plan, source);
      if (!submitted.ok) return failure(submitted.error.issues);
      const { proposalId, status, review } = submitted.value;
      return asText({
        proposalId,
        status,
        review,
        message: 'Queued for the creator. The project has not been changed.',
      });
    },
  );

  server.registerTool(
    'validate_project',
    {
      title: 'Validate project',
      description:
        'Read-only. Validates the active project and lists problems by code and location.',
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    () => {
      const result = core.validateSnapshot();
      return result.ok ? asText(result.value) : failure([result.error]);
    },
  );

  server.registerTool(
    'create_checkpoint',
    {
      title: 'Create checkpoint',
      description:
        'Saves a named copy of the active project as a recovery point. It does not change the project. ' +
        'The copy is held by the bridge in memory (durable: false).',
      inputSchema: { label: z.string().trim().min(1).max(100) },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    ({ label }) => {
      const made = core.createCheckpoint(label);
      return made.ok ? asText({ ...made.value, durable: false }) : failure([made.error]);
    },
  );

  return server;
}
