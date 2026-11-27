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
  const parsed = AIPlanSchema.safeParse(value);
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
