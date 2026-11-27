import { afterEach, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { err, ok } from '@ghoststack/shared-contracts';
import type { GhostError, Result } from '@ghoststack/shared-contracts';
import type { Bridge } from './hub';
import { BRIDGE_METHODS } from './protocol';
import type { BridgeMethod } from './protocol';
import { CHECKPOINT_LIMIT, MAX_TOOL_OUTPUT_CHARS, createMcpServer, createRateLimiter } from './tools';
interface Call {
  method: BridgeMethod;
  params: unknown;
}
/** Bridge double: records what the tools ask of the tab and answers from `reply`. */
function recordingBridge(
  reply: (method: BridgeMethod, params: unknown) => Result<unknown, GhostError> = () => ok({}),
  paired = true,
): Bridge & { calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    isPaired: () => paired,
    request: (method, params) => {
      calls.push({ method, params });
      return Promise.resolve(reply(method, params));
    },
  };
}
const open: { close(): Promise<void> }[] = [];
async function connect(bridge: Bridge, nowMs?: () => number): Promise<Client> {
  const server = createMcpServer(nowMs ? { bridge, nowMs } : { bridge });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '0.0.0' });
  await Promise.all([server.connect(a), client.connect(b)]);
  open.push(client, server);
  return client;
}
afterEach(async () => {
  while (open.length) await open.pop()?.close();
});
const text = (r: unknown): string =>
  ((r as { content: { text: string }[] }).content[0] as { text: string }).text;
