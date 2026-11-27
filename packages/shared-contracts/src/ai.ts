import { z } from 'zod';
import { BehaviorSchema, StateVariableSchema } from './behavior';
import type { GhostError, Result } from './errors';
import { ElementSchema, LayoutSchema } from './project';
import type { ProjectCommand } from './commands';

/**
 * AI plan, provider and operation contract (M3, ARCHITECTURE 7.3, 7.4, 7.5).
 * A plan holds `ProjectCommand`s only. It never holds code, patches or file access.
 */

export const AI_PLAN_SCHEMA_VERSION = 1 as const;
export const MAX_PLAN_STEPS = 50;
export const MAX_PLAN_BYTES = 64 * 1024;

/** Commands an AI plan may contain. Everything else (assets, viewport, stack rename) is rejected. */
export const AI_ALLOWED_COMMAND_TYPES = [
  'ADD_CARD',
  'RENAME_CARD',
  'DUPLICATE_CARD',
  'REORDER_CARDS',
  'DELETE_CARD',
  'ADD_ELEMENT',
  'UPDATE_ELEMENT',
  'DELETE_ELEMENT',
  'REORDER_ELEMENT',
  'UPDATE_BEHAVIOR',
  'UPDATE_STATE_SCHEMA',
  'SET_CARD_BACKGROUND',
] as const satisfies readonly ProjectCommand['type'][];
export type AIAllowedCommandType = (typeof AI_ALLOWED_COMMAND_TYPES)[number];
export type AIPlanCommand = Extract<ProjectCommand, { type: AIAllowedCommandType }>;

export function isAllowedCommandType(type: unknown): type is AIAllowedCommandType {
  return typeof type === 'string' && (AI_ALLOWED_COMMAND_TYPES as readonly string[]).includes(type);
}

const Id = z.string().min(1).max(128);
const ElementPatchSchema = z.strictObject({
  name: z.string().optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
  layout: LayoutSchema.omit({ zIndex: true }).partial().optional(),
  assetId: z.string().min(1).nullable().optional(),
});

/** Strict: unknown keys and unknown command types fail. */
export const AIPlanCommandSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('ADD_CARD'),
    cardId: Id,
    title: z.string(),
    index: z.number().int().nonnegative().optional(),
  }),
  z.strictObject({ type: z.literal('RENAME_CARD'), cardId: Id, title: z.string() }),
  z.strictObject({ type: z.literal('DUPLICATE_CARD'), cardId: Id, newCardId: Id }),
  z.strictObject({ type: z.literal('REORDER_CARDS'), cardOrder: z.array(Id) }),
  z.strictObject({ type: z.literal('DELETE_CARD'), cardId: Id }),
  z.strictObject({ type: z.literal('ADD_ELEMENT'), cardId: Id, element: ElementSchema }),
  z.strictObject({
    type: z.literal('UPDATE_ELEMENT'),
    cardId: Id,
    elementId: Id,
    patch: ElementPatchSchema,
  }),
  z.strictObject({ type: z.literal('DELETE_ELEMENT'), cardId: Id, elementId: Id }),
  z.strictObject({
    type: z.literal('REORDER_ELEMENT'),
    cardId: Id,
    elementId: Id,
    placement: z.enum(['front', 'back', 'forward', 'backward']),
  }),
  z.strictObject({
    type: z.literal('UPDATE_BEHAVIOR'),
    cardId: Id,
    elementId: Id.optional(),
    behaviors: z.array(BehaviorSchema),
  }),
  z.strictObject({
    type: z.literal('UPDATE_STATE_SCHEMA'),
    stateSchema: z.record(z.string(), StateVariableSchema),
  }),
  z.strictObject({
    type: z.literal('SET_CARD_BACKGROUND'),
    cardId: Id,
    background: z.string().nullable(),
  }),
]) as unknown as z.ZodType<AIPlanCommand>;

