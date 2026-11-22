import { buildFixtureBundle } from '@ghoststack/domain/testing';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it } from 'vitest';
import { createBridgeCore } from './core';
import { TOOL_NAMES, createBridgeMcpServer } from './tools';

async function connect(seed = true) {
  const core = createBridgeCore();
  const bundle = buildFixtureBundle();
  if (seed) core.publishProject(bundle);
  const server = createBridgeMcpServer(core, 'test-client');
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '0' });
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  return { client, core, bundle, close: () => client.close() };
}

/** The tools reply with one JSON text block. The caller names the shape it expects. */
function json<T>(result: unknown): T {
  const content = (result as { content?: { text?: string }[] }).content;
  const text = content?.[0]?.text;
  if (text === undefined) throw new Error('The tool result has no text content.');
  return JSON.parse(text) as T;
}

interface Summary {
  title: string;
  cards: unknown[];
  assetCount: number;
}
interface CardDetails {
  card: { cardId: string };
}
interface Listed {
  patchCommands: string[];
  unsupportedPatchCommands: string[];
  runtimeActions: unknown[];
  planSchema: { type: string };
}
interface Proposed {
  status: string;
  message: string;
}
interface Failure {
  issues: { code: string }[];
}
interface Checkpoint {
  label: string;
  durable: boolean;
  bundle?: unknown;
}

describe('tool discovery', () => {
  it('lists exactly the six P0 tools with the right safety hints', async () => {
    const { client, close } = await connect();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([...TOOL_NAMES].sort());
    const hint = (name: string) => tools.find((t) => t.name === name)?.annotations?.readOnlyHint;
    for (const name of [
      'get_stack_summary',
      'get_card_details',
      'list_registered_actions',
      'validate_project',
    ]) {
      expect(hint(name)).toBe(true);
    }
    expect(hint('propose_stack_patch')).toBe(false);
    expect(hint('create_checkpoint')).toBe(false);
    for (const tool of tools) expect(tool.annotations?.destructiveHint).not.toBe(true);
    await close();
  });
});

describe('read-only tools', () => {
  it('summarizes the stack', async () => {
    const { client, bundle, close } = await connect();
    const summary = json<Summary>(
      await client.callTool({ name: 'get_stack_summary', arguments: {} }),
    );
    expect(summary.title).toBe(bundle.stack.title);
    expect(summary.cards).toHaveLength(bundle.stack.cardOrder.length);
    expect(summary.assetCount).toBe(2);
    expect(JSON.stringify(summary)).not.toContain('checksum');
    await close();
  });

  it('returns card details and an error for an unknown card', async () => {
    const { client, bundle, close } = await connect();
    const cardId = bundle.stack.cardOrder[0] as string;
    const details = json<CardDetails>(
      await client.callTool({ name: 'get_card_details', arguments: { cardId } }),
    );
    expect(details.card.cardId).toBe(cardId);
    const missing = await client.callTool({
      name: 'get_card_details',
      arguments: { cardId: '__proto__' },
    });
    expect(missing.isError).toBe(true);
    await close();
  });

  it('lists patch commands and the plan schema, and says runtime actions do not exist yet', async () => {
    const { client, close } = await connect();
    const listed = json<Listed>(
      await client.callTool({ name: 'list_registered_actions', arguments: {} }),
    );
    expect(listed.patchCommands).toContain('ADD_ELEMENT');
    expect(listed.unsupportedPatchCommands).toEqual(['UPDATE_BEHAVIOR']);
    expect(listed.runtimeActions).toEqual([]);
    expect(listed.planSchema.type).toBe('object');
    expect(JSON.stringify(listed.planSchema)).not.toContain('propertyNames');
    await close();
  });

  it('validates the project', async () => {
    const { client, close } = await connect();
    const result = json<{ valid: boolean; errors: unknown[] }>(
      await client.callTool({ name: 'validate_project', arguments: {} }),
    );
    expect(result).toEqual({ valid: true, errors: [] });
    await close();
  });

  it('reports a clear error when no project was published', async () => {
    const { client, close } = await connect(false);
    for (const name of ['get_stack_summary', 'validate_project']) {
      const result = await client.callTool({ name, arguments: {} });
      expect(result.isError).toBe(true);
    }
    await close();
  });
});

describe('propose_stack_patch', () => {
  const plan = {
    planVersion: 1,
    planId: 'agent-plan',
    requestSummary: 'agent adds a card',
    commands: [{ command: 'ADD_CARD', title: 'From agent' }],
  };

  it('queues a proposal and leaves the project untouched', async () => {
    const { client, core, bundle, close } = await connect();
    const result = await client.callTool({ name: 'propose_stack_patch', arguments: { plan } });
    expect(result.isError).toBeFalsy();
    const body = json<Proposed>(result);
    expect(body.status).toBe('pending');
    expect(body.message).toContain('has not been changed');
    expect(core.listProposals('pending')[0]?.source).toBe('test-client');
    const read = core.readProject();
    expect(read.ok && read.value.bundle).toEqual(bundle);
    await close();
  });

  it('returns structured issues for an invalid plan and queues nothing', async () => {
    const { client, core, close } = await connect();
    const result = await client.callTool({
      name: 'propose_stack_patch',
      arguments: { plan: { planVersion: 1, commands: 'nope' } },
    });
    expect(result.isError).toBe(true);
    expect(json<Failure>(result).issues[0]?.code).toBe('INVALID_AI_PLAN');
    expect(core.listProposals()).toHaveLength(0);
    await close();
  });

  it('exposes no tool that approves or applies a proposal', async () => {
    const { client, close } = await connect();
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name.toLowerCase()).join(' ');
    for (const forbidden of ['approve', 'apply', 'execute', 'commit', 'delete', 'write']) {
      expect(names).not.toContain(forbidden);
    }
    const unknown = await client
      .callTool({ name: 'approve_proposal', arguments: {} })
      .catch((e: unknown) => e);
    expect(unknown instanceof Error || (unknown as { isError?: boolean }).isError === true).toBe(
      true,
    );
    await close();
  });
});

describe('create_checkpoint', () => {
  it('creates a non-durable copy and validates the label', async () => {
    const { client, core, bundle, close } = await connect();
    const made = json<Checkpoint>(
      await client.callTool({ name: 'create_checkpoint', arguments: { label: 'safe point' } }),
    );
    expect(made.label).toBe('safe point');
    expect(made.durable).toBe(false);
    expect(made.bundle).toBeUndefined();
    expect(core.listCheckpoints()).toHaveLength(1);
    const read = core.readProject();
    expect(read.ok && read.value.bundle).toEqual(bundle);
    const bad = await client.callTool({ name: 'create_checkpoint', arguments: { label: '   ' } });
    expect(bad.isError).toBe(true);
    await close();
  });
});
