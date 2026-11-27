import type { AbortSignalLike } from '@ghoststack/shared-contracts';
import {
  createAbortController,
  createUtf8Decoder,
  type FetchInitLike,
  type HeadersLike,
  type ResolvedDeps,
  type ResponseLike,
} from './platform';

export const DEFAULT_GENERATE_TIMEOUT_MS = 60_000;
export const DEFAULT_TEST_TIMEOUT_MS = 10_000;
export const MAX_RESPONSE_BYTES = 1_048_576;
export const MAX_REQUEST_BYTES = 256 * 1024;

export type AbortReason = 'cancelled' | 'timeout';

/** One deadline and one cancellation scope. `generatePlan` shares one across the repair retry. */
export interface Session {
  readonly signal: unknown;
  readonly aborted: Promise<void>;
  reason(): AbortReason | undefined;
  dispose(): void;
}

export function openSession(deps: ResolvedDeps, timeoutMs: number, caller?: AbortSignalLike): Session {
  const controller = createAbortController();
  let reason: AbortReason | undefined;
  let release: () => void = () => undefined;
  const aborted = new Promise<void>((resolve) => {
    release = resolve;
  });
  const stop = (why: AbortReason): void => {
    if (reason !== undefined) return;
    reason = why;
    controller?.abort();
    release();
  };
  const onCallerAbort = (): void => stop('cancelled');
  if (caller?.aborted) stop('cancelled');
  else caller?.addEventListener('abort', onCallerAbort, { once: true });
  const timer = reason === undefined ? deps.setTimer(() => stop('timeout'), timeoutMs) : undefined;
  return {
    signal: controller?.signal,
    aborted,
    reason: () => reason,
    dispose: () => {
      if (timer !== undefined) deps.clearTimer(timer);
      caller?.removeEventListener('abort', onCallerAbort);
    },
  };
}

export type Exchange =
  | { kind: 'response'; status: number; headers: HeadersLike; text: string }
  | { kind: 'oversize'; status: number }
  | { kind: 'aborted'; reason: AbortReason }
  | { kind: 'network' }
  | { kind: 'nofetch' };

async function readBounded(response: ResponseLike, maxBytes: number): Promise<string | null> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  const reader = response.body?.getReader();
  const decoder = createUtf8Decoder();
  if (!reader || !decoder) {
    const text = await response.text();
    return text.length > maxBytes ? null : text;
  }
  let total = 0;
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
  }
  return text + decoder.decode();
}

/** One bounded HTTP exchange. Never throws. Resolves within the session deadline. */
export async function exchange(
  deps: ResolvedDeps,
  session: Session,
  url: string,
  init: Omit<FetchInitLike, 'signal'>,
  maxBytes: number = MAX_RESPONSE_BYTES,
): Promise<Exchange> {
  const doFetch = deps.fetch;
  if (!doFetch) return { kind: 'nofetch' };
  if (session.reason() !== undefined) return { kind: 'aborted', reason: session.reason()! };
  const work = (async (): Promise<Exchange> => {
    try {
      const response = await doFetch(url, { ...init, signal: session.signal });
      const text = await readBounded(response, maxBytes);
      if (text === null) return { kind: 'oversize', status: response.status };
      return { kind: 'response', status: response.status, headers: response.headers, text };
    } catch {
      return { kind: 'network' };
    }
  })();
  const winner = await Promise.race([work, session.aborted.then((): 'aborted' => 'aborted')]);
  if (winner === 'aborted') return { kind: 'aborted', reason: session.reason() ?? 'cancelled' };
  const reason = session.reason();
  if (reason !== undefined) return { kind: 'aborted', reason };
  return winner;
}

/** Waits `ms`, ending early if the session aborts. */
export async function pause(deps: ResolvedDeps, session: Session, ms: number): Promise<void> {
  if (ms <= 0) return;
  let timer: unknown;
  await Promise.race([
    new Promise<void>((resolve) => {
      timer = deps.setTimer(resolve, ms);
    }),
    session.aborted,
  ]);
  deps.clearTimer(timer);
}

export function byteLength(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}
