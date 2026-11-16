import { describe, expect, it } from 'vitest';
import { INITIAL_ROUTE, routeReducer } from './route';

describe('routeReducer', () => {
  it('starts on the library', () => {
    expect(INITIAL_ROUTE).toEqual({ name: 'library' });
  });

  it('opens a workspace for the given stack', () => {
    expect(routeReducer({ name: 'library' }, { type: 'open', stackId: 'stk_a' })).toEqual({
      name: 'workspace',
      stackId: 'stk_a',
    });
  });

  it('switches workspace when opening another stack', () => {
    const state = { name: 'workspace', stackId: 'stk_a' } as const;
    expect(routeReducer(state, { type: 'open', stackId: 'stk_b' })).toEqual({
      name: 'workspace',
      stackId: 'stk_b',
    });
  });

  it('closes the workspace back to the library', () => {
    expect(routeReducer({ name: 'workspace', stackId: 'stk_a' }, { type: 'close' })).toEqual({
      name: 'library',
    });
  });

  it('keeps the same library state object when closing from the library', () => {
    const state = { name: 'library' } as const;
    expect(routeReducer(state, { type: 'close' })).toBe(state);
  });
});
