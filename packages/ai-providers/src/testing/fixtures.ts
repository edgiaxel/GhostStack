import type { ProjectContext } from '@ghoststack/shared-contracts';

/** The sentinel used to prove that no key leaks into any output. */
export const SENTINEL_KEY = 'sk-test-SENTINEL-0123456789abcdef';

export function makeContext(overrides: Partial<ProjectContext> = {}): ProjectContext {
  return {
    schemaVersion: 1,
    scope: { kind: 'stack' },
    stack: {
      title: 'Sample',
      entryCardId: 'home',
      cardOrder: ['home'],
      stateSchema: { score: { type: 'number', initial: 0 } },
      viewport: { width: 1280, height: 720 },
    },
    cards: [{ cardId: 'home', title: 'Home', elementCount: 1, navigatesTo: [] }],
    detail: [{ cardId: 'home', title: 'Home', elements: [{ elementId: 'welcome', type: 'text' }] }],
    registeredActions: [{ type: 'navigate', description: 'Go to a Card' }],
    truncated: false,
    charCount: 200,
    ...overrides,
  };
}
