import { err, ok } from '@ghoststack/domain';
import type { Project, Result } from '@ghoststack/domain';
import type { AIIssue } from './errors';
import { parseAIPlan } from './plan';
import type { AIPlan } from './plan';

export interface ProviderCapabilities {
  /** How the provider can be asked for structured output. Providers differ, so it is explicit. */
  readonly structuredOutput: 'json-schema' | 'json-mode' | 'none';
  /** True when the model runs on the creator's machine. */
  readonly local: boolean;
  readonly requiresCredential: boolean;
}

/** The only project data a provider receives. No asset bytes, no element text. */
export interface ProjectContext {
  readonly stackId: string;
  readonly title: string;
  readonly cards: readonly {
    readonly cardId: string;
    readonly title: string;
    readonly elementCount: number;
  }[];
  readonly stateKeys: readonly string[];
}

export interface ConnectionInfo {
  readonly model: string;
}

export interface GenerateOptions {
  readonly signal?: AbortSignal;
}

export interface AIProviderAdapter {
  readonly id: string;
  readonly capabilities: ProviderCapabilities;
  testConnection(options?: GenerateOptions): Promise<Result<ConnectionInfo, AIIssue>>;
  /** Returns a plan that already passed `parseAIPlan`. Output is untrusted until then. */
  generatePlan(
    context: ProjectContext,
    prompt: string,
    options?: GenerateOptions,
  ): Promise<Result<AIPlan, AIIssue>>;
}

export const buildProjectContext = (project: Project): ProjectContext => ({
  stackId: project.stackId,
  title: project.title,
  cards: project.cardOrder.flatMap((cardId) => {
    const card = project.cards[cardId];
    return card === undefined
      ? []
      : [{ cardId, title: card.title, elementCount: card.elements.length }];
  }),
  stateKeys: Object.keys(project.stateSchema).sort(),
});

export interface PrivacyPolicy {
  /** The creator explicitly allowed sending project context to a remote provider. */
  readonly allowRemote: boolean;
}

/** Never falls back to another provider: the caller names one adapter and gets that adapter or an error. */
export async function requestPlan(
  adapter: AIProviderAdapter,
  context: ProjectContext,
  prompt: string,
  policy: PrivacyPolicy,
  options?: GenerateOptions,
): Promise<Result<AIPlan, AIIssue>> {
  if (!adapter.capabilities.local && !policy.allowRemote) {
    return err({
      code: 'REMOTE_PROVIDER_NOT_ALLOWED',
      message: 'Sending project context to a remote provider needs explicit permission.',
      path: [],
    });
  }
  return adapter.generatePlan(context, prompt, options);
}

export const MAX_PROVIDER_TEXT_CHARS = 200_000;

/** Strips one Markdown code fence if the model wrapped its JSON in it. */
const unfence = (text: string): string => {
  const match = /^\s*```(?:json)?\s*\n([\s\S]*?)\n\s*```\s*$/.exec(text);
  return match?.[1] ?? text;
};

/** Turns raw provider text into a validated plan. Total: any input yields a Result. */
export function parsePlanText(text: string): Result<AIPlan, AIIssue> {
  if (text.length > MAX_PROVIDER_TEXT_CHARS) {
    return err({
      code: 'INVALID_AI_PLAN',
      message: 'The provider response is too large.',
      path: [],
    });
  }
  let json: unknown;
  try {
    json = JSON.parse(unfence(text));
  } catch {
    return err({
      code: 'INVALID_AI_PLAN',
      message: 'The provider response is not valid JSON.',
      path: [],
    });
  }
  const parsed = parseAIPlan(json);
  if (parsed.ok) return ok(parsed.plan);
  const [first] = parsed.issues;
  return err({
    code: 'INVALID_AI_PLAN',
    message: `The plan was rejected (${parsed.issues.length} issue(s)). First: ${first?.message ?? 'unknown'}`,
    path: first?.path ?? [],
  });
}
