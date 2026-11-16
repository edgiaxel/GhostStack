import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ISO_TIMESTAMP } from './clock';
import { createStack } from './factories';
import type { IdPrefix } from './ids';
import { MAX_TITLE_CODE_POINTS } from './schemas';
import { validateProject } from './validation/validateProject';

const codePoints = (text: string): number => Array.from(text).length;

const arbPadding = fc.string({
  unit: fc.constantFrom(' ', '\t', '\n', '\u00a0', '\u2003'),
  maxLength: 4,
});

const arbTitle = fc
  .tuple(
    arbPadding,
    fc.string({ unit: 'binary', minLength: 1, maxLength: MAX_TITLE_CODE_POINTS }),
    arbPadding,
  )
  .map(([lead, core, trail]) => lead + core + trail)
  .filter((raw) => {
    const length = codePoints(raw.trim());
    return length >= 1 && length <= MAX_TITLE_CODE_POINTS;
  });

const arbClockValue = fc
  .date({
    min: new Date('1970-01-01T00:00:00.000Z'),
    max: new Date('2999-12-31T23:59:59.999Z'),
    noInvalidDate: true,
  })
  .map((date) => date.toISOString());

const arbUuids = fc.array(fc.uuid({ version: 4 }), { minLength: 2, maxLength: 2 });

/** Each call gets a fresh generator so two calls with the same inputs see the same ids. */
function depsFrom(clockValue: string, uuids: readonly string[]) {
  let next = 0;
  return {
    clock: () => clockValue,
    newId: (prefix: IdPrefix) => `${prefix}_${uuids[next++] ?? ''}`,
  };
}

describe('createStack properties', () => {
  it('produces a valid, serializable, deterministic Stack for any valid title', () => {
    // Feature: m1-foundation, Property 1: Factory output is a valid, serializable, deterministic Stack
    // **Validates: Requirements 3.5, 3.8, 3.9, 4.17**
    fc.assert(
      fc.property(arbTitle, arbClockValue, arbUuids, (title, clockValue, uuids) => {
        const result = createStack(title, depsFrom(clockValue, uuids));
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const stack = result.value;

        expect(clockValue).toMatch(ISO_TIMESTAMP);
        expect(stack.title).toBe(title.trim());
        expect(stack.createdAt).toBe(clockValue);
        expect(stack.updatedAt).toBe(clockValue);
        expect(Object.keys(stack.cards)).toHaveLength(1);
        expect(stack.cards[stack.entryCardId]).toBeDefined();
        expect(stack.cardOrder).toEqual([stack.entryCardId]);

        expect(validateProject(stack).errors).toEqual([]);
        expect(JSON.parse(JSON.stringify(stack))).toEqual(stack);

        const again = createStack(title, depsFrom(clockValue, uuids));
        expect(again).toEqual(result);
      }),
      { numRuns: 100 },
    );
  });

  it('accepts titles at the 1 and 100 code-point boundaries', () => {
    for (const title of ['a', '😀'.repeat(MAX_TITLE_CODE_POINTS)]) {
      const result = createStack(
        title,
        depsFrom('2026-01-01T00:00:00.000Z', [
          '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000002',
        ]),
      );
      expect(result.ok).toBe(true);
    }
  });
});
