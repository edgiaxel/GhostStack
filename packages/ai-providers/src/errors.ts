import { err, type ErrorCode, type GhostError, type Result } from '@ghoststack/shared-contracts';

/** A `GhostError` that may carry the wait the provider asked for (HTTP 429 `Retry-After`). */
export interface ProviderError extends GhostError {
  retryAfterMs?: number;
}

/** Upper bound for a honored `Retry-After`. */
export const MAX_RETRY_AFTER_MS = 60_000;

/** Fixed message templates. No response body, URL, header, key or model output ever enters one. */
export const MESSAGES = {
  cancelled: 'The request was cancelled.',
  timeout: 'The provider did not answer in time. Try again or raise the timeout.',
  network: 'The provider could not be reached. Check the address and that the service is running.',
  networkOllama:
    'Ollama could not be reached. Check that it is running, and that the OLLAMA_ORIGINS setting allows this page.',
  auth: 'The provider rejected the credentials. Check the API key.',
  rateLimit: 'The provider is rate limiting requests. Wait a moment and try again.',
  server: 'The provider reported an error. Try again later.',
  status: 'The provider answered with an unexpected status.',
  oversize: 'The provider answer was larger than the allowed size.',
  badOutput: 'The provider did not return a valid plan.',
  badEnvelope: 'The provider answer was not in the expected format.',
  noFetch: 'No network function is available in this environment.',
  promptEmpty: 'The request is empty. Describe what to change.',
  promptTooLong: 'The request is too long. Shorten it.',
  bodyTooLarge: 'The project context is too large to send. Select a single Card or shorten the request.',
  badConfig: 'The provider settings are not valid.',
} as const;

export function fail(code: ErrorCode, message: string, retryAfterMs?: number): Result<never, ProviderError> {
  const error: ProviderError = { code, message };
  if (retryAfterMs !== undefined) error.retryAfterMs = retryAfterMs;
  return err(error);
}

/** Parses delta-seconds or an HTTP-date. Returns `undefined` for anything else. Capped. */
export function parseRetryAfter(value: string | null, nowMs: number): number | undefined {
  if (value === null) return undefined;
  const text = value.trim();
  if (/^\d{1,9}$/.test(text)) return Math.min(Number(text) * 1000, MAX_RETRY_AFTER_MS);
  if (!/^[A-Za-z]{3},/.test(text)) return undefined;
  const at = Date.parse(text);
  if (!Number.isFinite(at)) return undefined;
  return Math.min(Math.max(at - nowMs, 0), MAX_RETRY_AFTER_MS);
}

/** Maps a non-success HTTP status to a normalized error. */
export function statusFailure(
  status: number,
  retryAfterHeader: string | null,
  nowMs: number,
): Result<never, ProviderError> {
  if (status === 401 || status === 403) return fail('PROVIDER_AUTH_FAILED', MESSAGES.auth);
  if (status === 429) {
    const wait = parseRetryAfter(retryAfterHeader, nowMs);
    const message =
      wait === undefined
        ? MESSAGES.rateLimit
        : `${MESSAGES.rateLimit} The provider asks for ${Math.ceil(wait / 1000)} seconds.`;
    return fail('PROVIDER_RATE_LIMIT', message, wait);
  }
  if (status >= 500) return fail('PROVIDER_UNAVAILABLE', MESSAGES.server);
  return fail('PROVIDER_UNAVAILABLE', MESSAGES.status);
}
