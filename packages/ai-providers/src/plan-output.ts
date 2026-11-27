import {
  AIPlanSchema,
  MAX_PLAN_BYTES,
  isAllowedCommandType,
  type AIPlan,
} from '@ghoststack/shared-contracts';
import { byteLength } from './transport';

export type PlanCheck = { ok: true; plan: AIPlan } | { ok: false; problem: string };

const FENCE = /^\s*```(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n?```\s*$/;

/** Accepts bare JSON or JSON inside one Markdown fence. Any other surrounding text is invalid. */
export function extractJsonText(content: string): string {
  const fenced = FENCE.exec(content);
  return fenced?.[1] !== undefined ? fenced[1] : content;
}

function safeSegment(segment: PropertyKey): string {
  return String(segment)
    .replace(/[^A-Za-z0-9_-]/g, '')
    .slice(0, 40);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Hosted models often omit fields the domain treats as required but empty by default: an element's
 * `behaviors` list and `properties`, and `layout.zIndex` (ADD_ELEMENT ignores it and stacks on top).
 * Filling those with empty data is lossless and runs no code; everything else still has to pass
 * `AIPlanSchema`, then `parsePlan` and `dryRunPlan` with `validateStack` before review.
 */
/** Fills `conditions: []`, `enabled: true` and a deterministic `behaviorId` (`<owner>-b<n>`) when absent. */
function fillBehaviorDefaults(list: unknown, owner: string): unknown {
  if (!Array.isArray(list)) return list;
  return list.map((b: unknown, i) =>
    isRecord(b)
      ? {
          behaviorId: `${owner}-b${i + 1}`,
          conditions: [],
          enabled: true,
          ...b,
        }
      : b,
  );
}

function fillElementDefaults(plan: Record<string, unknown>): Record<string, unknown> {
  if (!Array.isArray(plan['steps'])) return plan;
  const steps = plan['steps'].map((step: unknown) => {
    if (!isRecord(step) || !isRecord(step['command'])) return step;
    const command = step['command'];
    if (command['type'] === 'UPDATE_BEHAVIOR') {
      const owner = String(command['elementId'] ?? command['cardId'] ?? 'card');
      return {
        ...step,
        command: { ...command, behaviors: fillBehaviorDefaults(command['behaviors'], owner) },
      };
    }
    if (command['type'] !== 'ADD_ELEMENT' || !isRecord(command['element'])) return step;
    const element = command['element'];
    const layout = isRecord(element['layout']) ? element['layout'] : undefined;
    const owner = String(element['elementId'] ?? 'element');
    return {
      ...step,
      command: {
        ...command,
        element: {
          ...element,
          behaviors: fillBehaviorDefaults(element['behaviors'] ?? [], owner),
          properties: element['properties'] ?? {},
          ...(layout ? { layout: { zIndex: 0, ...layout } } : {}),
        },
      },
    };
  });
  return { ...plan, steps: hoistCreations(steps) };
}

/**
 * Hosted models often add a button that navigates to a Card before the step that creates that Card,
 * which the dry run then rejects. State variables and new Cards never depend on elements, so moving
 * them first (relative order kept) is safe. The reordered plan is what the creator reviews, and
 * `orderSteps` in ai-core still honors `dependsOn`.
 */
function hoistCreations(steps: unknown[]): unknown[] {
  const rank = (step: unknown): number => {
    const type = isRecord(step) && isRecord(step['command']) ? step['command']['type'] : undefined;
    return type === 'UPDATE_STATE_SCHEMA' ? 0 : type === 'ADD_CARD' ? 1 : 2;
  };
  return steps
    .map((step, i) => ({ step, i }))
    .sort((a, b) => rank(a.step) - rank(b.step) || a.i - b.i)
    .map(({ step }) => step);
}

/**
 * Validates model output against the shared plan schema and the command allowlist. The problem text
 * is built from fixed words, schema paths and issue codes only, so it is safe to send back in a
 * repair message and safe to show.
 */
export function checkPlanOutput(content: string): PlanCheck {
  let value: unknown;
  try {
    value = JSON.parse(extractJsonText(content));
  } catch {
    return { ok: false, problem: 'The output is not valid JSON.' };
  }
  if (!isRecord(value)) return { ok: false, problem: 'The output must be one JSON object.' };
  if (byteLength(JSON.stringify(value)) > MAX_PLAN_BYTES) {
    return { ok: false, problem: `The plan is larger than ${MAX_PLAN_BYTES / 1024} kB.` };
  }
  const steps = Array.isArray(value['steps']) ? value['steps'] : [];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const command = isRecord(step) ? step['command'] : undefined;
    const type = isRecord(command) ? command['type'] : undefined;
    if (!isAllowedCommandType(type)) {
      const shown = typeof type === 'string' && /^[A-Za-z_]{1,40}$/.test(type) ? type : 'an unknown type';
      return { ok: false, problem: `Step ${i + 1} uses a command type that is not allowed (${shown}).` };
    }
  }
  const parsed = AIPlanSchema.safeParse(fillElementDefaults(value));
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.map(safeSegment).join('.') || '(root)'}: ${safeSegment(issue.code)}`);
    return { ok: false, problem: `The plan does not match the schema: ${issues.join('; ')}.` };
  }
  const { providerMeta: _ignored, ...rest } = parsed.data;
  void _ignored;
  return { ok: true, plan: rest };
}
