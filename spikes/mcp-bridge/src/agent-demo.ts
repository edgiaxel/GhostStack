import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

/**
 * Stands in for an MCP agent: connects with the agent token, reads the project, proposes a patch.
 * Usage: node dist/agent-demo.js summary | propose "<card title>"
 * The token comes from GHOSTSTACK_BRIDGE_TOKEN and is never printed.
 */
async function main(): Promise<void> {
  const token = process.env['GHOSTSTACK_BRIDGE_TOKEN'] ?? '';
  const url = process.env['GHOSTSTACK_BRIDGE_URL'] ?? 'http://127.0.0.1:17878/mcp';
  const [mode = 'summary', title = 'Agent card'] = process.argv.slice(2);
  const client = new Client({ name: 'agent-demo', version: '0' });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(url), {
      requestInit: { headers: { authorization: `Bearer ${token}` } },
    }),
  );
  const tools = (await client.listTools()).tools.map((tool) => tool.name);
  process.stdout.write(`tools: ${tools.join(', ')}\n`);

  const text = (result: unknown): string =>
    (result as { content?: { text?: string }[] }).content?.[0]?.text ?? '';

  if (mode === 'summary') {
    process.stdout.write(
      `${text(await client.callTool({ name: 'get_stack_summary', arguments: {} }))}\n`,
    );
  } else if (mode === 'propose') {
    const plan = {
      planVersion: 1,
      planId: `agent-demo-${Date.now()}`,
      requestSummary: `Agent adds a card titled ${title}`,
      commands: [
        { command: 'ADD_CARD', ref: 'agent-card', title },
        {
          command: 'ADD_ELEMENT',
          cardId: 'agent-card',
          element: {
            type: 'text',
            name: 'Agent text',
            layout: { x: 40, y: 40, width: 400, height: 60 },
            properties: { text: `Proposed by an external agent: ${title}` },
          },
        },
      ],
    };
    const result = await client.callTool({ name: 'propose_stack_patch', arguments: { plan } });
    process.stdout.write(`${text(result)}\n`);
  } else {
    process.stderr.write('usage: agent-demo summary | propose "<title>"\n');
    process.exitCode = 2;
  }
  await client.close();
}

main().catch((error: unknown) => {
  process.stderr.write(`agent-demo: ${error instanceof Error ? error.message : 'failed'}\n`);
  process.exit(1);
});