export const AIPlanStepSchema = z.strictObject({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  cardId: Id.optional(),
  /** One plain sentence for the review screen. */
  rationale: z.string().max(500),
  command: AIPlanCommandSchema,
  /** Step ids that must run first. Default: previous steps in array order. */
  dependsOn: z.array(z.string()).max(MAX_PLAN_STEPS).optional(),
});
export type AIPlanStep = z.infer<typeof AIPlanStepSchema>;

export const AIPlanSchema = z.strictObject({
  schemaVersion: z.literal(AI_PLAN_SCHEMA_VERSION),
  summary: z.string().min(1).max(300),
  affectedCardIds: z.array(Id).max(MAX_PLAN_STEPS),
  steps: z.array(AIPlanStepSchema).min(1).max(MAX_PLAN_STEPS),
  providerMeta: z
    .strictObject({ providerId: z.string().max(64), model: z.string().max(128).optional() })
    .optional(),
});
export type AIPlan = z.infer<typeof AIPlanSchema>;

/* Context sent to a provider. Built by `ai-core.buildContext`; never holds asset bytes or data URLs. */

export type ContextScope = { kind: 'stack' } | { kind: 'card'; cardId: string };

export interface ProjectContext {
  schemaVersion: 1;
  scope: ContextScope;
  stack: {
    title: string;
    entryCardId: string;
    cardOrder: string[];
    stateSchema: Record<string, unknown>;
    viewport: { width: number; height: number };
  };
  cards: { cardId: string; title: string; elementCount: number; navigatesTo: string[] }[];
  /** Full detail of the scoped Card (or of every Card when scope is the Stack and the budget allows). */
  detail: unknown[];
  /** Runtime action names and their argument shapes, generated from the contract. */
  registeredActions: { type: string; description: string }[];
  truncated: boolean;
  charCount: number;
}

/* Providers */

export const PROVIDER_KINDS = ['demo', 'ollama', 'openai-compatible'] as const;
export type ProviderKind = (typeof PROVIDER_KINDS)[number];

export interface AIProviderCapabilities {
  structuredOutput: boolean;
  jsonMode: boolean;
  streaming: boolean;
  /** True when no data leaves the machine (demo, Ollama on loopback). Drives the local/remote label. */
  local: boolean;
}

/** Settings that may be stored (IndexedDB `interfacePrefs`). Never holds a key. */
export interface PersistedProviderSettings {
  kind: ProviderKind;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
}

/** Runtime config. `apiKey` lives in memory only: never persisted, logged, exported or put in an error. */
export interface ProviderConfig extends PersistedProviderSettings {
  apiKey?: string;
}

/** Structural subset of `AbortSignal` so domain-side packages need no DOM lib. */
export interface AbortSignalLike {
  readonly aborted: boolean;
  addEventListener(type: 'abort', listener: () => void, options?: { once?: boolean }): void;
  removeEventListener(type: 'abort', listener: () => void): void;
}

export interface PlanRequest {
  context: ProjectContext;
  prompt: string;
  signal?: AbortSignalLike;
}

export interface ConnectionInfo {
  ok: true;
  /** Human text such as "Connected, 3 models". Never a raw provider body. */
  detail: string;
  models?: string[];
}

/**
 * Adapters validate their own output with `AIPlanSchema` (one bounded repair retry allowed) and
 * return normalized errors. `ai-core.parsePlan` runs again as the gate before review.
 */
export interface AIProviderAdapter {
  readonly id: string;
  readonly label: string;
  readonly capabilities: AIProviderCapabilities;
  testConnection(signal?: AbortSignalLike): Promise<Result<ConnectionInfo, GhostError>>;
  generatePlan(request: PlanRequest): Promise<Result<AIPlan, GhostError>>;
}

/* Operation state (transaction) */

export const AI_OPERATION_STATES = [
  'planning',
  'review',
  'applying',
  'done',
  'failed',
  'cancelled',
  'reverted',
] as const;
export type AIOperationState = (typeof AI_OPERATION_STATES)[number];

export interface AIOperationProgress {
  state: AIOperationState;
  stepIndex: number;
  stepCount: number;
  message: string;
}
