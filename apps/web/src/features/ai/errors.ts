import type { ErrorCode, GhostError } from '@ghoststack/shared-contracts';
/** What a failure looks like on screen: a title, what to do next, and which recovery buttons apply. */
export interface ErrorView {
  code: ErrorCode;
  title: string;
  /** The next action in plain words. */
  next: string;
  /** Provider-written fixed text that is safe to show. Absent for codes whose message may echo model output. */
  message: string | undefined;
  /** Bounded technical text for the collapsed details area. Never a raw provider body. */
  detail: string | undefined;
  actions: ErrorAction[];
  retryAfterMs: number | undefined;
}
export type ErrorAction = 'retry' | 'edit-request' | 'open-settings' | 'dismiss';
interface Copy {
  title: string;
  next: string;
  actions: ErrorAction[];
  /** True when `GhostError.message` is a fixed template and can be shown as is. */
  fixedMessage: boolean;
}
/** Exhaustive over `ErrorCode`: adding a code to the contract fails typecheck here until it gets a next action. */
const COPY: Record<ErrorCode, Copy> = {
  PROVIDER_UNAVAILABLE: {
    title: 'The provider did not answer',
    next: 'Check that the service is running and the address is right, then try again. For Ollama, check OLLAMA_ORIGINS. You can keep editing meanwhile.',
    actions: ['retry', 'open-settings', 'dismiss'],
    fixedMessage: true,
  },
  PROVIDER_RATE_LIMIT: {
    title: 'The provider is rate limiting requests',
    next: 'Wait for the time shown, then try again.',
    actions: ['retry', 'dismiss'],
    fixedMessage: true,
  },
  PROVIDER_AUTH_FAILED: {
    title: 'The provider rejected the API key',
    next: 'Check the API key in the provider settings and enter it again. The key is kept in memory only.',
    actions: ['open-settings', 'dismiss'],
    fixedMessage: true,
  },
  PROVIDER_UNSUPPORTED_CAPABILITY: {
    title: 'The provider settings are not usable',
    next: 'Open the settings and check the address and the model name.',
    actions: ['open-settings', 'dismiss'],
    fixedMessage: true,
  },
  INVALID_AI_PLAN: {
    title: 'The assistant did not return a usable plan',
    next: 'Rewrite the request with more detail, or try again. Nothing in your project changed.',
    actions: ['edit-request', 'retry', 'dismiss'],
    fixedMessage: false,
  },
  INVALID_PATCH_COMMAND: {
    title: 'The plan contains a change that is not allowed',
    next: 'Reject the plan and edit the request. Nothing in your project changed.',
    actions: ['edit-request', 'dismiss'],
    fixedMessage: false,
  },
  PROJECT_VALIDATION_FAILED: {
    title: 'The plan does not fit your project',
    next: 'Edit the request so it matches the current cards and elements. Nothing in your project changed.',
    actions: ['edit-request', 'dismiss'],
    fixedMessage: false,
  },
  CHECKPOINT_FAILED: {
    title: 'The safety checkpoint could not be saved',
    next: 'Browser storage may be full or blocked. Free space, then approve again. Nothing in your project changed.',
    actions: ['retry', 'dismiss'],
    fixedMessage: true,
  },
  TRANSACTION_FAILED: {
    title: 'The change was not applied',
    next: 'Review the plan again and approve it once more. Your project was not changed.',
    actions: ['retry', 'edit-request', 'dismiss'],
    fixedMessage: true,
  },
  MCP_CONNECTION_FAILED: {
    title: 'The agent connection failed',
    next: 'Check that the MCP server is running and paired, then try again. Manual editing is not affected.',
    actions: ['dismiss'],
    fixedMessage: true,
  },
  ASSET_MISSING: {
    title: 'An image is missing',
    next: 'Add the image again in the inspector, then retry.',
    actions: ['dismiss'],
    fixedMessage: false,
  },
  PROJECT_IMPORT_FAILED: {
    title: 'The plan file could not be read',
    next: 'Check that the file is a GhostStack plan and try again.',
    actions: ['dismiss'],
    fixedMessage: false,
  },
  PROJECT_EXPORT_FAILED: {
    title: 'The export failed',
    next: 'Try the export again.',
    actions: ['dismiss'],
    fixedMessage: false,
  },
  STORAGE_FAILED: {
    title: 'Browser storage failed',
    next: 'Free space or allow storage for this site, then try again.',
    actions: ['retry', 'dismiss'],
    fixedMessage: false,
  },
  STACK_NOT_FOUND: {
    title: 'The project is no longer available',
    next: 'Go back to the library and open the project again.',
    actions: ['dismiss'],
    fixedMessage: false,
  },
};
const MAX_DETAIL = 240;
/** Cuts, flattens and strips control characters so a message cannot break the layout or smuggle markup. */
export function boundText(text: string, max = MAX_DETAIL): string {
  const flat = Array.from(text, (ch) => {
    const code = ch.codePointAt(0) ?? 0;
    return code < 32 || code === 127 ? ' ' : ch;
  })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  return flat.length > max ? `${flat.slice(0, max - 3)}...` : flat;
}
/**
 * Builds the on-screen error. `redact` removes the API key from any text first. Messages from codes
 * that may echo model output go to the collapsed detail only.
 */
export function presentError(
  error: GhostError & { retryAfterMs?: number },
  redact: (text: string) => string = (t) => t,
): ErrorView {
  const copy = COPY[error.code] ?? COPY.TRANSACTION_FAILED;
  const text = boundText(redact(String(error.message ?? '')));
  const retry = error.retryAfterMs;
  return {
    code: error.code,
    title: copy.title,
    next: copy.next,
    message: copy.fixedMessage && text ? text : undefined,
    detail: !copy.fixedMessage && text ? text : undefined,
    actions: copy.actions,
    retryAfterMs: typeof retry === 'number' && Number.isFinite(retry) && retry > 0 ? retry : undefined,
  };
}
