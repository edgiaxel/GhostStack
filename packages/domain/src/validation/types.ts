export const VALIDATION_ERROR_CODES = [
  'MISSING_FIELD',
  'INVALID_TYPE',
  'INVALID_VALUE',
  'UNKNOWN_FIELD',
  'INVALID_ID',
  'ENTRY_CARD_NOT_FOUND',
  'CARD_ORDER_REFERENCE_NOT_FOUND',
  'CARD_ORDER_DUPLICATE',
  'CARD_ORDER_OMITS_CARD',
  'CARD_ID_DUPLICATE',
  'CARD_KEY_MISMATCH',
  'ELEMENT_ID_DUPLICATE',
  'ELEMENT_ASSET_NOT_FOUND',
  'ASSET_KEY_MISMATCH',
  'ASSET_PATH_INVALID',
  'ASSET_SIZE_INVALID',
  'ASSET_CHECKSUM_INVALID',
  'TITLE_TOO_LONG',
  'TIMESTAMP_INVALID',
  'VALIDATOR_INTERNAL_ERROR',
] as const;

export type ValidationErrorCode = (typeof VALIDATION_ERROR_CODES)[number];

export type PathSegment = string | number;

export interface ValidationError {
  readonly code: ValidationErrorCode;
  /** Human readable. Never contains values taken from the input. */
  readonly message: string;
  readonly path: readonly PathSegment[];
  /** Identifiers and rule names such as cardId, elementId, assetId, rule, field. */
  readonly details: Readonly<Record<string, string | number>>;
}

export interface ValidationResult {
  readonly errors: readonly ValidationError[];
}

export const isValid = (result: ValidationResult): boolean => result.errors.length === 0;
