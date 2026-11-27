import 'fake-indexeddb/auto';
import { createStack } from '@ghoststack/domain';
import { createIdbStorage } from '@ghoststack/storage';
import type { AIPlan, StackSession } from '@ghoststack/shared-contracts';
import { createStackSessionFactory } from '../../history/session';
import { createBridgeHandlers } from './handlers';
import type { BridgeHandlers } from './handlers';
import { dismissProposal, enqueueProposal, listProposals } from '../proposals';
/** Test helpers only: a real session over fake-indexeddb. Never imported by product code. */
let n = 0;
export async function openTestSession(title = 'Quiz'): Promise<{
  session: StackSession;
  checkpoints: ReturnType<typeof createIdbStorage>['checkpoints'];
  handlers: BridgeHandlers;
}> {
  const storage = createIdbStorage();
  const stackId = `bridge-${++n}`;
  await storage.stacks.save(
    createStack({ stackId, cardId: 'start', title, now: '2026-12-02T10:00:00.000Z' }),
  );
  const opened = await createStackSessionFactory({ ...storage, debounceMs: 20 }).open(stackId);
  if (!opened.ok) throw new Error(opened.error.message);
  const session = opened.value;
  const handlers = createBridgeHandlers({
    getSession: () => session,
    checkpoints: storage.checkpoints,
    enqueue: enqueueProposal,
    pendingCount: () => listProposals().length,
    now: () => new Date().toISOString(),
    newId: () => crypto.randomUUID(),
  });
  return { session, checkpoints: storage.checkpoints, handlers };
}
export function clearQueue(): void {
  for (const p of listProposals()) dismissProposal(p.id);
}
export const addCardPlan = (cardId = 'result', title = 'Result'): AIPlan => ({
  schemaVersion: 1,
  summary: `Add a card named ${title}`,
  affectedCardIds: [cardId],
  steps: [{ id: 's1', rationale: 'A result card.', command: { type: 'ADD_CARD', cardId, title } }],
});
