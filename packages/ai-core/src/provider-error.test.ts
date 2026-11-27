import { describe, expect, it } from 'vitest';
import { MAX_RETRY_AFTER_MS, normalizeProviderError } from './provider-error';
import type { ProviderFailure } from './provider-error';

const NOW = Date.parse('2026-12-02T10:00:00Z');

describe('normalizeProviderError', () => {
  it.each([401, 403])('maps HTTP %i to PROVIDER_AUTH_FAILED', (status) => {
    expect(normalizeProviderError({ kind: 'http', status }, NOW).code).toBe('PROVIDER_AUTH_FAILED');
  });

  it('maps 429 to PROVIDER_RATE_LIMIT and parses delta-seconds', () => {
    const e = normalizeProviderError({ kind: 'http', status: 429, retryAfter: '12' }, NOW);
    expect(e.code).toBe('PROVIDER_RATE_LIMIT');
    expect(e.retryAfterMs).toBe(12_000);
    expect(e.message).toContain('12 seconds');
  });

  it('parses an HTTP-date Retry-After against the supplied clock (number or ISO string)', () => {
    const header = 'Wed, 02 Dec 2026 10:00:30 GMT';
    expect(normalizeProviderError({ kind: 'http', status: 429, retryAfter: header }, NOW).retryAfterMs).toBe(
      30_000,
    );
    expect(
      normalizeProviderError({ kind: 'http', status: 429, retryAfter: header }, '2026-12-02T10:00:00Z')
        .retryAfterMs,
    ).toBe(30_000);
  });

  it('floors a past HTTP-date at zero', () => {
    const e = normalizeProviderError(
      { kind: 'http', status: 429, retryAfter: 'Wed, 02 Dec 2026 09:00:00 GMT' },
      NOW,
    );
    expect(e.retryAfterMs).toBe(0);
  });

  it('caps a long wait', () => {
    const e = normalizeProviderError({ kind: 'http', status: 429, retryAfter: '999999' }, NOW);
    expect(e.retryAfterMs).toBe(MAX_RETRY_AFTER_MS);
    const date = normalizeProviderError(
      { kind: 'http', status: 503, retryAfter: 'Wed, 02 Dec 2027 10:00:00 GMT' },
      NOW,
    );
    expect(date.retryAfterMs).toBe(MAX_RETRY_AFTER_MS);
  });

  it.each(['soon', '-5', '1.5', '', '   ', 'NaN', '12abc', 'x'.repeat(200)])(
    'gives no wait for %j',
    (retryAfter) => {
      const e = normalizeProviderError({ kind: 'http', status: 429, retryAfter }, NOW);
      expect(e.retryAfterMs).toBeUndefined();
      expect(e.code).toBe('PROVIDER_RATE_LIMIT');
    },
  );

  it.each<ProviderFailure>([
    { kind: 'network' },
    { kind: 'timeout' },
    { kind: 'http', status: 500 },
    { kind: 'http', status: 503 },
    { kind: 'http', status: 404 },
    { kind: 'http' },
  ])('maps %j to PROVIDER_UNAVAILABLE', (failure) => {
    expect(normalizeProviderError(failure, NOW).code).toBe('PROVIDER_UNAVAILABLE');
  });

  it('maps malformed JSON to INVALID_AI_PLAN', () => {
    expect(normalizeProviderError({ kind: 'malformed-json' }, NOW).code).toBe('INVALID_AI_PLAN');
  });

  it('returns an error for malformed input without throwing', () => {
    for (const bad of [null, undefined, {}, { kind: 'weird' }, { kind: 7 }, { kind: 'http', status: 'x' }]) {
      const e = normalizeProviderError(bad as never, NOW);
      expect(e.code).toBe('PROVIDER_UNAVAILABLE');
    }
  });

  it('never puts caller-supplied text in the message', () => {
    const sentinel = 'SENTINEL-sk-live-123456';
    const failures = [
      { kind: sentinel, status: sentinel, retryAfter: sentinel },
      { kind: 'http', status: 401, retryAfter: sentinel, body: sentinel, url: sentinel },
      { kind: 'http', status: 429, retryAfter: sentinel },
      { kind: 'http', status: 502, retryAfter: sentinel, message: sentinel },
      { kind: 'malformed-json', retryAfter: sentinel, body: sentinel },
      { kind: 'network', retryAfter: sentinel, cause: sentinel },
    ];
    for (const f of failures) {
      const e = normalizeProviderError(f as never, sentinel);
      expect(JSON.stringify(e)).not.toContain(sentinel);
    }
  });
});
