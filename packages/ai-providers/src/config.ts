import { z } from 'zod';
import {
  PROVIDER_KINDS,
  type GhostError,
  type ProviderConfig,
  type ProviderKind,
  type Result,
} from '@ghoststack/shared-contracts';
import { err, ok } from '@ghoststack/shared-contracts';
import { MESSAGES } from './errors';

export const OLLAMA_DEFAULT_BASE_URL = 'http://127.0.0.1:11434';
export const OPENAI_DEFAULT_BASE_URL = 'https://api.openai.com/v1';

const ConfigSchema = z.object({
  kind: z.enum(PROVIDER_KINDS),
  baseUrl: z.string().min(1).max(2048).optional(),
  model: z
    .string()
    .regex(/^[A-Za-z0-9][A-Za-z0-9._:/@+-]{0,127}$/)
    .optional(),
  timeoutMs: z.number().int().min(1_000).max(600_000).optional(),
  /** Visible ASCII only: the key goes into one header and nowhere else. */
  apiKey: z
    .string()
    .regex(/^[\x21-\x7e]{1,1024}$/)
    .optional(),
});

export interface ResolvedConfig {
  kind: ProviderKind;
  /** No trailing slash. Absent for the demo provider. */
  baseUrl: string | undefined;
  loopback: boolean;
  model: string | undefined;
  timeoutMs: number | undefined;
  apiKey: string | undefined;
}

const URL_PATTERN =
  /^(https?):\/\/(\[[0-9A-Fa-f:]+\]|[A-Za-z0-9.-]+)(?::(\d{1,5}))?(\/[A-Za-z0-9._~%!$&'()*+,;=:@/-]*)?$/;

export function isLoopbackHost(host: string): boolean {
  const h = host.toLowerCase();
  return h === 'localhost' || h === '[::1]' || /^127(?:\.\d{1,3}){3}$/.test(h);
}

function unsupported(): Result<never, GhostError> {
  return err({ code: 'PROVIDER_UNSUPPORTED_CAPABILITY', message: MESSAGES.badConfig });
}

/** Joins a base URL and a path with exactly one slash. */
export function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

/**
 * Validates and normalizes provider settings. The error text is fixed: it never echoes the address,
 * the model or the key.
 */
export function resolveConfig(input: ProviderConfig): Result<ResolvedConfig, GhostError> {
  const parsed = ConfigSchema.safeParse(input);
  if (!parsed.success) return unsupported();
  const c = parsed.data;
  if (c.kind === 'demo') {
    return ok({
      kind: 'demo',
      baseUrl: undefined,
      loopback: true,
      model: c.model,
      timeoutMs: c.timeoutMs,
      apiKey: undefined,
    });
  }
  const raw = c.baseUrl ?? (c.kind === 'ollama' ? OLLAMA_DEFAULT_BASE_URL : OPENAI_DEFAULT_BASE_URL);
  const match = URL_PATTERN.exec(raw.trim());
  if (!match) return unsupported();
  const [, scheme, host, port, path] = match;
  if (!scheme || !host || (port !== undefined && Number(port) > 65535)) return unsupported();
  const loopback = isLoopbackHost(host);
  // A key must never travel in clear text across a network. Ollama takes no key, so a LAN host is allowed.
  if (c.kind === 'openai-compatible' && scheme === 'http' && !loopback) return unsupported();
  const baseUrl = `${scheme}://${host}${port !== undefined ? `:${port}` : ''}${(path ?? '').replace(/\/+$/, '')}`;
  return ok({
    kind: c.kind,
    baseUrl,
    loopback,
    model: c.model,
    timeoutMs: c.timeoutMs,
    apiKey: c.kind === 'ollama' ? undefined : c.apiKey,
  });
}
