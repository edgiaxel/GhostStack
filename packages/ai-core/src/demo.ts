import { ok } from '@ghoststack/domain';
import type { AIProviderAdapter } from './provider';
import { parsePlanText } from './provider';

/**
 * Deterministic offline adapter. It ignores the prompt text and builds one fixed kind of plan from
 * the context, so demos and tests are repeatable. It still goes through `parsePlanText`, the same
 * validation path real providers use.
 */
export function createDemoAdapter(): AIProviderAdapter {
  return {
    id: 'demo',
    capabilities: { structuredOutput: 'json-schema', local: true, requiresCredential: false },
    testConnection: () => Promise.resolve(ok({ model: 'demo-deterministic' })),
    generatePlan(context) {
      const next = context.cards.length + 1;
      const plan = {
        planVersion: 1,
        planId: `demo-plan-${next}`,
        requestSummary: `Add quiz question ${next} with an answer button and a score counter`,
        commands: [
          { command: 'ADD_CARD', ref: 'question', title: `Question ${next}` },
          {
            command: 'ADD_ELEMENT',
            ref: 'prompt',
            cardId: 'question',
            element: {
              type: 'text',
              name: 'Question text',
              layout: { x: 80, y: 60, width: 1120, height: 80 },
              properties: { text: `Question ${next}: what is the answer?` },
            },
          },
          {
            command: 'ADD_ELEMENT',
            cardId: 'question',
            element: {
              type: 'button',
              name: 'Answer button',
              layout: { x: 80, y: 200, width: 240, height: 56 },
              properties: { label: 'Answer' },
            },
          },
          ...(context.stateKeys.includes('score')
            ? []
            : [{ command: 'UPDATE_STATE_SCHEMA', set: { score: { type: 'number', initial: 0 } } }]),
        ],
      };
      return Promise.resolve(parsePlanText(JSON.stringify(plan)));
    },
  };
}
