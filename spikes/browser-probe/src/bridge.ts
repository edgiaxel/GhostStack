import {
  approvePlan,
  createRepositoryCheckpointStore,
  createTransactionManager,
  parseAIPlan,
} from '@ghoststack/ai-core';
import { buildFixtureBundle } from '@ghoststack/domain/testing';
import { createIndexedDbBackend } from '@ghoststack/storage/indexeddb';
import type { CheckResult } from './checks';

const BRIDGE = 'http://127.0.0.1:17878';
const DB = 'ghoststack-probe-bridge';
const NOW = () => new Date().toISOString();

/** The editor token lives only in this variable, like the provider key. */
let editorToken = '';
export const setEditorToken = (value: string): void => {
  editorToken = value;
};

export function adoptSeededEditorToken(): boolean {
  const seeded = localStorage.getItem('probe.editorToken');
  if (seeded === null || seeded === '') return false;
  editorToken = seeded;
  localStorage.removeItem('probe.editorToken');
  return true;
}

const failure = (error: unknown): string =>
  error instanceof Error ? `${error.name}: request blocked or failed` : 'request failed';

const backend = () => createIndexedDbBackend({ databaseName: DB });

function managerFor(b: ReturnType<typeof backend>) {
  return createTransactionManager({
    storage: b.storage,
    checkpoints: createRepositoryCheckpointStore(b.checkpoints),
  });
}

async function editorFetch(
  path: string,
  init: RequestInit,
  token = editorToken,
): Promise<Response> {
  return fetch(`${BRIDGE}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  });
}

/** Seeds the browser-side database once. IndexedDB, not the bridge, is the source of truth. */
async function ensureProject(b: ReturnType<typeof backend>): Promise<string> {
  const fixture = buildFixtureBundle();
  const existing = await b.storage.loadProject(fixture.stack.stackId);
  if (!existing.ok) await b.storage.saveProject(fixture);
  return fixture.stack.stackId;
}

async function publish(b: ReturnType<typeof backend>, stackId: string): Promise<Response> {
  const loaded = await b.storage.loadProject(stackId);
  if (!loaded.ok) throw new Error('project missing');
  return editorFetch('/editor/project', {
    method: 'PUT',
    body: JSON.stringify({ stack: loaded.value.stack }),
  });
}

/** Resets the browser database, then publishes the project to the bridge with a real CORS preflight. */
export async function bridgePublish(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  try {
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase(DB);
      request.onsuccess = request.onerror = request.onblocked = () => resolve();
    });
    const b = backend();
    const stackId = await ensureProject(b);
    const response = await publish(b, stackId);
    const body = (await response.json()) as { revision?: number };
    results.push({
      name: 'bridge: PUT /editor/project from the browser (preflight + token + origin)',
      ok: response.status === 200,
      detail: `HTTP ${response.status}, revision ${String(body.revision)}`,
    });
  } catch (error) {
    results.push({
      name: 'bridge: PUT /editor/project from the browser',
      ok: false,
      detail: failure(error),
    });
  }
  return results;
}

/** Negative checks: a wrong token must be a readable 401, not an opaque network error. */
export async function bridgeNegative(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  try {
    const wrong = await editorFetch('/editor/proposals', { method: 'GET' }, 'w'.repeat(48));
    results.push({
      name: 'bridge: wrong editor token is a readable 401',
      ok: wrong.status === 401,
      detail: `HTTP ${wrong.status}`,
    });
  } catch (error) {
    results.push({
      name: 'bridge: wrong editor token is a readable 401',
      ok: false,
      detail: failure(error),
    });
  }
  return results;
}

interface ProposalView {
  proposalId: string;
  status: string;
  source: string;
  plan: unknown;
  review: { commandCount: number; newCardCount: number };
}

export async function bridgeListProposals(): Promise<{
  results: CheckResult[];
  proposals: ProposalView[];
}> {
  try {
    const response = await editorFetch('/editor/proposals', { method: 'GET' });
    const body = (await response.json()) as { proposals?: ProposalView[] };
    const proposals = body.proposals ?? [];
    return {
      proposals,
      results: [
        {
          name: 'bridge: GET /editor/proposals',
          ok: response.status === 200,
          detail: `${proposals.length} proposal(s): ${proposals.map((p) => `${p.proposalId}=${p.status}`).join(', ')}`,
        },
      ],
    };
  } catch (error) {
    return {
      proposals: [],
      results: [{ name: 'bridge: GET /editor/proposals', ok: false, detail: failure(error) }],
    };
  }
}

async function decide(id: string, status: string, detail?: string): Promise<number> {
  const response = await editorFetch(`/editor/proposals/${id}/decision`, {
    method: 'POST',
    body: JSON.stringify({ status, ...(detail === undefined ? {} : { detail }) }),
  });
  return response.status;
}

/** The creator approves: the BROWSER runs the plan through its own transaction manager, then reports. */
export async function bridgeApprove(proposalId: string): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const b = backend();
  const stackId = await ensureProject(b);
  const manager = managerFor(b);
  const { proposals } = await bridgeListProposals();
  const proposal = proposals.find((p) => p.proposalId === proposalId && p.status === 'pending');
  if (proposal === undefined)
    return [{ name: 'bridge: approve', ok: false, detail: 'no such pending proposal' }];

  const parsed = parseAIPlan(proposal.plan);
  results.push({
    name: 'bridge: browser re-validates the proposed plan itself',
    ok: parsed.ok,
    detail: parsed.ok ? 'valid' : 'invalid',
  });
  if (!parsed.ok) {
    await decide(proposalId, 'rejected', 'plan failed local validation');
    return results;
  }
  results.push({
    name: 'bridge: decision "approved" accepted',
    ok: (await decide(proposalId, 'approved')) === 200,
    detail: 'approved',
  });
  const executed = await manager.execute(stackId, approvePlan(parsed.plan, NOW));
  if (!executed.ok) {
    await decide(proposalId, 'failed', executed.error.code);
    results.push({
      name: 'bridge: plan executed in the browser',
      ok: false,
      detail: executed.error.code,
    });
    return results;
  }
  const loaded = await b.storage.loadProject(stackId);
  results.push({
    name: 'bridge: plan executed in the browser (IndexedDB is the source of truth)',
    ok: loaded.ok,
    detail: loaded.ok
      ? `${loaded.value.stack.cardOrder.length} cards, operation ${executed.value.operationId}`
      : 'load failed',
  });
  const republished = await publish(b, stackId);
  results.push({
    name: 'bridge: new project state republished to the bridge',
    ok: republished.status === 200,
    detail: `HTTP ${republished.status}`,
  });
  results.push({
    name: 'bridge: decision "applied" accepted',
    ok: (await decide(proposalId, 'applied', executed.value.operationId)) === 200,
    detail: 'applied',
  });
  return results;
}

/** Whole-operation rollback from the durable checkpoint, then republish. */
export async function bridgeRollback(operationId: string): Promise<CheckResult[]> {
  const b = backend();
  const stackId = await ensureProject(b);
  const rolled = await managerFor(b).rollback(operationId);
  const loaded = await b.storage.loadProject(stackId);
  const republished = rolled.ok ? await publish(b, stackId) : undefined;
  return [
    {
      name: 'bridge: rollback restores the pre-operation project',
      ok: rolled.ok,
      detail: rolled.ok
        ? `${loaded.ok ? loaded.value.stack.cardOrder.length : '?'} cards`
        : rolled.error.code,
    },
    {
      name: 'bridge: restored state republished',
      ok: republished?.status === 200,
      detail: `HTTP ${republished?.status ?? 'n/a'}`,
    },
  ];
}
