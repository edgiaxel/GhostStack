import type { StorageError } from '../port';

export const DB_NAME = 'ghoststack';
export const DB_VERSION = 2;

export interface IdbErrorContext {
  readonly phase: 'open' | 'read' | 'write';
  readonly stackId?: string;
  readonly assetId?: string;
}

function errorName(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const { name } = error as { name?: unknown };
  return typeof name === 'string' ? name : undefined;
}

/** True when the error, or the cause it wraps, is a quota failure. */
function isQuota(error: unknown): boolean {
  if (errorName(error) === 'QuotaExceededError') return true;
  const cause =
    typeof error === 'object' && error !== null ? (error as { cause?: unknown }).cause : undefined;
  return errorName(cause) === 'QuotaExceededError';
}

/** Engines word the message differently; the stored version is reported only when it is found. */
function storedVersionFrom(error: unknown): number | undefined {
  const message = (error as { message?: unknown } | null)?.message;
  if (typeof message !== 'string') return undefined;
  const match = /existing version \((\d+)\)/i.exec(message) ?? /version (\d+)/i.exec(message);
  const value = match?.[1] === undefined ? Number.NaN : Number(match[1]);
  return Number.isSafeInteger(value) ? value : undefined;
}

/** Maps any thrown value from IndexedDB to a StorageError. Never throws. */
export function mapIdbError(error: unknown, context: IdbErrorContext): StorageError {
  const ids = {
    ...(context.stackId === undefined ? {} : { stackId: context.stackId }),
    ...(context.assetId === undefined ? {} : { assetId: context.assetId }),
  };
  if (isQuota(error)) {
    return { code: 'quota-exceeded', message: 'Browser storage quota exceeded.', ...ids };
  }
  if (context.phase === 'open') {
    if (errorName(error) === 'VersionError') {
      const storedVersion = storedVersionFrom(error);
      return {
        code: 'unsupported-version',
        message: 'The stored database was written by a newer version of GhostStack.',
        ...ids,
        supportedVersion: DB_VERSION,
        ...(storedVersion === undefined ? {} : { storedVersion }),
      };
    }
    return { code: 'storage-unavailable', message: 'Browser storage could not be opened.', ...ids };
  }
  if (context.phase === 'read') {
    return { code: 'storage-unavailable', message: 'Browser storage could not be read.', ...ids };
  }
  return { code: 'write-failed', message: 'The write to browser storage failed.', ...ids };
}
