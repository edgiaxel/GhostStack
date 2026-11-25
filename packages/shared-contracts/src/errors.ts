/** Error categories from ARCHITECTURE 7.8. Add new codes only via the contract owner. */
export const ERROR_CODES = [
  'PROVIDER_UNAVAILABLE',
  'PROVIDER_RATE_LIMIT',
  'PROVIDER_AUTH_FAILED',
  'PROVIDER_UNSUPPORTED_CAPABILITY',
  'INVALID_AI_PLAN',
  'INVALID_PATCH_COMMAND',
  'PROJECT_VALIDATION_FAILED',
  'CHECKPOINT_FAILED',
  'TRANSACTION_FAILED',
  'MCP_CONNECTION_FAILED',
  'ASSET_MISSING',
  'PROJECT_IMPORT_FAILED',
  'PROJECT_EXPORT_FAILED',
  'STORAGE_FAILED',
  'STACK_NOT_FOUND',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export interface GhostError {
  code: ErrorCode;
  message: string;
}

export type Result<T, E = GhostError> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E = GhostError>(error: E): Result<never, E> => ({ ok: false, error });
