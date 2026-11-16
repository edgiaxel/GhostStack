import { afterEach, describe, expect, it, vi } from 'vitest';
import { sha256Checksum } from './checksum';

const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);

describe('sha256Checksum', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('matches the known vector for empty input', async () => {
    expect(await sha256Checksum(new Uint8Array())).toEqual({
      ok: true,
      value: 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    });
  });

  it('matches the known vector for "abc"', async () => {
    expect(await sha256Checksum(bytes('abc'))).toEqual({
      ok: true,
      value: 'sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    });
  });

  it('returns CRYPTO_UNAVAILABLE when Web Crypto is absent', async () => {
    vi.stubGlobal('crypto', undefined);
    const result = await sha256Checksum(bytes('abc'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CRYPTO_UNAVAILABLE');
  });
});
