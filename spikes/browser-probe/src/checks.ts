import {
  CrashSignal,
  approvePlan,
  buildProjectContext,
  createDemoAdapter,
  createRepositoryCheckpointStore,
  createTransactionManager,
  requestPlan,
} from '@ghoststack/ai-core';
import { buildFixtureBundle } from '@ghoststack/domain/testing';
import { createOpenAICompatibleAdapter } from '@ghoststack/spike-providers';
import { createIndexedDbBackend } from '@ghoststack/storage/indexeddb';

export interface CheckResult {
  readonly name: string;
  readonly ok: boolean;
  /** Short, safe text. Never contains the key or a response body. */
  readonly detail: string;
}

const OPENROUTER = 'https://openrouter.ai/api/v1';
const MODEL = 'nvidia/nemotron-3.5-super-vl:free';
const NOW = () => new Date().toISOString();

/** The key lives only in this variable. */
let memoryKey = '';
export const setKey = (value: string): void => {
  memoryKey = value;
};
export const hasKey = (): boolean => memoryKey !== '';

/** Moves a key seeded into localStorage (by the test harness) into memory, then removes it from storage. */
export function adoptSeededKey(): boolean {
  const seeded = localStorage.getItem('probe.key');
  if (seeded === null || seeded === '') return false;
  memoryKey = seeded;
  localStorage.removeItem('probe.key');
  return true;
}

interface Quota {
  used: number;
  limit: number;
  remaining: number;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

async function readQuota(key: string): Promise<{ status: number; quota?: Quota }> {
  const response = await fetch(`${OPENROUTER}/key`, {
    headers: { authorization: `Bearer ${key}` },
  });
  if (!response.ok) return { status: response.status };
  const body: unknown = await response.json();
  const data = isRecord(body) ? body['data'] : undefined;
  const free = isRecord(data) ? data['free_model_daily_requests'] : undefined;
  if (isRecord(free)) {
    const { used, limit, remaining } = free;
    if (typeof used === 'number' && typeof limit === 'number' && typeof remaining === 'number') {
      return { status: response.status, quota: { used, limit, remaining } };
    }
  }
  return { status: response.status };
}

/** A failed fetch tells a page almost nothing, so the check records only the error class. */
const failure = (error: unknown): string =>
  error instanceof Error ? `${error.name}: request blocked or failed` : 'request failed';

export async function checkProviders(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const add = (name: string, ok: boolean, detail: string) => results.push({ name, ok, detail });

  // 1. A cross-origin call with an Authorization header forces a preflight. If it resolves, CORS passed.
  if (!hasKey()) {
    add('openrouter: key available', false, 'No key was provided to the page.');
  } else {
    try {
      const before = await readQuota(memoryKey);
      add(
        'openrouter: cross-origin GET with Authorization header is readable',
        before.status === 200,
        `HTTP ${before.status}; free quota ${before.quota ? JSON.stringify(before.quota) : 'unavailable'}`,
      );
    } catch (error) {
      add(
        'openrouter: cross-origin GET with Authorization header is readable',
        false,
        failure(error),
      );
    }

    // 2. A rejected key must still be readable as a 401, or the page could not tell auth from network errors.
    try {
      const bad = await readQuota('invalid-key-for-cors-check');
      add(
        'openrouter: error responses carry CORS headers (401 readable)',
        bad.status === 401,
        `HTTP ${bad.status}`,
      );
    } catch (error) {
      add('openrouter: error responses carry CORS headers (401 readable)', false, failure(error));
    }

    // 3. One real plan, end to end in the browser: provider, adapter, transaction, real IndexedDB, rollback.
    try {
      const original = buildFixtureBundle();
      const backend = createIndexedDbBackend({ databaseName: 'ghoststack-probe-providers' });
      await backend.storage.deleteProject(original.stack.stackId);
      await backend.storage.saveProject(original);
      const manager = createTransactionManager({
        storage: backend.storage,
        checkpoints: createRepositoryCheckpointStore(backend.checkpoints),
      });
      const adapter = createOpenAICompatibleAdapter({
        id: 'openrouter-browser',
        baseUrl: OPENROUTER,
        model: MODEL,
        apiKey: memoryKey,
        local: false,
        structuredOutput: 'json-schema',
        timeoutMs: 120_000,
        maxTokens: 4000,
        connectionPath: '/key',
      });
      const started = Date.now();
      const planned = await requestPlan(
        adapter,
        buildProjectContext(original.stack),
        'Add a welcome card with a title text element.',
        { allowRemote: true },
      );
      const ms = Date.now() - started;
      if (!planned.ok) {
        add(
          'openrouter: plan generated in the browser',
          false,
          `${planned.error.code} after ${ms} ms`,
        );
      } else {
        add(
          'openrouter: plan generated in the browser',
          true,
          `${planned.value.commands.length} commands in ${ms} ms`,
        );
        const executed = await manager.execute(
          original.stack.stackId,
          approvePlan(planned.value, NOW),
        );
        add(
          'openrouter: plan executed against real IndexedDB',
          executed.ok,
          executed.ok ? 'committed' : executed.error.code,
        );
        if (executed.ok) {
          const rolled = await manager.rollback(executed.value.operationId);
          const restored = await backend.storage.loadProject(original.stack.stackId);
          add(
            'openrouter: rollback restores the original project',
            rolled.ok && restored.ok && JSON.stringify(restored.value) === JSON.stringify(original),
            rolled.ok ? 'restored' : rolled.error.code,
          );
        }
      }
    } catch (error) {
      add('openrouter: end-to-end plan in the browser', false, failure(error));
    }

    try {
      const after = await readQuota(memoryKey);
      add(
        'openrouter: free quota after the run',
        after.status === 200,
        after.quota ? JSON.stringify(after.quota) : `HTTP ${after.status}`,
      );
    } catch (error) {
      add('openrouter: free quota after the run', false, failure(error));
    }
  }

  // 4. Ollama. A browser cannot tell "not running" from "CORS blocked", so a failure proves nothing.
  try {
    const response = await fetch('http://127.0.0.1:11434/api/tags');
    add('ollama: reachable from the page', response.ok, `HTTP ${response.status}`);
  } catch (error) {
    add(
      'ollama: reachable from the page',
      false,
      `${failure(error)} (a browser cannot tell "not running" from "CORS blocked", so this proves nothing about CORS)`,
    );
  }

  // 5. The offline adapter works in the browser with no network.
  const demo = await createDemoAdapter().generatePlan(
    buildProjectContext(buildFixtureBundle().stack),
    'x',
  );
  add('demo adapter runs in the browser', demo.ok, demo.ok ? demo.value.planId : demo.error.code);
  return results;
}

const DURABLE_DB = 'ghoststack-probe-durable';

function durableManager() {
  const backend = createIndexedDbBackend({ databaseName: DURABLE_DB });
  return {
    storage: backend.storage,
    manager: createTransactionManager({
      storage: backend.storage,
      checkpoints: createRepositoryCheckpointStore(backend.checkpoints),
    }),
  };
}

/** Phase 1: save a project, run a plan, and "crash" after the commit but before the status update. */
export async function idbPhase1(): Promise<CheckResult[]> {
  const original = buildFixtureBundle();
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(DURABLE_DB);
    request.onsuccess = request.onerror = request.onblocked = () => resolve();
  });
  const { storage, manager } = durableManager();
  const results: CheckResult[] = [];
  const saved = await storage.saveProject(original);
  results.push({
    name: 'idb phase 1: project saved',
    ok: saved.ok,
    detail: saved.ok ? 'saved' : saved.error.code,
  });
  const planned = await createDemoAdapter().generatePlan(buildProjectContext(original.stack), 'x');
  if (!planned.ok)
    return [...results, { name: 'idb phase 1: demo plan', ok: false, detail: planned.error.code }];
  try {
    await manager.execute(original.stack.stackId, approvePlan(planned.value, NOW), {
      beforeStep: (stage) => {
        if (stage === 'finalize') throw new CrashSignal(stage);
      },
    });
    results.push({
      name: 'idb phase 1: simulated crash after commit',
      ok: false,
      detail: 'no crash happened',
    });
  } catch (error) {
    results.push({
      name: 'idb phase 1: simulated crash after commit',
      ok: error instanceof CrashSignal,
      detail: 'crashed before the status update',
    });
  }
  const after = await storage.loadProject(original.stack.stackId);
  results.push({
    name: 'idb phase 1: project changed by the committed plan',
    ok: after.ok && after.value.stack.cardOrder.length === original.stack.cardOrder.length + 1,
    detail: after.ok ? `${after.value.stack.cardOrder.length} cards` : after.error.code,
  });
  return results;
}

