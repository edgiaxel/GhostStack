import { ElementSchema, LayoutSchema, StateEntrySchema } from '@ghoststack/domain';
import { z } from 'zod';
import type { AIIssue } from './errors';

export const AI_PLAN_VERSION = 1 as const;
export const MAX_PLAN_COMMANDS = 50;

/** Local label for something the plan creates. Real identifiers are generated when the plan is applied. */
/** No underscore: generated identifiers always contain one, so a ref can never equal a real id. */
const RefSchema = z.string().regex(/^[a-z][a-z0-9-]{0,39}$/);
/** Either an existing identifier or a ref declared by an earlier command. */
const TargetSchema = z.string().min(1).max(100);
const TitleSchema = z.string().min(1).max(100);

const [text, button, input, image, shape, line] = ElementSchema.options;
/** An element as proposed by a plan: no identifier, the applier assigns one. */
export const NewElementSchema = z.discriminatedUnion('type', [
  text.omit({ elementId: true }),
  button.omit({ elementId: true }),
  input.omit({ elementId: true }),
  image.omit({ elementId: true }),
  shape.omit({ elementId: true }),
  line.omit({ elementId: true }),
]);

const ElementChangesSchema = z.strictObject({
  name: z.string().max(100).optional(),
  layout: LayoutSchema.partial().optional(),
  properties: z.record(z.string().max(40), z.unknown()).optional(),
});

export const PatchCommandSchema = z.discriminatedUnion('command', [
  z.strictObject({ command: z.literal('ADD_CARD'), ref: RefSchema.optional(), title: TitleSchema }),
  z.strictObject({ command: z.literal('DELETE_CARD'), cardId: TargetSchema }),
  z.strictObject({
    command: z.literal('ADD_ELEMENT'),
    ref: RefSchema.optional(),
    cardId: TargetSchema,
    element: NewElementSchema,
  }),
  z.strictObject({
    command: z.literal('UPDATE_ELEMENT'),
    cardId: TargetSchema,
    elementId: TargetSchema,
    changes: ElementChangesSchema,
  }),
  z.strictObject({
    command: z.literal('DELETE_ELEMENT'),
    cardId: TargetSchema,
    elementId: TargetSchema,
  }),
  // Accepted by the schema so the contract is stable. The domain has no behavior model until M3,
  // so applying it fails with UNSUPPORTED_COMMAND.
  z.strictObject({
    command: z.literal('UPDATE_BEHAVIOR'),
    cardId: TargetSchema,
    elementId: TargetSchema.optional(),
    behavior: z.unknown(),
  }),
  z.strictObject({
    command: z.literal('UPDATE_STATE_SCHEMA'),
    set: z.record(z.string().min(1).max(60), StateEntrySchema).optional(),
    remove: z.array(z.string().min(1).max(60)).max(50).optional(),
  }),
]);

export const AIPlanSchema = z.strictObject({
  planVersion: z.literal(AI_PLAN_VERSION),
  planId: z.string().min(1).max(100),
  requestSummary: z.string().max(500),
  commands: z.array(PatchCommandSchema).min(1).max(MAX_PLAN_COMMANDS),
});

export type NewElement = z.infer<typeof NewElementSchema>;
export type PatchCommand = z.infer<typeof PatchCommandSchema>;
export type AIPlan = z.infer<typeof AIPlanSchema>;

export type PlanParseResult =
  | { readonly ok: true; readonly plan: AIPlan }
  | { readonly ok: false; readonly issues: readonly AIIssue[] };

const MAX_NAME_IN_MESSAGE = 60;

/** Messages are built from the issue code, never from zod text, so input values are not echoed. */
function structuralIssues(error: z.ZodError): AIIssue[] {
  const issues: AIIssue[] = [];
  for (const issue of error.issues) {
    const keys = issue.code === 'unrecognized_keys' ? issue.keys : [];
    const suffix =
      keys.length > 0 ? `: ${keys.map((k) => k.slice(0, MAX_NAME_IN_MESSAGE)).join(', ')}` : '';
    issues.push({
      code: 'INVALID_AI_PLAN',
      message: `Plan rejected (${issue.code})${suffix}.`,
      path: issue.path.filter((p): p is string | number => typeof p !== 'symbol'),
    });
  }
  return issues;
}

/** Commands may only use refs that an earlier command declared, and each ref is declared once. */
function dependencyIssues(plan: AIPlan): AIIssue[] {
  const issues: AIIssue[] = [];
  const issue = (message: string, path: (string | number)[]) =>
    issues.push({ code: 'INVALID_AI_PLAN', message: `Plan rejected (${message}).`, path });
  const cardRefs = new Map<string, number>();
  const elementRefs = new Map<string, number>();
  plan.commands.forEach((command, index) => {
    if (command.command !== 'ADD_CARD' && command.command !== 'ADD_ELEMENT') return;
    if (command.ref === undefined) return;
    if (cardRefs.has(command.ref) || elementRefs.has(command.ref)) {
      issue('duplicate_ref', ['commands', index, 'ref']);
      return;
    }
    (command.command === 'ADD_CARD' ? cardRefs : elementRefs).set(command.ref, index);
  });
  const usedBeforeDeclared = (refs: Map<string, number>, value: string, index: number) => {
    const declaredAt = refs.get(value);
    return declaredAt !== undefined && declaredAt >= index;
  };
  plan.commands.forEach((command, index) => {
    if ('cardId' in command && usedBeforeDeclared(cardRefs, command.cardId, index)) {
      issue('ref_used_before_declared', ['commands', index, 'cardId']);
    }
    if (
      'elementId' in command &&
      command.elementId !== undefined &&
      usedBeforeDeclared(elementRefs, command.elementId, index)
    ) {
      issue('ref_used_before_declared', ['commands', index, 'elementId']);
    }
  });
  return issues;
}

/** Total: never throws for any input. Provider output and imported plans are untrusted. */
export function parseAIPlan(input: unknown): PlanParseResult {
  try {
    const parsed = AIPlanSchema.safeParse(input);
    if (!parsed.success) return { ok: false, issues: structuralIssues(parsed.error) };
    const issues = dependencyIssues(parsed.data);
    if (issues.length > 0) return { ok: false, issues };
    return { ok: true, plan: parsed.data };
  } catch {
    return {
      ok: false,
      issues: [{ code: 'INVALID_AI_PLAN', message: 'Plan rejected (internal_error).', path: [] }],
    };
  }
}

/**
 * Keywords some provider grammar compilers reject (Nvidia via OpenRouter rejects `propertyNames`,
 * verified live on 2026-11-23). Removing them only loosens the hint sent to the provider: every
 * reply is still validated in full by `parseAIPlan`.
 */
const PROVIDER_UNSUPPORTED_KEYWORDS: ReadonlySet<string> = new Set(['propertyNames']);

function stripUnsupported(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripUnsupported);
  if (typeof node !== 'object' || node === null) return node;
  const copy: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (!PROVIDER_UNSUPPORTED_KEYWORDS.has(key)) copy[key] = stripUnsupported(value);
  }
  return copy;
}

/** JSON Schema for structured-output requests, generated from the schema plans are validated with. */
export function aiPlanJsonSchema(): Record<string, unknown> {
  const schema = stripUnsupported(z.toJSONSchema(AIPlanSchema)) as Record<string, unknown>;
  delete schema['$schema'];
  return schema;
}
