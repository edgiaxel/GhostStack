import { describe, expect, it } from 'vitest';
import { AI_ALLOWED_COMMAND_TYPES, AIPlanSchema, MAX_PLAN_STEPS } from './ai';

const step = (id: string, command: unknown) => ({ id, rationale: 'r', command });
const plan = (steps: unknown[]) => ({ schemaVersion: 1, summary: 's', affectedCardIds: [], steps });

describe('AIPlanSchema', () => {
  it('accepts an allowed command', () => {
    const r = AIPlanSchema.safeParse(plan([step('a', { type: 'ADD_CARD', cardId: 'c2', title: 'Two' })]));
    expect(r.success).toBe(true);
  });

  it.each(['REGISTER_ASSET', 'REPLACE_ASSET', 'REMOVE_ASSET', 'SET_VIEWPORT', 'RENAME_STACK'])(
    'rejects %s',
    (type) => {
      expect(AIPlanSchema.safeParse(plan([step('a', { type, title: 'x' })])).success).toBe(false);
      expect((AI_ALLOWED_COMMAND_TYPES as readonly string[]).includes(type)).toBe(false);
    },
  );

  it('rejects unknown keys, empty plans and oversize step counts', () => {
    expect(
      AIPlanSchema.safeParse(plan([step('a', { type: 'ADD_CARD', cardId: 'c', title: 't', code: 'x' })]))
        .success,
    ).toBe(false);
    expect(AIPlanSchema.safeParse(plan([])).success).toBe(false);
    const many = Array.from({ length: MAX_PLAN_STEPS + 1 }, (_, i) =>
      step(`s${i}`, { type: 'DELETE_CARD', cardId: 'c' }),
    );
    expect(AIPlanSchema.safeParse(plan(many)).success).toBe(false);
  });
});
