/**
 * Minimal structural types for the platform pieces the adapters use. The package compiles without
 * the DOM or Node libraries, so `fetch`, timers and `AbortController` are reached through these
 * shapes and can be injected.
 */

export interface HeadersLike {
  get(name: string): string | null;
}

export interface ReaderLike {
  read(): Promise<{ done: boolean; value?: Uint8Array }>;
  cancel(): Promise<void>;
}

export interface ResponseLike {
  readonly status: number;
  readonly ok: boolean;
  readonly headers: HeadersLike;
  readonly body?: { getReader(): ReaderLike } | null;
  text(): Promise<string>;
}

export interface FetchInitLike {
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  body?: string;
  signal?: unknown;
}

export type FetchLike = (url: string, init: FetchInitLike) => Promise<ResponseLike>;

interface AbortControllerLike {
  readonly signal: unknown;
  abort(): void;
}

interface PlatformGlobals {
  fetch?: FetchLike;
  setTimeout?: (fn: () => void, ms: number) => unknown;
  clearTimeout?: (handle: unknown) => void;
  AbortController?: new () => AbortControllerLike;
  TextDecoder?: new () => { decode(input?: Uint8Array, options?: { stream?: boolean }): string };
}

const platform = globalThis as unknown as PlatformGlobals;

/** Everything an adapter takes from the environment. Every field defaults to the platform value. */
export interface ProviderDeps {
  fetch?: FetchLike;
  nowMs?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  /** Pause before a connection-test retry. Default 300 ms. */
  retryDelayMs?: number;
}

export interface ResolvedDeps {
  fetch: FetchLike | undefined;
  nowMs: () => number;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
  retryDelayMs: number;
}

export function resolveDeps(deps: ProviderDeps = {}): ResolvedDeps {
  return {
    fetch: deps.fetch ?? (platform.fetch ? (url, init) => platform.fetch!(url, init) : undefined),
    nowMs: deps.nowMs ?? (() => Date.now()),
    setTimer: deps.setTimer ?? ((fn, ms) => platform.setTimeout!(fn, ms)),
    clearTimer: deps.clearTimer ?? ((h) => platform.clearTimeout!(h)),
    retryDelayMs: deps.retryDelayMs ?? 300,
  };
}

export function createAbortController(): AbortControllerLike | undefined {
  return platform.AbortController ? new platform.AbortController() : undefined;
}

export function createUtf8Decoder():
  { decode(input?: Uint8Array, options?: { stream?: boolean }): string } | undefined {
  return platform.TextDecoder ? new platform.TextDecoder() : undefined;
}