const body = (r: unknown): Record<string, unknown> => JSON.parse(text(r)) as Record<string, unknown>;
const isError = (r: unknown): boolean => (r as { isError?: boolean }).isError === true;
const minimalPlan = {
  schemaVersion: 1,
  summary: 'Add a Result card',
  affectedCardIds: ['result'],
  steps: [
    {
      id: 's1',
      rationale: 'The quiz needs a result card.',
      command: { type: 'ADD_CARD', cardId: 'result', title: 'Result' },
    },
  ],
};
describe('tool list', () => {
  it('exposes exactly the six documented tools and no write tool for Stacks', async () => {
    const client = await connect(recordingBridge());
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(
      [
        'create_checkpoint',
        'get_card_details',
        'get_stack_summary',
        'list_registered_actions',
        'propose_stack_patch',
        'validate_project',
      ].sort(),
    );
    for (const t of tools.filter(
      (x) => x.name.startsWith('get_') || x.name.startsWith('list_') || x.name === 'validate_project',
    )) {
      expect(t.annotations?.readOnlyHint).toBe(true);
    }
    expect(tools.find((t) => t.name === 'propose_stack_patch')?.annotations?.destructiveHint).toBe(false);
  });
});
describe('read tools', () => {
  it('get_stack_summary returns what the tab answers', async () => {
    const bridge = recordingBridge(() => ok({ title: 'Quiz', cards: [] }));
    const client = await connect(bridge);
    const r = await client.callTool({ name: 'get_stack_summary', arguments: {} });
    expect(isError(r)).toBe(false);
    expect(body(r)).toEqual({ title: 'Quiz', cards: [] });
    expect(bridge.calls).toEqual([{ method: 'stack.summary', params: {} }]);
  });
  it('get_card_details forwards only the card id and rejects a missing one', async () => {
    const bridge = recordingBridge(() => ok({ card: { cardId: 'c1' } }));
    const client = await connect(bridge);
    await client.callTool({ name: 'get_card_details', arguments: { cardId: 'c1' } });
    expect(bridge.calls).toEqual([{ method: 'card.details', params: { cardId: 'c1' } }]);
    const bad = await client.callTool({ name: 'get_card_details', arguments: {} });
    expect(isError(bad)).toBe(true);
    expect(bridge.calls).toHaveLength(1);
  });
  it('list_registered_actions needs no tab', async () => {
    const bridge = recordingBridge(undefined, false);
    const client = await connect(bridge);
    const r = await client.callTool({ name: 'list_registered_actions', arguments: {} });
    const b = body(r) as {
      actions: { type: string }[];
      allowedCommandTypes: string[];
      limits: { maxSteps: number };
    };
    expect(b.actions.length).toBeGreaterThan(3);
    expect(b.allowedCommandTypes).toContain('ADD_CARD');
    expect(b.allowedCommandTypes).not.toContain('REGISTER_ASSET');
    expect(b.limits.maxSteps).toBe(50);
    expect(bridge.calls).toHaveLength(0);
  });
  it('validate_project asks the tab', async () => {
    const bridge = recordingBridge(() => ok({ valid: true }));
    const client = await connect(bridge);
    expect(body(await client.callTool({ name: 'validate_project', arguments: {} }))).toEqual({ valid: true });
  });
  it('returns a normalized error when no tab is paired', async () => {
    const bridge = recordingBridge(
      () => err({ code: 'MCP_CONNECTION_FAILED', message: 'No editor tab is paired.' }),
      false,
    );
    const client = await connect(bridge);
    const r = await client.callTool({ name: 'get_stack_summary', arguments: {} });
    expect(isError(r)).toBe(true);
    expect(body(r)).toEqual({
      error: { code: 'MCP_CONNECTION_FAILED', message: 'No editor tab is paired.' },
    });
  });
  it('refuses an answer above the output cap instead of cutting it', async () => {
    const huge = 'x'.repeat(MAX_TOOL_OUTPUT_CHARS + 1);
    const client = await connect(recordingBridge(() => ok({ huge })));
    const r = await client.callTool({ name: 'get_stack_summary', arguments: {} });
    expect(isError(r)).toBe(true);
    expect(text(r).length).toBeLessThan(500);
  });
});
describe('propose_stack_patch', () => {
  it('sends a valid plan to the tab and says it is pending approval', async () => {
    const bridge = recordingBridge(() => ok({ proposalId: 'p1', stepCount: 1, waitingForApproval: 1 }));
    const client = await connect(bridge);
    const r = await client.callTool({ name: 'propose_stack_patch', arguments: { plan: minimalPlan } });
    expect(isError(r)).toBe(false);
    const b = body(r);
    expect(b['status']).toBe('pending_user_approval');
    expect(String(b['message'])).toMatch(/pending user approval/);
    expect(String(b['message'])).toMatch(/Nothing in the Stack has been changed/);
    expect(b['proposalId']).toBe('p1');
    expect(bridge.calls.map((c) => c.method)).toEqual(['proposal.submit']);
  });
  it('refuses an invalid plan with INVALID_AI_PLAN and never contacts the tab', async () => {
    const bridge = recordingBridge();
    const client = await connect(bridge);
    for (const plan of [
      {},
      { ...minimalPlan, steps: [] },
      { ...minimalPlan, steps: [{ ...minimalPlan.steps[0], command: { type: 'REGISTER_ASSET' } }] },
      { ...minimalPlan, extra: 'x' },
    ]) {
      const r = await client.callTool({ name: 'propose_stack_patch', arguments: { plan } });
      expect(isError(r)).toBe(true);
      expect(['INVALID_AI_PLAN', 'INVALID_PATCH_COMMAND']).toContain((body(r)['error'] as GhostError).code);
    }
    expect(bridge.calls).toHaveLength(0);
  });
  it('refuses a plan above the byte limit', async () => {
    const bridge = recordingBridge();
    const client = await connect(bridge);
    const plan = {
      ...minimalPlan,
      steps: [{ ...minimalPlan.steps[0], rationale: 'x'.repeat(400) }],
      summary: 's'.repeat(300),
    };
    const big = {
      ...plan,
      affectedCardIds: Array.from({ length: 50 }, (_, i) => `c${i}`.padEnd(128, 'x')),
      providerMeta: { providerId: 'p'.repeat(64) },
    };
    const many = {
      ...big,
      steps: Array.from({ length: 50 }, (_, i) => ({
        ...plan.steps[0],
        id: `s${i}`,
        command: { type: 'ADD_CARD', cardId: `n${i}`, title: 't'.repeat(2000) },
      })),
    };
    const r = await client.callTool({ name: 'propose_stack_patch', arguments: { plan: many } });
    expect(isError(r)).toBe(true);
    expect(bridge.calls).toHaveLength(0);
  });
  it('relays the tab refusal when the plan does not fit the Stack', async () => {
    const client = await connect(
      recordingBridge(() =>
        err({
          code: 'INVALID_PATCH_COMMAND',
          message: 'The plan does not apply to the current Stack (step s1): no such card',
        }),
      ),
    );
    const r = await client.callTool({ name: 'propose_stack_patch', arguments: { plan: minimalPlan } });
    expect(isError(r)).toBe(true);
    expect(JSON.stringify(body(r))).not.toMatch(/pending/);
  });
});
describe('create_checkpoint', () => {
  it('forwards a label and is rate limited', async () => {
    let now = 1_000;
    const bridge = recordingBridge(() => ok({ checkpointId: 'k' }));
    const client = await connect(bridge, () => now);
    for (let i = 0; i < CHECKPOINT_LIMIT.max; i++) {
      const r = await client.callTool({ name: 'create_checkpoint', arguments: { label: `cp ${i}` } });
      expect(isError(r)).toBe(false);
    }
    const blocked = await client.callTool({ name: 'create_checkpoint', arguments: { label: 'one more' } });
    expect(isError(blocked)).toBe(true);
    expect((body(blocked)['error'] as GhostError).code).toBe('CHECKPOINT_FAILED');
    expect(bridge.calls).toHaveLength(CHECKPOINT_LIMIT.max);
    now += CHECKPOINT_LIMIT.windowMs;
    expect(isError(await client.callTool({ name: 'create_checkpoint', arguments: { label: 'later' } }))).toBe(
      false,
    );
  });
  it('rejects an empty or long label', async () => {
    const bridge = recordingBridge();
    const client = await connect(bridge);
    expect(isError(await client.callTool({ name: 'create_checkpoint', arguments: { label: '  ' } }))).toBe(
      true,
    );
    expect(
      isError(await client.callTool({ name: 'create_checkpoint', arguments: { label: 'x'.repeat(81) } })),
    ).toBe(true);
    expect(bridge.calls).toHaveLength(0);
  });
});
describe('rate limiter', () => {
  it('slides the window', () => {
    let now = 0;
    const l = createRateLimiter(2, 100, () => now);
    expect(l.take()).toBe(0);
    now = 10;
    expect(l.take()).toBe(0);
    now = 20;
    expect(l.take()).toBe(80);
    now = 100;
    expect(l.take()).toBe(0);
  });
});
describe('property: tools cannot reach anything but the allowlisted tab requests', () => {
  const toolCalls = fc.oneof(
    fc.constant({ name: 'get_stack_summary', arguments: {} }),
    fc.record({
      name: fc.constant('get_card_details'),
      arguments: fc.record({ cardId: fc.string({ minLength: 1, maxLength: 20 }) }),
    }),
    fc.constant({ name: 'list_registered_actions', arguments: {} }),
    fc.constant({ name: 'validate_project', arguments: {} }),
    fc.record({
      name: fc.constant('propose_stack_patch'),
      arguments: fc.record({
        plan: fc.oneof(fc.constant(minimalPlan), fc.anything() as fc.Arbitrary<unknown>),
      }),
    }),
    fc.record({
      name: fc.constant('create_checkpoint'),
      arguments: fc.record({ label: fc.string({ maxLength: 100 }) }),
    }),
    fc.record({
      name: fc.string({ maxLength: 12 }),
      arguments: fc.dictionary(fc.string({ maxLength: 6 }), fc.anything()),
    }),
  );
  it('only ever sends allowlisted methods, and proposals never claim a change', async () => {
    const bridge = recordingBridge();
    const client = await connect(bridge, () => 0);
    await fc.assert(
      fc.asyncProperty(fc.array(toolCalls, { maxLength: 8 }), async (calls) => {
        for (const c of calls) {
          const r = await client
            .callTool({ name: c.name, arguments: c.arguments as Record<string, unknown> })
            .catch(() => undefined);
          if (c.name === 'propose_stack_patch' && r && !isError(r)) {
            expect(text(r)).toMatch(/pending user approval/);
          }
        }
        for (const call of bridge.calls) expect(BRIDGE_METHODS).toContain(call.method);
      }),
      { numRuns: 40 },
    );
  });
});