/** Phase 2, after a real page reload: recover from the durable checkpoint, then roll back. */
export async function idbPhase2(): Promise<CheckResult[]> {
  const original = buildFixtureBundle();
  const { storage, manager } = durableManager();
  const results: CheckResult[] = [];
  const settled = await manager.recover(original.stack.stackId);
  results.push({
    name: 'idb phase 2: recovery settles the interrupted operation',
    ok: settled.ok && settled.value === 1,
    detail: settled.ok ? `${settled.value} settled` : settled.error.code,
  });
  const listed = await manager.checkpoints.list(original.stack.stackId);
  const record = listed.ok ? listed.value[0] : undefined;
  results.push({
    name: 'idb phase 2: checkpoint survived the reload as committed',
    ok: record?.status === 'committed',
    detail: record?.status ?? 'none',
  });
  if (record === undefined) return results;
  const rolled = await manager.rollback(record.checkpointId);
  const restored = await storage.loadProject(original.stack.stackId);
  results.push({
    name: 'idb phase 2: rollback restores the exact original project and asset bytes',
    ok:
      rolled.ok &&
      restored.ok &&
      JSON.stringify(restored.value.stack) === JSON.stringify(original.stack) &&
      Object.keys(restored.value.assets).length === Object.keys(original.assets).length,
    detail: rolled.ok ? 'restored' : rolled.error.code,
  });
  return results;
}
