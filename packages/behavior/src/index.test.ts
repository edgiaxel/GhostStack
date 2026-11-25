import { describe, expect, it } from 'vitest';
import { createStack } from '@ghoststack/domain';
import { createRuntime } from './index';

describe('createRuntime skeleton', () => {
  it('initialises state from the schema and starts on the entry card', () => {
    const stack = {
      ...createStack({ stackId: 's', cardId: 'c1', title: 'S', now: '2026-11-26T00:00:00.000Z' }),
      stateSchema: { score: { type: 'number' as const, initial: 3 } },
    };
    const runtime = createRuntime(stack);
    expect(runtime.start()).toEqual({ cardId: 'c1', state: { score: 3 }, elements: {}, errors: [] });
  });
});
