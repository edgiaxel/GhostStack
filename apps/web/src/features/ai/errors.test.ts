import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ERROR_CODES } from '@ghoststack/shared-contracts';
import { boundText, presentError } from './errors';
describe('presentError', () => {
  it.each(ERROR_CODES)('%s has a title, a next step and a way out', (code) => {
    const view = presentError({ code, message: 'Something failed.' });
    expect(view.title.length).toBeGreaterThan(5);
    expect(view.next.length).toBeGreaterThan(10);
    expect(view.actions.length).toBeGreaterThan(0);
    expect(`${view.title}${view.next}`).not.toMatch(/—/);
  });
  it('removes the key everywhere', () => {
    const key = 'sk-test-SECRET-1234';
    const view = presentError({ code: 'PROVIDER_AUTH_FAILED', message: `bad ${key} and ${key}` }, (t) =>
      t.split(key).join('[key removed]'),
    );
    expect(JSON.stringify(view)).not.toContain(key);
  });
  it('keeps messages that may echo model output out of the main text', () => {
    const view = presentError({ code: 'INVALID_AI_PLAN', message: 'Step x: <script>alert(1)</script>' });
    expect(view.message).toBeUndefined();
    expect(view.detail).toContain('script');
  });
  it('passes a usable retry wait and ignores a bad one', () => {
    expect(presentError({ code: 'PROVIDER_RATE_LIMIT', message: 'm', retryAfterMs: 2000 }).retryAfterMs).toBe(
      2000,
    );
    expect(
      presentError({ code: 'PROVIDER_RATE_LIMIT', message: 'm', retryAfterMs: Number.NaN }).retryAfterMs,
    ).toBeUndefined();
    expect(
      presentError({ code: 'PROVIDER_RATE_LIMIT', message: 'm', retryAfterMs: -1 }).retryAfterMs,
    ).toBeUndefined();
  });
  it('property: shown text is bounded and has no control characters', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 2000 }), (text) => {
        const out = boundText(text);
        expect(out.length).toBeLessThanOrEqual(240);
        expect(Array.from(out).every((c) => (c.codePointAt(0) ?? 0) >= 32 && c !== '\u007f')).toBe(true);
      }),
    );
  });
});
