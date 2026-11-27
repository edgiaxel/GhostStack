import { describe, expect, it } from 'vitest';
import { PROVIDER_KINDS, type ProviderConfig } from '@ghoststack/shared-contracts';
import { createProvider, describeProvider, listProviderKinds } from './registry';
import type { FetchLike } from './platform';
import { SENTINEL_KEY, makeContext } from './testing/fixtures';

const counting = (): { fetch: FetchLike; calls: string[] } => {
  const calls: string[] = [];
  return {
    calls,
    fetch: async (url) => {
      calls.push(url);
      throw new Error('network down');
    },
  };
};

describe('provider registry', () => {
  it('creates one adapter per kind and sends nothing on creation', () => {
    const net = counting();
    const ids = PROVIDER_KINDS.map((kind) => createProvider({ kind, model: 'm' }, { fetch: net.fetch }).id);
    expect(ids).toEqual(['demo', 'ollama', 'openai-compatible']);
    expect(net.calls).toHaveLength(0);
  });

  it('lists the kinds without creating an adapter', () => {
    expect(listProviderKinds().map((k) => k.kind)).toEqual([...PROVIDER_KINDS]);
  });

  it.each<[string, ProviderConfig]>([
    ['unknown kind', { kind: 'nope' as never }],
    ['not a URL', { kind: 'openai-compatible', baseUrl: 'not a url' }],
    ['ftp scheme', { kind: 'openai-compatible', baseUrl: 'ftp://example.com' }],
    ['credentials in URL', { kind: 'ollama', baseUrl: 'http://user:pw@127.0.0.1' }],
    ['query string', { kind: 'ollama', baseUrl: 'http://127.0.0.1:11434?x=1' }],
    [
      'plain http to a remote host with a key',
      { kind: 'openai-compatible', baseUrl: 'http://example.com/v1', apiKey: 'k' },
    ],
    ['bad port', { kind: 'ollama', baseUrl: 'http://127.0.0.1:99999' }],
    ['bad model characters', { kind: 'ollama', model: 'a b; rm -rf' }],
    ['control character in key', { kind: 'openai-compatible', apiKey: 'a\nb' }],
    ['timeout too small', { kind: 'ollama', timeoutMs: 5 }],
  ])('rejects %s with PROVIDER_UNSUPPORTED_CAPABILITY and sends nothing', async (_name, config) => {
    const net = counting();
    const described = describeProvider(config);
    expect(described.ok).toBe(false);
    if (!described.ok) expect(described.error.code).toBe('PROVIDER_UNSUPPORTED_CAPABILITY');
    const adapter = createProvider(config, { fetch: net.fetch });
    for (const result of [
      await adapter.testConnection(),
      await adapter.generatePlan({ context: makeContext(), prompt: 'quiz' }),
    ]) {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('PROVIDER_UNSUPPORTED_CAPABILITY');
    }
    expect(net.calls).toHaveLength(0);
  });

  it('accepts https remote hosts and http loopback hosts', () => {
    expect(
      describeProvider({ kind: 'openai-compatible', baseUrl: 'https://example.com/v1', apiKey: 'k' }).ok,
    ).toBe(true);
    expect(describeProvider({ kind: 'openai-compatible', baseUrl: 'http://localhost:1234/v1' }).ok).toBe(
      true,
    );
    expect(describeProvider({ kind: 'ollama', baseUrl: 'http://[::1]:11434' }).ok).toBe(true);
  });

  it('describes locality and never returns the key', () => {
    const remote = describeProvider({ kind: 'openai-compatible', apiKey: SENTINEL_KEY, model: 'gpt' });
    expect(remote.ok && remote.value.locality).toBe('remote');
    const local = describeProvider({ kind: 'ollama', model: 'llama3' });
    expect(local.ok && local.value.locality).toBe('local');
    const lan = describeProvider({ kind: 'ollama', baseUrl: 'http://192.168.1.5:11434' });
    expect(lan.ok && lan.value.locality).toBe('remote');
    const demo = describeProvider({ kind: 'demo' });
    expect(demo.ok && demo.value.locality).toBe('local');
    expect(JSON.stringify([remote, local, lan, demo])).not.toContain(SENTINEL_KEY);
  });

  it('does not fall back to another provider when the chosen one fails', async () => {
    const net = counting();
    const adapter = createProvider(
      { kind: 'openai-compatible', baseUrl: 'https://example.com/v1', model: 'm', apiKey: 'k' },
      { fetch: net.fetch, retryDelayMs: 0 },
    );
    const result = await adapter.generatePlan({ context: makeContext(), prompt: 'Make a quiz' });
    expect(result.ok).toBe(false);
    expect(net.calls).toEqual(['https://example.com/v1/chat/completions']);
    if (!result.ok) expect(result.error.code).toBe('PROVIDER_UNAVAILABLE');
  });

  it('ignores a key given to the demo or Ollama provider', async () => {
    const net = counting();
    const ollama = createProvider({ kind: 'ollama', model: 'm', apiKey: SENTINEL_KEY }, { fetch: net.fetch });
    expect(JSON.stringify(ollama)).not.toContain(SENTINEL_KEY);
    const demo = createProvider({ kind: 'demo', apiKey: SENTINEL_KEY });
    const result = await demo.generatePlan({ context: makeContext(), prompt: 'quiz' });
    expect(JSON.stringify(result)).not.toContain(SENTINEL_KEY);
  });
});
