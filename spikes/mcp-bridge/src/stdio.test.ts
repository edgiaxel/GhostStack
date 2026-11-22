import { PassThrough } from 'node:stream';
import { buildFixtureBundle } from '@ghoststack/domain/testing';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { describe, expect, it } from 'vitest';
import { createBridgeCore } from './core';
import { TOOL_NAMES, createBridgeMcpServer } from './tools';

/** The stdio transport over in-process streams: the same framing the spawned process uses. */
describe('stdio transport', () => {
  it('answers initialize, tools/list and a tool call over newline-delimited JSON', async () => {
    const core = createBridgeCore();
    core.publishProject(buildFixtureBundle());
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const server = createBridgeMcpServer(core, 'stdio-client');
    await server.connect(new StdioServerTransport(stdin, stdout));

    interface Reply {
      result: {
        serverInfo?: { name: string };
        tools?: { name: string }[];
        content?: { text: string }[];
      };
    }
    const replies = new Map<number, Reply>();
    let buffer = '';
    stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      for (let at = buffer.indexOf('\n'); at >= 0; at = buffer.indexOf('\n')) {
        const line = buffer.slice(0, at);
        buffer = buffer.slice(at + 1);
        if (line.trim() !== '') {
          const message = JSON.parse(line) as Reply & { id?: number };
          if (message.id !== undefined) replies.set(message.id, message);
        }
      }
    });
    const waitFor = async (id: number): Promise<Reply> => {
      for (let i = 0; i < 100 && !replies.has(id); i += 1)
        await new Promise((r) => setTimeout(r, 10));
      const reply = replies.get(id);
      if (reply === undefined) throw new Error(`No reply for request ${id}.`);
      return reply;
    };
    const send = (message: unknown) => stdin.write(`${JSON.stringify(message)}\n`);

    send({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 't', version: '0' },
      },
    });
    expect((await waitFor(1)).result.serverInfo?.name).toBe('ghoststack-bridge');
    send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    const listed = ((await waitFor(2)).result.tools ?? []).map((t) => t.name).sort();
    expect(listed).toEqual([...TOOL_NAMES].sort());
    send({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'validate_project', arguments: {} },
    });
    const call = await waitFor(3);
    expect(JSON.parse(call.result.content?.[0]?.text ?? 'null')).toEqual({
      valid: true,
      errors: [],
    });

    await server.close();
  });
});
