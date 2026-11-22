import { err, ok } from '@ghoststack/domain';
import type { Result } from '@ghoststack/domain';
import type { AIIssue } from '@ghoststack/ai-core';

export const MAX_RESPONSE_BYTES = 2_000_000;

export interface HttpOptions {
  readonly fetch?: typeof fetch;
  readonly timeoutMs: number;
  readonly signal?: AbortSignal | undefined;
}

export interface HttpReply {
  readonly status: number;
  readonly headers: Headers;
  readonly body: unknown;
}

const issue = (code: AIIssue['code'], message: string, extra: Partial<AIIssue> = {}): AIIssue => ({
  code,
  message,
  path: [],
  ...extra,
});

/** Seconds or an HTTP date, as allowed by the Retry-After header. Returns milliseconds. */
export function parseRetryAfter(
  value: string | null,
  now: () => number = Date.now,
): number | undefined {
  if (value === null) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - now());
}

/** Maps an HTTP status to a normalized error. Response bodies are never copied into messages. */
export function issueForStatus(status: number, headers: Headers): AIIssue {
  if (status === 401 || status === 403) {
    return issue('PROVIDER_AUTH_FAILED', 'The provider rejected the credentials.');
  }
  if (status === 429) {
    const retryAfterMs = parseRetryAfter(headers.get('retry-after'));
    return issue('PROVIDER_RATE_LIMIT', 'The provider rate limit was reached.', {
      ...(retryAfterMs === undefined ? {} : { retryAfterMs }),
    });
  }
  if (status === 400 || status === 404 || status === 422) {
    return issue(
      'PROVIDER_UNSUPPORTED_CAPABILITY',
      `The provider could not handle the request (HTTP ${status}).`,
    );
  }
  return issue('PROVIDER_UNAVAILABLE', `The provider is unavailable (HTTP ${status}).`);
}

/** One JSON request with a timeout and a response size cap. Never throws. */
export async function requestJson(
  url: string,
  init: RequestInit,
  options: HttpOptions,
): Promise<Result<HttpReply, AIIssue>> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs);
  const onExternalAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onExternalAbort, { once: true });
  if (options.signal?.aborted === true) controller.abort();
  try {
    const response = await (options.fetch ?? fetch)(url, { ...init, signal: controller.signal });
    const declared = Number(response.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) {
      return err(issue('PROVIDER_UNAVAILABLE', 'The provider response is too large.'));
    }
    const text = await response.text();
    if (text.length > MAX_RESPONSE_BYTES) {
      return err(issue('PROVIDER_UNAVAILABLE', 'The provider response is too large.'));
    }
    if (!response.ok) return err(issueForStatus(response.status, response.headers));
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return err(issue('INVALID_AI_PLAN', 'The provider response is not valid JSON.'));
    }
    return ok({ status: response.status, headers: response.headers, body });
  } catch {
    return err(
      timedOut
        ? issue('PROVIDER_TIMEOUT', 'The provider did not answer in time.')
        : issue('PROVIDER_UNAVAILABLE', 'The provider could not be reached.'),
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onExternalAbort);
  }
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
