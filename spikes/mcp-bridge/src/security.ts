import { createHash, timingSafeEqual } from 'node:crypto';

export const MIN_TOKEN_LENGTH = 32;

/** Hashing first gives both sides equal length, so the comparison does not leak the token length. */
export function tokensMatch(provided: string, expected: string): boolean {
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

export function bearerToken(header: string | undefined): string | undefined {
  if (header === undefined) return undefined;
  const match = /^Bearer ([^\s]+)$/.exec(header);
  return match?.[1];
}

export type TokenProblem = 'missing' | 'too-short';

/** A token must come from the environment or a generator. Short or empty tokens are refused. */
export function checkTokenStrength(token: string | undefined): TokenProblem | undefined {
  if (token === undefined || token === '') return 'missing';
  return token.length < MIN_TOKEN_LENGTH ? 'too-short' : undefined;
}

/** Only the loopback names for the port actually bound. Anything else is a DNS-rebinding attempt. */
export function isAllowedHost(hostHeader: string | undefined, port: number): boolean {
  if (hostHeader === undefined) return false;
  return [`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`].includes(
    hostHeader.toLowerCase(),
  );
}

/** Exact match only. There is no wildcard and the string "null" is never accepted. */
export function isAllowedOrigin(origin: string, allowed: readonly string[]): boolean {
  return origin !== 'null' && allowed.includes(origin);
}
