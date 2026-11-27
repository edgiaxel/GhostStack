import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { PROVIDER_KINDS } from '@ghoststack/shared-contracts';
import { SETTINGS_STORAGE_KEY, parseStoredSettings, sanitizeSettings, writeSettings } from './settings';
describe('sanitizeSettings', () => {
  it('keeps only the known non-secret fields', () => {
    expect(
      sanitizeSettings({
        kind: 'ollama',
        baseUrl: ' http://127.0.0.1:11434 ',
        model: 'llama3',
        apiKey: 'sk-x',
        extra: 1,
      }),
    ).toEqual({ kind: 'ollama', baseUrl: 'http://127.0.0.1:11434', model: 'llama3' });
  });
  it('drops address and model for the demo provider', () => {
    expect(sanitizeSettings({ kind: 'demo', baseUrl: 'http://x', model: 'm' })).toEqual({ kind: 'demo' });
  });
  it.each([null, 'x', 4, [], { kind: 'other' }, {}])('rejects %j', (input) => {
    expect(sanitizeSettings(input)).toBeUndefined();
  });
  it('rejects out of range timeouts', () => {
    expect(sanitizeSettings({ kind: 'demo', timeoutMs: 5 })).toEqual({ kind: 'demo' });
    expect(sanitizeSettings({ kind: 'demo', timeoutMs: 5000 })).toEqual({ kind: 'demo', timeoutMs: 5000 });
  });
  it('property: the result never carries an apiKey or an unknown field and is stable', () => {
    fc.assert(
      fc.property(
        fc.record({
          kind: fc.constantFrom(...PROVIDER_KINDS, 'bad'),
          baseUrl: fc.option(fc.string(), { nil: undefined }),
          model: fc.option(fc.string(), { nil: undefined }),
          apiKey: fc.string(),
          timeoutMs: fc.option(fc.integer(), { nil: undefined }),
          other: fc.anything(),
        }),
        (input) => {
          const out = sanitizeSettings(input);
          if (!out) return true;
          expect(Object.keys(out).every((k) => ['kind', 'baseUrl', 'model', 'timeoutMs'].includes(k))).toBe(
            true,
          );
          expect(sanitizeSettings(out)).toEqual(out);
          return true;
        },
      ),
    );
  });
});
describe('storage', () => {
  it('round trips under the gs.ai. prefix without a key', () => {
    const data = new Map<string, string>();
    const storage = { setItem: (k: string, v: string) => void data.set(k, v) };
    expect(
      writeSettings(storage, {
        kind: 'openai-compatible',
        baseUrl: 'https://x.test/v1',
        model: 'm',
        apiKey: 'sk-secret',
      } as never),
    ).toBe(true);
    expect([...data.keys()]).toEqual([SETTINGS_STORAGE_KEY]);
    expect(SETTINGS_STORAGE_KEY.startsWith('gs.ai.')).toBe(true);
    const raw = data.get(SETTINGS_STORAGE_KEY) ?? null;
    expect(raw).not.toContain('sk-secret');
    expect(parseStoredSettings(raw)).toEqual({
      kind: 'openai-compatible',
      baseUrl: 'https://x.test/v1',
      model: 'm',
    });
  });
  it('survives corrupt stored text and a refusing browser', () => {
    expect(parseStoredSettings('{not json')).toBeUndefined();
    expect(parseStoredSettings(null)).toBeUndefined();
    const refusing = {
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(writeSettings(refusing, { kind: 'demo' })).toBe(false);
    expect(writeSettings(undefined, { kind: 'demo' })).toBe(false);
  });
});
