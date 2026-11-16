import { err, ok } from '@ghoststack/domain';
import type { Result } from '@ghoststack/domain';

export interface CryptoUnavailableError {
  readonly code: 'CRYPTO_UNAVAILABLE';
  readonly message: string;
}

export async function sha256Checksum(
  bytes: Uint8Array,
): Promise<Result<string, CryptoUnavailableError>> {
  const subtle = (globalThis as { crypto?: { subtle?: SubtleCrypto } }).crypto?.subtle;
  if (subtle === undefined) {
    return err({
      code: 'CRYPTO_UNAVAILABLE',
      message: 'Web Crypto is not available. It needs HTTPS or localhost.',
    });
  }
  const digest = new Uint8Array(await subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>));
  const hex = Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return ok(`sha256:${hex}`);
}
