import {
  AIPlanSchema,
  AI_ALLOWED_COMMAND_TYPES,
  MAX_PLAN_BYTES,
  MAX_PLAN_STEPS,
  err,
  ok,
} from '@ghoststack/shared-contracts';
import type { AIPlan, AIPlanStep, GhostError, Result } from '@ghoststack/shared-contracts';
import { canonicalJson, utf8Length } from './util';

const invalidPlan = (message: string): Result<never, GhostError> => err({ code: 'INVALID_AI_PLAN', message });
const invalidCommand = (message: string): Result<never, GhostError> =>
  err({ code: 'INVALID_PATCH_COMMAND', message });

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Short, bounded text for messages built from model-supplied values. */
const brief = (text: string, max = 80): string => (text.length > max ? `${text.slice(0, max)}...` : text);

/** Canonical JSON of a plan: object keys sorted at every level, array order kept. */
export function serializePlan(plan: AIPlan): string {
  return canonicalJson(plan);
}

/**
 * Steps in an order where each step follows everything it `dependsOn`. Among unconstrained steps the
 * original array order is kept, so the result is deterministic. Fails on an unknown id or a cycle.
 */
export function orderSteps(plan: { steps: readonly AIPlanStep[] }): Result<AIPlanStep[], GhostError> {
  const steps = plan.steps;
  const index = new Map<string, number>();
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (!step) continue;
    if (index.has(step.id)) return invalidPlan(`Step id ${brief(step.id)} is used more than once`);
    index.set(step.id, i);
  }
  const waiting = steps.map(() => 0);
  const dependents: number[][] = steps.map(() => []);
  for (let i = 0; i < steps.length; i++) {
    const deps = new Set(steps[i]?.dependsOn ?? []);
    for (const dep of deps) {
      const at = index.get(dep);
      if (at === undefined) {
        return invalidPlan(`Step ${brief(steps[i]?.id ?? '')} depends on unknown step ${brief(dep)}`);
      }
      waiting[i] = (waiting[i] ?? 0) + 1;
      dependents[at]?.push(i);
    }
  }
  const ready = new Set<number>();
  waiting.forEach((n, i) => {
    if (n === 0) ready.add(i);
  });
  const ordered: AIPlanStep[] = [];
  while (ready.size > 0) {
    let next = Infinity;
    for (const i of ready) if (i < next) next = i;
    ready.delete(next);
    const step = steps[next];
    if (step) ordered.push(step);
    for (const d of dependents[next] ?? []) {
      waiting[d] = (waiting[d] ?? 0) - 1;
      if (waiting[d] === 0) ready.add(d);
    }
  }
  if (ordered.length !== steps.length) return invalidPlan('Step dependencies contain a cycle');
  return ok(ordered);
}

/**
 * Gate for untrusted plans (provider output, MCP input, imported files). Never throws.
 * Order of checks: JSON shape, step count, byte size, command allowlist, schema, step integrity.
 * The returned plan is a fresh JSON copy: it shares nothing with `input`.
 */
export function parsePlan(input: unknown): Result<AIPlan, GhostError> {
  try {
    return parse(input);
  } catch {
    return invalidPlan('The plan could not be read as JSON data');
  }
}

function parse(input: unknown): Result<AIPlan, GhostError> {
  let text: string | undefined;
  try {
    text = JSON.stringify(input);
  } catch {
    return invalidPlan('The plan is not plain JSON data (cyclic or unsupported value)');
  }
  if (typeof text !== 'string') return invalidPlan('The plan is not plain JSON data');
  const data: unknown = JSON.parse(text);
  if (!isRecord(data)) return invalidPlan('The plan must be an object');

  const steps = data['steps'];
  if (Array.isArray(steps)) {
    if (steps.length === 0) return invalidPlan('The plan has no steps');
    if (steps.length > MAX_PLAN_STEPS) {
      return invalidPlan(`The plan has ${steps.length} steps; the limit is ${MAX_PLAN_STEPS}`);
    }
  }
  const bytes = utf8Length(text);
  if (bytes > MAX_PLAN_BYTES) {
    return invalidPlan(`The plan is ${bytes} bytes; the limit is ${MAX_PLAN_BYTES}`);
  }

  if (Array.isArray(steps)) {
    for (const step of steps) {
      if (!isRecord(step) || !isRecord(step['command'])) continue;
      const type = step['command']['type'];
      if (typeof type !== 'string') continue;
      if (!(AI_ALLOWED_COMMAND_TYPES as readonly string[]).includes(type)) {
        const id = typeof step['id'] === 'string' ? step['id'] : '?';
        return invalidCommand(`Step ${brief(id)}: command ${brief(type)} is not allowed in an AI plan`);
      }
    }
  }

  const parsed = AIPlanSchema.safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue && issue.path.length > 0 ? issue.path.map(String).join('.') : '(plan)';
    return invalidPlan(
      `Invalid plan at ${brief(path, 120)}: ${brief(issue?.message ?? 'invalid value', 120)}`,
    );
  }
  const plan = parsed.data;
  const ordered = orderSteps(plan);
  if (!ordered.ok) return ordered;
  const canonical = utf8Length(serializePlan(plan));
  if (canonical > MAX_PLAN_BYTES) {
    return invalidPlan(`The plan is ${canonical} bytes; the limit is ${MAX_PLAN_BYTES}`);
  }
  return ok(JSON.parse(serializePlan(plan)) as AIPlan);
}
