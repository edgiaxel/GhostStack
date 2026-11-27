import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { applyCommand as realApply, validateStack } from '@ghoststack/domain';
import type { AIPlan, AIPlanCommand, Stack } from '@ghoststack/shared-contracts';
import { buildContext } from './context';
import { dryRunPlan } from './dry-run';
import { parsePlan, serializePlan } from './plan';
import { summarizePlan } from './summary';
import { revertOperation, runTransaction } from './transaction';
import { NOW, baseStack, createMemorySession, element, plan, step } from './testing';
import { clone } from './util';

const RUNS = { numRuns: 150 };

const title = fc.string({ minLength: 1, maxLength: 24 }).filter((t) => t.trim().length > 0);
const dataUrl = fc.constantFrom(
  'data:image/png;base64,AAAA',
  'data:text/plain,hello',
  'DATA:image/gif;base64,R0lG',
);
const mixedTitle = fc
  .tuple(title, fc.option(dataUrl, { nil: undefined }))
  .map(([t, d]) => (d === undefined ? t : `${t} ${d}`));

/** Plans that are valid by construction against `baseStack()`: new Cards, elements on them, one rename. */
const validPlan: fc.Arbitrary<AIPlan> = fc
  .tuple(
    fc.array(fc.tuple(mixedTitle, fc.array(fc.string({ maxLength: 40 }), { maxLength: 3 })), {
      minLength: 1,
      maxLength: 4,
    }),
    fc.option(title, { nil: undefined }),
  )
  .map(([cards, rename]) => {
    const steps: AIPlan['steps'] = [];
    cards.forEach(([t, texts], i) => {
      steps.push(step(`add-${i}`, { type: 'ADD_CARD', cardId: `card-${i}`, title: t }));
      texts.forEach((text, j) => {
        steps.push(
          step(`el-${i}-${j}`, {
            type: 'ADD_ELEMENT',
            cardId: `card-${i}`,
            element: element(`e-${i}-${j}`, 'text', { text, fontSize: 16 }),
          }),
        );
      });
    });
    if (rename !== undefined)
      steps.push(step('rename', { type: 'RENAME_CARD', cardId: 'c1', title: rename }));
    return plan(steps, 'Generated plan');
  });

const cardId = fc.constantFrom('c1', 'a', 'b', 'missing');
const elementId = fc.constantFrom('e1', 'e2', 'x');
/** Commands that often fail against `baseStack()`: used to test failure paths. */
const anyCommand: fc.Arbitrary<AIPlanCommand> = fc.oneof(
  fc.record({ type: fc.constant('ADD_CARD' as const), cardId, title }),
  fc.record({ type: fc.constant('RENAME_CARD' as const), cardId, title }),
  fc.record({ type: fc.constant('DELETE_CARD' as const), cardId }),
  fc.record({ type: fc.constant('DUPLICATE_CARD' as const), cardId, newCardId: cardId }),
  fc.record({ type: fc.constant('DELETE_ELEMENT' as const), cardId, elementId }),
  fc.record({
    type: fc.constant('REORDER_CARDS' as const),
    cardOrder: fc.shuffledSubarray(['c1', 'a', 'b']),
  }),
  fc.record({ type: fc.constant('SET_CARD_BACKGROUND' as const), cardId, background: fc.constant(null) }),
);
const chaoticPlan = fc.array(anyCommand, { minLength: 1, maxLength: 6 }).map((commands) =>
  plan(
    commands.map((c, i) => step(`s${i}`, c)),
    'Chaotic plan',
  ),
);

const approve = (p: AIPlan) => ({
  approvedPlan: serializePlan(p),
  checkpoints: { put: () => Promise.resolve() },
  now: NOW,
  newId: (() => {
    let n = 0;
    return () => `op-${++n}`;
  })(),
});

