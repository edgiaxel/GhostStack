import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { BINARY_OPS, BehaviorSchema } from '@ghoststack/shared-contracts';
import type { ActionNode, Behavior, Expr } from '@ghoststack/shared-contracts';
import { parseGhostScript, printGhostScript } from './index';

const keyArb = fc.oneof(
  fc.constantFrom('score', 'lives', 'go', 'name_1', 'a b', 'x.y', 'if', 'Zed'),
  fc.string({ minLength: 1, maxLength: 6 }),
);
const textArb = fc.string({ maxLength: 8 });
const litArb: fc.Arbitrary<Expr> = fc.oneof(
  fc.integer({ min: -50, max: 50 }).map((value): Expr => ({ kind: 'literal', value })),
  fc
    .double({ noNaN: true, noDefaultInfinity: true })
    .map((value): Expr => ({ kind: 'literal', value: value === 0 ? 0 : value })),
  textArb.map((value): Expr => ({ kind: 'literal', value })),
  fc.boolean().map((value): Expr => ({ kind: 'literal', value })),
);
const exprArb: fc.Arbitrary<Expr> = fc.letrec<{ e: Expr }>((tie) => ({
  e: fc.oneof(
    { depthSize: 'small', maxDepth: 3 },
    litArb,
    keyArb.map((key): Expr => ({ kind: 'state', key })),
    tie('e').map((arg): Expr => ({ kind: 'not', arg })),
    fc
      .tuple(fc.constantFrom(...BINARY_OPS), tie('e'), tie('e'))
      .map(([op, left, right]): Expr => ({ kind: 'binary', op, left, right })),
  ),
})).e;

const idArb = fc.string({ minLength: 1, maxLength: 6 });
const actionArb: fc.Arbitrary<ActionNode> = fc.letrec<{ a: ActionNode }>((tie) => ({
  a: fc.oneof(
    { depthSize: 'small', maxDepth: 2 },
    idArb.map((cardId): ActionNode => ({ type: 'navigate', cardId })),
    fc.tuple(keyArb, exprArb).map(([key, value]): ActionNode => ({ type: 'setState', key, value })),
    fc.tuple(idArb, exprArb).map(([elementId, value]): ActionNode => ({ type: 'setText', elementId, value })),
    idArb.map((elementId): ActionNode => ({ type: 'show', elementId })),
    idArb.map((elementId): ActionNode => ({ type: 'hide', elementId })),
    fc
      .tuple(exprArb, fc.array(tie('a'), { maxLength: 2 }), fc.array(tie('a'), { maxLength: 2 }))
      .map(([condition, then, els]): ActionNode => ({ type: 'if', condition, then, else: els })),
  ),
})).a;

const behaviorArb: fc.Arbitrary<Behavior> = fc.record({
  behaviorId: idArb,
  trigger: fc.constantFrom('card.enter', 'element.click', 'element.change'),
  conditions: fc.array(exprArb, { maxLength: 2 }),
  actions: fc.array(actionArb, { maxLength: 3 }),
  enabled: fc.boolean(),
});

describe('GhostScript', () => {
  it('round-trips any valid AST: parse(print(x)) equals x', () => {
    fc.assert(
      fc.property(fc.array(behaviorArb, { maxLength: 3 }), (behaviors) => {
        expect(BehaviorSchema.array().safeParse(behaviors).success).toBe(true);
        const text = printGhostScript(behaviors);
        const parsed = parseGhostScript(text);
        expect(parsed).toEqual({ ok: true, behaviors });
        expect(printGhostScript(behaviors)).toBe(text);
      }),
      { numRuns: 300 },
    );
  });

  it('parses a readable script', () => {
    const src = `
      // quiz
      behavior "check" on element.click {
        when score >= 3 and not done
        set done = true
        if score >= 3 {
          go "card-2"
        } else {
          text "label" = "Try " + "again"
          hide "button"
        }
      }
    `;
    const r = parseGhostScript(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.behaviors[0]?.conditions).toHaveLength(1);
    expect(r.behaviors[0]?.actions.map((a) => a.type)).toEqual(['setState', 'if']);
    expect(printGhostScript(r.behaviors)).toContain('when score >= 3 and not done');
  });

  it('honors operator precedence and left associativity', () => {
    const r = parseGhostScript('behavior "b" on card.enter {\n set x = 1 + 2 * 3 - 4 - 5\n}');
    if (!r.ok) throw new Error('parse');
    const a = r.behaviors[0]?.actions[0];
    expect(printGhostScript(r.behaviors)).toContain('set x = 1 + 2 * 3 - 4 - 5');
    expect(a).toMatchObject({ value: { kind: 'binary', op: '-', right: { kind: 'literal', value: 5 } } });
  });

  it.each([
    ['', true],
    ['behavior "a" on nope {}', false],
    ['behavior a on card.enter {}', false],
    ['behavior "a" on card.enter { fly "x" }', false],
    ['behavior "a" on card.enter { set x = }', false],
    ['behavior "a" on card.enter { set x = 1', false],
    ['behavior "a" on card.enter { set x = foo(1) }', false],
    ['behavior "a" on card.enter { text "e" = "bad \\q" }', false],
    ['behavior "a" on card.enter { set x = 1 # }', false],
  ])('classifies %j', (src, ok) => {
    expect(parseGhostScript(src).ok).toBe(ok);
  });

  it('reports line and column of the first error', () => {
    const r = parseGhostScript('behavior "a" on card.enter {\n  go\n}');
    expect(r).toMatchObject({ ok: false, issues: [{ line: 3, column: 1 }] });
  });

  it('never throws on arbitrary input', () => {
    fc.assert(fc.property(fc.string({ maxLength: 80 }), (s) => typeof parseGhostScript(s).ok === 'boolean'));
  });
});
