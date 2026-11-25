import { describe, expect, it } from 'vitest';
import { createStack, validateStack } from './index';

const now = '2026-11-25T00:00:00.000Z';

describe('createStack', () => {
  it('produces a valid Stack with one entry card', () => {
    const stack = createStack({ stackId: 's1', cardId: 'c1', title: 'Demo', now });
    const r = validateStack(stack);
    expect(r.ok).toBe(true);
    expect(stack.cardOrder).toEqual(['c1']);
  });

  it('rejects a dangling entryCardId', () => {
    const stack = createStack({ stackId: 's1', cardId: 'c1', title: 'Demo', now });
    expect(validateStack({ ...stack, entryCardId: 'nope' }).ok).toBe(false);
  });
});
