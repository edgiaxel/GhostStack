import type { GhostError } from '@ghoststack/shared-contracts';

/** Plain data about a failed provider call. Built by the adapter from the transport, never from user text. */
export interface ProviderFailure {
  kind: 'network' | 'timeout' | 'http' | 'malformed-json';
  /** HTTP status when `kind` is `http`. */
  status?: number;
  /** Raw `Retry-After` header: delta-seconds or an HTTP-date. */
  retryAfter?: string;
}

export interface NormalizedProviderError extends GhostError {
  /** Wait before the next attempt, in milliseconds, when the provider gave a usable `Retry-After`. */
  retryAfterMs?: number;
}

/** Upper bound for a returned wait: a hostile or buggy header cannot park the UI for hours. */
export const MAX_RETRY_AFTER_MS = 5 * 60 * 1000;

function toEpochMs(now: string | number): number {
  const value = typeof now === 'number' ? now : Date.parse(now);
  return Number.isFinite(value) ? value : 0;
}

/** Wait in ms from a `Retry-After` value, capped. Undefined when the value cannot be parsed. */
function parseRetryAfter(raw: unknown, now: string | number): number | undefined {
  if (typeof raw !== 'string') return undefined;
  const text = raw.trim();
  if (text.length === 0 || text.length > 64) return undefined;
  if (/^\d{1,9}$/.test(text)) return Math.min(Number(text) * 1000, MAX_RETRY_AFTER_MS);
  if (!/^[A-Za-z]{3,9},?\s/.test(text)) return undefined;
  const at = Date.parse(text);
  if (!Number.isFinite(at)) return undefined;
  return Math.min(Math.max(0, at - toEpochMs(now)), MAX_RETRY_AFTER_MS);
}

const wait = (ms: number | undefined): string =>
  ms === undefined || ms <= 0 ? '' : ` Try again in about ${Math.max(1, Math.round(ms / 1000))} seconds.`;

/**
 * Maps a provider failure to a `GhostError` (ARCHITECTURE 7.8). Messages come from fixed templates:
 * no response body, URL, header text or caller string ever reaches them. Never throws.
 * `now` is the current time as epoch milliseconds or an ISO 8601 string; it only matters for
 * HTTP-date `Retry-After` values.
 */
export function normalizeProviderError(
  failure: ProviderFailure,
  now: string | number,
): NormalizedProviderError {
  const kind: unknown = failure?.kind;
  const status: unknown = failure?.status;
  const retryAfterMs = parseRetryAfter(failure?.retryAfter, now);
  const withWait = (error: GhostError): NormalizedProviderError =>
    retryAfterMs === undefined ? error : { ...error, retryAfterMs };

  if (kind === 'malformed-json') {
    return {
      code: 'INVALID_AI_PLAN',
      message: 'The provider answered in a format GhostStack cannot read. Try again or choose another model.',
    };
  }
  if (kind === 'http' && (status === 401 || status === 403)) {
    return {
      code: 'PROVIDER_AUTH_FAILED',
      message: 'The provider rejected the credentials. Check the API key and the selected model.',
    };
  }
  if (kind === 'http' && status === 429) {
    return withWait({
      code: 'PROVIDER_RATE_LIMIT',
      message: `The provider is limiting requests.${wait(retryAfterMs)} Wait a moment and try again.`,
    });
  }
  if (kind === 'timeout') {
    return withWait({
      code: 'PROVIDER_UNAVAILABLE',
      message: 'The provider did not answer in time. Check that it is running and try again.',
    });
  }
  if (kind === 'network') {
    return withWait({
      code: 'PROVIDER_UNAVAILABLE',
      message: 'GhostStack could not reach the provider. Check the address and your connection.',
    });
  }
  if (kind === 'http' && typeof status === 'number' && status >= 500) {
    return withWait({
      code: 'PROVIDER_UNAVAILABLE',
      message: `The provider reported a server problem.${wait(retryAfterMs)} Try again later.`,
    });
  }
  return withWait({
    code: 'PROVIDER_UNAVAILABLE',
    message: 'The provider could not complete the request. Try again later.',
  });
}
