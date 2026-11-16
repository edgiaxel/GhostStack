import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createStack } from './factories';
import type { IdPrefix } from './ids';
import { MAX_TITLE_CODE_POINTS } from './schemas';

const arbBlank = fc.string({
  unit: fc.constantFrom(' ', '\t', '\n', '\r', '\u00a0', '\u2003', '\u3000', '\ufeff'),
  maxLength: 20,
});

const arbTooLongCore = fc
  .tuple(
    fc.constantFrom('a', '😀', '𝒳', 'é'),
    fc.integer({ min: MAX_TITLE_CODE_POINTS + 1, max: MAX_TITLE_CODE_POINTS + 50 }),
  )
  .map(([unit, count]) => unit.repeat(count));

// Padding keeps the trimmed value long, so only the trimmed length is under test.
const arbTooLong = fc
  .tuple(arbBlank, arbTooLongCore, arbBlank)
  .map(([lead, core, trail]) => lead + core + trail);

function spies() {
  const calls = { clock: 0, newId: 0 };
  return {
    calls,
    deps: {
      clock: () => {
        calls.clock += 1;
        return '2026-01-01T00:00:00.000Z';
      },
      newId: (prefix: IdPrefix) => {
        calls.newId += 1;
        return `${prefix}_00000000-0000-4000-8000-000000000001`;
      },
    },
  };
}

describe('createStack invalid titles', () => {
  it('rejects empty or whitespace-only titles with reason "empty" and no Stack', () => {
    // Feature: m1-foundation, Property 2: Invalid titles are rejected
    // **Validates: Requirements 3.6, 12.3**
    fc.assert(
      fc.property(arbBlank, (title) => {
        const { calls, deps } = spies();
        const result = createStack(title, deps);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('INVALID_TITLE');
        expect(result.error.reason).toBe('empty');
        expect(result).not.toHaveProperty('value');
        expect(calls).toEqual({ clock: 0, newId: 0 });
      }),
      { numRuns: 100 },
    );
  });

  it('rejects titles over 100 code points after trimming with reason "too-long" and no Stack', () => {
    // Feature: m1-foundation, Property 2: Invalid titles are rejected
    // **Validates: Requirements 3.6, 12.3**
    fc.assert(
      fc.property(arbTooLong, (title) => {
        expect(Array.from(title.trim()).length).toBeGreaterThan(MAX_TITLE_CODE_POINTS);
        const { calls, deps } = spies();
        const result = createStack(title, deps);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('INVALID_TITLE');
        expect(result.error.reason).toBe('too-long');
        expect(result).not.toHaveProperty('value');
        expect(calls).toEqual({ clock: 0, newId: 0 });
      }),
      { numRuns: 100 },
    );
  });
});
