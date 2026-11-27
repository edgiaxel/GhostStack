import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ERROR_CODES,
  AIPlanSchema,
  type AIProviderAdapter,
  type ProviderConfig,
} from '@ghoststack/shared-contracts';
import { createDemoProvider } from './demo';
import { FAST_DEPS, WIRES, realPlan } from './testing/harness';
import { SENTINEL_KEY, makeContext } from './testing/fixtures';
import { startMockServer, type MockServer } from './testing/mock-server';

/**
 * One behavioral suite run against every adapter. HTTP adapters talk to a local server that answers
 * with a real plan from the demo rule engine.
 */
let server: MockServer;
beforeAll(async () => {
  server = await startMockServer((request) => {
    const chat = request.method === 'POST';
    const wire = request.path.startsWith('/api') ? WIRES[1]! : WIRES[0]!;
    return chat
      ? { body: wire.chatBody(JSON.stringify(realPlan())) }
      : { body: wire.probeBody(['contract-model']) };
  });
});
afterAll(async () => {
  await server.close();
});

interface Subject {
  name: string;
  make(): AIProviderAdapter;
  id: string;
}

const subjects: Subject[] = [
  { name: 'demo', id: 'demo', make: () => createDemoProvider() },
  ...WIRES.map((wire): Subject => ({
    name: wire.kind,
    id: wire.kind,
    make: () => {
      const config: ProviderConfig = {
        kind: wire.kind,
        baseUrl: server.url,
        model: 'contract-model',
        apiKey: SENTINEL_KEY,
      };
      return wire.create(config, FAST_DEPS);
    },
  })),
];

describe.each(subjects)('adapter contract: $name', (subject) => {
  const req = (prompt = 'Make a quiz about space') => ({ context: makeContext(), prompt });

  it('has identity and capabilities', () => {
    const adapter = subject.make();
    expect(adapter.id).toBe(subject.id);
    expect(adapter.label.length).toBeGreaterThan(0);
    expect(adapter.capabilities.streaming).toBe(false);
    for (const flag of Object.values(adapter.capabilities)) expect(typeof flag).toBe('boolean');
  });

  it('testConnection reports ready', async () => {
    const result = await subject.make().testConnection();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.detail.length).toBeGreaterThan(0);
  });

  it('generatePlan returns a plan that satisfies the shared schema', async () => {
    const result = await subject.make().generatePlan(req());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(AIPlanSchema.safeParse(result.value).success).toBe(true);
      expect(result.value.providerMeta?.providerId).toBe(subject.id);
    }
  });

  it('returns a failure for an aborted signal', async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await subject.make().generatePlan({ ...req(), signal: controller.signal });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(ERROR_CODES).toContain(result.error.code);
  });

  it('rejects an overlong prompt with INVALID_AI_PLAN', async () => {
    const result = await subject.make().generatePlan(req('q'.repeat(4_001)));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_AI_PLAN');
  });

  it('does not throw for any call', async () => {
    const adapter = subject.make();
    await expect(adapter.generatePlan(req(''))).resolves.toBeDefined();
    await expect(adapter.testConnection()).resolves.toBeDefined();
  });

  it('puts the sentinel key in no output', async () => {
    const adapter = subject.make();
    const outputs = [
      await adapter.testConnection(),
      await adapter.generatePlan(req()),
      await adapter.generatePlan(req('')),
      adapter,
    ];
    for (const out of outputs) expect(JSON.stringify(out)).not.toContain(SENTINEL_KEY);
    expect(String(adapter)).not.toContain(SENTINEL_KEY);
  });
});