describe('properties', () => {
  it('parsePlan never throws and always returns a Result', () => {
    fc.assert(
      fc.property(fc.anything(), (input) => {
        const r = parsePlan(input);
        return typeof r.ok === 'boolean' && (r.ok || r.error.message.length > 0);
      }),
      RUNS,
    );
    fc.assert(
      fc.property(fc.jsonValue(), (input) => typeof parsePlan(input).ok === 'boolean'),
      RUNS,
    );
  });

  it('parsePlan never throws on valid plans with one corrupted value', () => {
    fc.assert(
      fc.property(validPlan, fc.nat(40), fc.anything(), (p, at, junk) => {
        const copy = JSON.parse(JSON.stringify(p)) as Record<string, unknown>;
        const keys = Object.keys(copy);
        copy[keys[at % keys.length] as string] = junk;
        return typeof parsePlan(copy).ok === 'boolean';
      }),
      RUNS,
    );
  });

  it('serialize then parse round-trips, and serializing again is identical', () => {
    fc.assert(
      fc.property(validPlan, (p) => {
        const text = serializePlan(p);
        const parsed = parsePlan(JSON.parse(text));
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        expect(parsed.value).toEqual(p);
        expect(serializePlan(parsed.value)).toBe(text);
      }),
      RUNS,
    );
  });

  it('dryRunPlan never mutates its input, and a passing dry run is a valid Stack', () => {
    fc.assert(
      fc.property(fc.oneof(validPlan, chaoticPlan), (p) => {
        const stack = baseStack();
        const before = clone(stack);
        const planBefore = clone(p);
        const r = dryRunPlan(stack, p, NOW);
        expect(stack).toEqual(before);
        expect(p).toEqual(planBefore);
        if (r.ok && r.value.status === 'ok') expect(validateStack(r.value.stack).ok).toBe(true);
      }),
      RUNS,
    );
  });

  it('valid-by-construction plans pass the dry run', () => {
    fc.assert(
      fc.property(validPlan, (p) => {
        const r = dryRunPlan(baseStack(), p, NOW);
        expect(r.ok && r.value.status).toBe('ok');
      }),
      RUNS,
    );
  });

  it('summarizePlan puts every step in exactly one group', () => {
    fc.assert(
      fc.property(fc.oneof(validPlan, chaoticPlan), (p) => {
        const s = summarizePlan(baseStack(), p);
        const ids = [...s.cards.flatMap((c) => c.stepIds), ...s.stack.stepIds].sort();
        expect(ids).toEqual(p.steps.map((x) => x.id).sort());
      }),
      RUNS,
    );
  });

  it('a failed or cancelled transaction leaves the Stack deep-equal to the base', async () => {
    await fc.assert(
      fc.asyncProperty(
        validPlan,
        fc.constantFrom('checkpoint', 'step', 'validate', 'restore', 'restore-throw', 'cancel', 'stale'),
        fc.nat(10),
        async (p, point, n) => {
          const session = createMemorySession(baseStack(), {
            ...(point === 'restore' ? { restoreFails: 'error' as const } : {}),
            ...(point === 'restore-throw' ? { restoreFails: 'throw' as const } : {}),
          });
          const base = clone(session.getStack());
          const signal = {
            aborted: false,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
          };
          let calls = 0;
          const common = approve(p);
          const result = await runTransaction(session, p, {
            ...common,
            signal,
            checkpoints: {
              put: () => {
                if (point === 'checkpoint') return Promise.reject(new Error('disk'));
                if (point === 'stale') {
                  const edited = clone(session.getStack());
                  edited.title = 'edited';
                  session.forceStack(edited);
                }
                return Promise.resolve();
              },
            },
            onProgress: (e) => {
              if (point === 'cancel' && e.phase === 'step' && e.stepIndex === (n % p.steps.length) + 1) {
                signal.aborted = true;
              }
            },
            inject: {
              applyCommand: (stack, command, now) => {
                if (point === 'step' && calls++ === n % p.steps.length) {
                  return { ok: false, error: { code: 'INVALID_PATCH_COMMAND', message: 'injected' } };
                }
                return realApply(stack, command, now);
              },
              validateStack: (value) =>
                point === 'validate'
                  ? { ok: false, error: { code: 'PROJECT_VALIDATION_FAILED', message: 'injected' } }
                  : validateStack(value),
            },
          });
          const cancelled = result.ok && result.value.state === 'cancelled';
          expect(!result.ok || cancelled).toBe(true);
          const expected = point === 'stale' ? { ...base, title: 'edited' } : base;
          expect(session.getStack()).toEqual(expected);
          expect(session.dispatchCalls).toBe(0);
        },
      ),
      { numRuns: 80 },
    );
  });

  it('commit then revert equals the base Stack', async () => {
    await fc.assert(
      fc.asyncProperty(validPlan, async (p) => {
        const session = createMemorySession(baseStack());
        const base = clone(session.getStack());
        const r = await runTransaction(session, p, approve(p));
        if (!r.ok || r.value.state !== 'done') throw new Error('expected done');
        expect(validateStack(session.getStack()).ok).toBe(true);
        expect(revertOperation(session, r.value.report).ok).toBe(true);
        expect(session.getStack()).toEqual(base);
      }),
      { numRuns: 80 },
    );
  });

  it('commit then one undo equals the base Stack', async () => {
    await fc.assert(
      fc.asyncProperty(validPlan, async (p) => {
        const session = createMemorySession(baseStack());
        const base = clone(session.getStack());
        await runTransaction(session, p, approve(p));
        expect(session.undo()).toBe(true);
        expect(session.getStack()).toEqual(base);
      }),
      { numRuns: 60 },
    );
  });

  it('buildContext stays within budget and never holds a data URL', () => {
    fc.assert(
      fc.property(validPlan, fc.integer({ min: 5_000, max: 30_000 }), (p, budget) => {
        const dry = dryRunPlan(baseStack(), p, NOW);
        if (!dry.ok || dry.value.status !== 'ok') throw new Error('expected ok');
        const stack: Stack = dry.value.stack;
        stack.title = `Title ${'data:image/png;base64,QUJD'}`;
        for (const scope of [{ kind: 'stack' }, { kind: 'card', cardId: 'c1' }] as const) {
          const r = buildContext(stack, scope, { budget });
          expect(r.ok).toBe(true);
          if (!r.ok) return;
          const text = JSON.stringify(r.value);
          expect(text.length).toBeLessThanOrEqual(budget);
          expect(text).not.toMatch(/data:[^"]*,/i);
          expect(r.value.charCount).toBe(text.length);
        }
      }),
      RUNS,
    );
  });

  it('buildContext is deterministic', () => {
    fc.assert(
      fc.property(validPlan, fc.integer({ min: 4_000, max: 9_000 }), (p, budget) => {
        const dry = dryRunPlan(baseStack(), p, NOW);
        if (!dry.ok || dry.value.status !== 'ok') throw new Error('expected ok');
        const a = buildContext(dry.value.stack, { kind: 'stack' }, { budget });
        const b = buildContext(clone(dry.value.stack), { kind: 'stack' }, { budget });
        expect(a).toEqual(b);
      }),
      RUNS,
    );
  });
});
