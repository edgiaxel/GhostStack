/** Normalized error categories (ARCHITECTURE.md section 7.8). Messages never contain input values. */
export const AI_ERROR_CODES = [
  'PROVIDER_UNAVAILABLE',
  'PROVIDER_RATE_LIMIT',
  'PROVIDER_AUTH_FAILED',
  'PROVIDER_UNSUPPORTED_CAPABILITY',
  'PROVIDER_TIMEOUT',
  'INVALID_AI_PLAN',
  'INVALID_PATCH_COMMAND',
  'UNSUPPORTED_COMMAND',
  'PROJECT_VALIDATION_FAILED',
  'CHECKPOINT_FAILED',
  'TRANSACTION_FAILED',
  'ROLLBACK_CONFLICT',
] as const;
export type AIErrorCode = (typeof AI_ERROR_CODES)[number];

export type IssuePath = readonly (string | number)[];

export interface AIIssue {
  readonly code: AIErrorCode;
  readonly message: string;
  readonly path: IssuePath;
}
