import type { AIPlan, AbortSignalLike, GhostError, PlanRequest, Result } from '@ghoststack/shared-contracts';
import { ok } from '@ghoststack/shared-contracts';
import { MESSAGES, fail, statusFailure, type ProviderError } from './errors';
import { checkPlanOutput } from './plan-output';
import type { FetchInitLike, ResolvedDeps } from './platform';
import { MAX_PROMPT_CHARS, buildRepairMessage, buildSystemPrompt, buildUserMessage } from './prompt';
import {
  MAX_REQUEST_BYTES,
  MAX_RESPONSE_BYTES,
  byteLength,
  exchange,
  openSession,
  type Exchange,
  type Session,
} from './transport';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** What differs between wire formats. Everything else is shared by the OpenAI and Ollama adapters. */
export interface ChatWire {
  url: string;
  headers: Record<string, string>;
  buildBody(messages: ChatMessage[]): unknown;
  /** Returns the model text, or `undefined` when the answer has none or was cut off. */
  readContent(envelope: unknown): string | undefined;
  networkMessage: string;
}

export function validatePrompt(prompt: string): Result<string, GhostError> {
  if (prompt.trim().length === 0) return fail('INVALID_AI_PLAN', MESSAGES.promptEmpty);
  if (prompt.length > MAX_PROMPT_CHARS) return fail('INVALID_AI_PLAN', MESSAGES.promptTooLong);
  return ok(prompt);
}

/** Failure result for an exchange that did not produce a usable HTTP response. */
export function exchangeFailure(outcome: Exchange, networkMessage: string): Result<never, ProviderError> {
  switch (outcome.kind) {
    case 'aborted':
      return fail(
        'PROVIDER_UNAVAILABLE',
        outcome.reason === 'timeout' ? MESSAGES.timeout : MESSAGES.cancelled,
      );
    case 'oversize':
      return fail('INVALID_AI_PLAN', MESSAGES.oversize);
    case 'nofetch':
      return fail('PROVIDER_UNAVAILABLE', MESSAGES.noFetch);
    default:
      return fail('PROVIDER_UNAVAILABLE', networkMessage);
  }
}

function parseEnvelope(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

interface Attempt {
  /** Valid plan, or the safe problem text to send in a repair. */
  outcome: { plan: AIPlan } | { problem: string; raw: string };
}

async function attempt(
  deps: ResolvedDeps,
  session: Session,
  wire: ChatWire,
  messages: ChatMessage[],
): Promise<Result<Attempt, ProviderError>> {
  const body = JSON.stringify(wire.buildBody(messages));
  if (byteLength(body) > MAX_REQUEST_BYTES) return fail('INVALID_AI_PLAN', MESSAGES.bodyTooLarge);
  const init: Omit<FetchInitLike, 'signal'> = { method: 'POST', headers: wire.headers, body };
  const result = await exchange(deps, session, wire.url, init, MAX_RESPONSE_BYTES);
  if (result.kind !== 'response') return exchangeFailure(result, wire.networkMessage);
  if (result.status < 200 || result.status >= 300) {
    return statusFailure(result.status, result.headers.get('retry-after'), deps.nowMs());
  }
  const content = wire.readContent(parseEnvelope(result.text));
  if (content === undefined) return ok({ outcome: { problem: MESSAGES.badEnvelope, raw: '' } });
  const checked = checkPlanOutput(content);
  if (checked.ok) return ok({ outcome: { plan: checked.plan } });
  return ok({ outcome: { problem: checked.problem, raw: content } });
}

/**
 * One generation: the request, then at most one repair request. The timeout covers both. A network
 * error, timeout, cancellation or HTTP error status is returned at once and never retried.
 */
export async function runChatPlan(options: {
  deps: ResolvedDeps;
  wire: ChatWire;
  request: PlanRequest;
  timeoutMs: number;
  providerId: string;
  model: string | undefined;
}): Promise<Result<AIPlan, GhostError>> {
  const { deps, wire, request } = options;
  const prompt = validatePrompt(request.prompt);
  if (!prompt.ok) return prompt;
  const session = openSession(deps, options.timeoutMs, request.signal as AbortSignalLike | undefined);
  try {
    const messages: ChatMessage[] = [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user', content: buildUserMessage(request.context, request.prompt) },
    ];
    const first = await attempt(deps, session, wire, messages);
    if (!first.ok) return first;
    let outcome = first.value.outcome;
    if (!('plan' in outcome)) {
      const repair: ChatMessage[] = [
        ...messages,
        { role: 'assistant', content: outcome.raw.slice(0, 8_000) },
        { role: 'user', content: buildRepairMessage(outcome.problem) },
      ];
      const second = await attempt(deps, session, wire, repair);
      if (!second.ok) return second;
      outcome = second.value.outcome;
    }
    if (!('plan' in outcome)) return fail('INVALID_AI_PLAN', MESSAGES.badOutput);
    const providerMeta =
      options.model === undefined
        ? { providerId: options.providerId }
        : { providerId: options.providerId, model: options.model };
    return ok({ ...outcome.plan, providerMeta });
  } finally {
    session.dispose();
  }
}
