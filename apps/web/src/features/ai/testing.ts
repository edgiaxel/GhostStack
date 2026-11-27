import 'fake-indexeddb/auto';
import { createStack } from '@ghoststack/domain';
import { createIdbStorage } from '@ghoststack/storage';
import type {
  AIPlan,
  AIProviderAdapter,
  GhostError,
  PlanRequest,
  Result,
  StackSession,
} from '@ghoststack/shared-contracts';
import { createStackSessionFactory } from '../history/session';
/** Test support only. Product code never imports this file. */
let counter = 0;
export async function openRealSession(): Promise<{
  session: StackSession;
  checkpoints: ReturnType<typeof createIdbStorage>['checkpoints'];
}> {
  const storage = createIdbStorage();
  const stackId = `ai-test-${++counter}-${Math.random().toString(36).slice(2, 8)}`;
  await storage.stacks.save(
    createStack({ stackId, cardId: 'c1', title: 'AI test', now: '2026-12-01T00:00:00.000Z' }),
  );
  const opened = await createStackSessionFactory(storage).open(stackId);
  if (!opened.ok) throw new Error(opened.error.message);
  return { session: opened.value, checkpoints: storage.checkpoints };
}
export const addCardPlan = (cardId = 'ai-card', title = 'From AI'): AIPlan => ({
  schemaVersion: 1,
  summary: `Add the card ${title}.`,
  affectedCardIds: [cardId],
  steps: [
    {
      id: 's1',
      cardId,
      rationale: 'Add the card.',
      command: { type: 'ADD_CARD', cardId, title },
    },
  ],
});
/** Second step renames a card that does not exist, so the dry run fails at step s2. */
export const brokenPlan = (): AIPlan => ({
  schemaVersion: 1,
  summary: 'Add a card, then rename a missing one.',
  affectedCardIds: ['ai-card'],
  steps: [
    ...addCardPlan().steps,
    {
      id: 's2',
      rationale: 'Rename a card.',
      command: { type: 'RENAME_CARD', cardId: 'missing', title: 'Nope' },
    },
  ],
});
export interface ScriptedAdapter extends AIProviderAdapter {
  requests: PlanRequest[];
}
/** An adapter whose answer the test scripts. It stands in for a network provider in unit tests only. */
export function scriptedAdapter(
  answer: (request: PlanRequest) => Promise<Result<AIPlan, GhostError>> | Result<AIPlan, GhostError>,
  local = true,
): ScriptedAdapter {
  const requests: PlanRequest[] = [];
  return {
    id: 'scripted',
    label: 'Scripted',
    capabilities: { structuredOutput: false, jsonMode: false, streaming: false, local },
    requests,
    testConnection: async () => ({
      ok: true,
      value: { ok: true, detail: 'Connected, 1 model', models: ['m'] },
    }),
    generatePlan: async (request) => {
      requests.push(request);
      return answer(request);
    },
  };
}
