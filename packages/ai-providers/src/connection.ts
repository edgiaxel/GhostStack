import type { AbortSignalLike, ConnectionInfo, GhostError, Result } from '@ghoststack/shared-contracts';
import { MESSAGES, fail, statusFailure, type ProviderError } from './errors';
import { exchangeFailure } from './chat';
import type { ResolvedDeps } from './platform';
import { DEFAULT_TEST_TIMEOUT_MS, exchange, openSession, pause } from './transport';

export const MAX_LISTED_MODELS = 200;
const MAX_TEST_RETRIES = 2;

export interface ConnectionProbe {
  url: string;
  headers: Record<string, string>;
  networkMessage: string;
  /** Model names from the provider's answer, or `undefined` when the answer was not readable. */
  readModels(envelope: unknown): string[] | undefined;
  /** Maps the listed names and the configured model to a result. */
  describe(models: string[] | undefined): Result<ConnectionInfo, ProviderError>;
}

function parse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export function boundModels(names: unknown[]): string[] {
  return names
    .filter((n): n is string => typeof n === 'string' && n.length > 0)
    .slice(0, MAX_LISTED_MODELS)
    .map((n) => n.slice(0, 200));
}

export function connectedDetail(count: number | undefined): string {
  if (count === undefined) return 'Connected.';
  return `Connected, ${count} ${count === 1 ? 'model' : 'models'}.`;
}

/**
 * A read-only GET. Retries up to twice after a network error, a timeout or a 5xx status. It never
 * retries after 401, 403 or 429, and never after a cancellation. Each attempt has its own timeout.
 */
export async function runConnectionTest(
  deps: ResolvedDeps,
  probe: ConnectionProbe,
  timeoutMs: number | undefined,
  caller: AbortSignalLike | undefined,
): Promise<Result<ConnectionInfo, GhostError>> {
  let last: Result<never, ProviderError> = fail('PROVIDER_UNAVAILABLE', probe.networkMessage);
  for (let attempt = 0; attempt <= MAX_TEST_RETRIES; attempt++) {
    const session = openSession(deps, timeoutMs ?? DEFAULT_TEST_TIMEOUT_MS, caller);
    try {
      const outcome = await exchange(deps, session, probe.url, { method: 'GET', headers: probe.headers });
      if (outcome.kind === 'response') {
        if (outcome.status >= 200 && outcome.status < 300) {
          const models = probe.readModels(parse(outcome.text));
          return probe.describe(models);
        }
        last = statusFailure(outcome.status, outcome.headers.get('retry-after'), deps.nowMs());
        if (outcome.status < 500) return last;
      } else {
        last = exchangeFailure(outcome, probe.networkMessage);
        if (outcome.kind === 'nofetch') return last;
        if (outcome.kind === 'aborted' && outcome.reason === 'cancelled') return last;
        if (outcome.kind === 'oversize') return last;
      }
      if (attempt < MAX_TEST_RETRIES) {
        const gap = openSession(deps, deps.retryDelayMs + 1_000, caller);
        try {
          await pause(deps, gap, deps.retryDelayMs * (attempt + 1));
          if (gap.reason() === 'cancelled') return fail('PROVIDER_UNAVAILABLE', MESSAGES.cancelled);
        } finally {
          gap.dispose();
        }
      }
    } finally {
      session.dispose();
    }
  }
  return last;
}
