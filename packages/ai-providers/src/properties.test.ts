import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ERROR_CODES, type GhostError, type Result } from '@ghoststack/shared-contracts';
import type { FetchLike } from './platform';
import { createOllamaProvider } from './ollama';
import { createOpenAICompatibleProvider } from './openai';
import { SENTINEL_KEY, makeContext } from './testing/fixtures';
import { realPlan } from './testing/harness';

const responseArb = fc.record({
  status: fc.integer({ min: 100, max: 599 }),
  retryAfter: fc.option(
    fc.oneof(fc.string({ maxLength: 40 }), fc.integer({ min: -5, max: 1e9 }).map(String)),
    { nil: undefined },
  ),
  body: fc.oneof(
    fc.string({ maxLength: 300 }),
    fc.json(),
    fc.string({ maxLength: 40 }).map((s) => `${s}${SENTINEL_KEY}`),
    fc
      .string({ maxLength: 40 })
      .map((s) => JSON.stringify({ choices: [{ message: { content: s } }], message: { content: s } })),
    fc.constant(JSON.stringify({ choices: [{ message: { content: JSON.stringify(realPlan()) } }] })),
  ),
});

function fetchFor(spec: { status: number; retryAfter: string | undefined; body: string }): FetchLike {
  return async () => ({
    status: spec.status,
    ok: spec.status >= 200 && spec.status < 300,
    headers: { get: (name) => (name.toLowerCase() === 'retry-after' ? (spec.retryAfter ?? null) : null) },
    text: async () => spec.body,
  });
}

function check(result: Result<unknown, GhostError>): void {
  expect(typeof result.ok).toBe('boolean');
  if (!result.ok) expect(ERROR_CODES).toContain(result.error.code);
  expect(JSON.stringify(result)).not.toContain(SENTINEL_KEY);
}

const config = { model: 'm', apiKey: SENTINEL_KEY, baseUrl: 'http://127.0.0.1:9' } as const;
const factories = [
  (f: FetchLike) =>
    createOpenAICompatibleProvider({ kind: 'openai-compatible', ...config }, { fetch: f, retryDelayMs: 0 }),
  (f: FetchLike) =>
    createOllamaProvider(
      { kind: 'ollama', model: 'm', baseUrl: config.baseUrl },
      { fetch: f, retryDelayMs: 0 },
    ),
];

describe.each(factories.map((make, i) => [i === 0 ? 'openai-compatible' : 'ollama', make] as const))(
  '%s: arbitrary provider answers',
  (_name, make) => {
    it('generatePlan never throws and leaks no key', async () => {
      await fc.assert(
        fc.asyncProperty(responseArb, async (spec) => {
          const result = await make(fetchFor(spec)).generatePlan({ context: makeContext(), prompt: 'quiz' });
          check(result);
        }),
        { numRuns: 150 },
      );
    });

    it('testConnection never throws and leaks no key', async () => {
      await fc.assert(
        fc.asyncProperty(responseArb, async (spec) => {
          check(await make(fetchFor(spec)).testConnection());
        }),
        { numRuns: 150 },
      );
    });

    it('survives a fetch that throws or rejects with the key in the error', async () => {
      const throwing: FetchLike = () => {
        throw new Error(`boom ${SENTINEL_KEY}`);
      };
      const rejecting: FetchLike = () => Promise.reject(new Error(`nope ${SENTINEL_KEY}`));
      for (const f of [throwing, rejecting]) {
        check(await make(f).generatePlan({ context: makeContext(), prompt: 'quiz' }));
        check(await make(f).testConnection());
      }
    });

    it('sends at most two chat requests for one generatePlan', async () => {
      await fc.assert(
        fc.asyncProperty(responseArb, async (spec) => {
          let posts = 0;
          const inner = fetchFor(spec);
          await make((url, init) => {
            if (init.method === 'POST') posts++;
            return inner(url, init);
          }).generatePlan({ context: makeContext(), prompt: 'quiz' });
          expect(posts).toBeLessThanOrEqual(2);
        }),
        { numRuns: 100 },
      );
    });
  },
);
