import {
  approvePlan,
  buildProjectContext,
  createMemoryCheckpointStore,
  createTransactionManager,
  requestPlan,
} from '@ghoststack/ai-core';
import type { AIIssue } from '@ghoststack/ai-core';
import { createMemoryStorage } from '@ghoststack/storage';
import { buildFixtureBundle } from '@ghoststack/domain/testing';
import { describe, expect, it } from 'vitest';
import { isRecord } from './http';
import { createOpenAICompatibleAdapter } from './openaiCompatible';

/**
 * Opt-in live run (T-029). Runs only with GHOSTSTACK_LIVE=1 and OPENROUTER_API_KEY set, because it
 * spends free-tier quota. The key is read from the environment and is never printed.
 */
const KEY = process.env['OPENROUTER_API_KEY'] ?? '';
const LIVE = process.env['GHOSTSTACK_LIVE'] === '1' && KEY !== '';
const BASE = 'https://openrouter.ai/api/v1';
const MAX_COMPLETIONS = 15;
const MIN_REMAINING_QUOTA = 5;

const PROMPTS = [
  'Add a welcome card with a title text element.',
  'Add a quiz question card with a question text, two answer buttons, and a number state called score.',
  'Add two cards named Results and Summary, each with one text element.',
];

interface Candidate {
  readonly id: string;
  readonly contextLength: number;
  readonly mode: 'json-schema' | 'json-mode' | 'none';
}

const auth = { authorization: `Bearer ${KEY}` };

async function quota(): Promise<{ used: number; limit: number; remaining: number } | undefined> {
  const response = await fetch(`${BASE}/key`, { headers: auth });
  if (!response.ok) return undefined;
  const body: unknown = await response.json();
  const data = isRecord(body) ? body['data'] : undefined;
  const free = isRecord(data) ? data['free_model_daily_requests'] : undefined;
  if (!isRecord(free)) return undefined;
  const { used, limit, remaining } = free;
  return typeof used === 'number' && typeof limit === 'number' && typeof remaining === 'number'
    ? { used, limit, remaining }
    : undefined;
}

async function pickModel(): Promise<{ candidates: Candidate[]; chosen: Candidate | undefined }> {
  const response = await fetch(`${BASE}/models`, { headers: auth });
  const body: unknown = await response.json();
  const list = isRecord(body) && Array.isArray(body['data']) ? (body['data'] as unknown[]) : [];
  const candidates: Candidate[] = [];
  for (const model of list) {
    if (!isRecord(model) || typeof model['id'] !== 'string') continue;
    const id = model['id'];
    if (!id.endsWith(':free') || !id.toLowerCase().includes('nemotron')) continue;
    const params = Array.isArray(model['supported_parameters'])
      ? (model['supported_parameters'] as unknown[])
      : [];
    const mode = params.includes('structured_outputs')
      ? 'json-schema'
      : params.includes('response_format')
        ? 'json-mode'
        : 'none';
    const contextLength = typeof model['context_length'] === 'number' ? model['context_length'] : 0;
    candidates.push({ id, contextLength, mode });
  }
  const rank = { 'json-schema': 2, 'json-mode': 1, none: 0 } as const;
  candidates.sort(
    (a, b) =>
      rank[b.mode] - rank[a.mode] || b.contextLength - a.contextLength || a.id.localeCompare(b.id),
  );
  return { candidates, chosen: candidates[0] };
}

describe.skipIf(!LIVE)('live OpenRouter (free Nemotron)', () => {
  it('generates, validates and executes plans within the request budget', async () => {
    const lines: string[] = [];
    const log = (line: string) => lines.push(line);

    const before = await quota();
    log(`quota before: ${before ? JSON.stringify(before) : 'unavailable'}`);
    if (before !== undefined && before.remaining < MIN_REMAINING_QUOTA) {
      log(`stopping: fewer than ${MIN_REMAINING_QUOTA} free requests remain today`);
      console.info(lines.join('\n'));
      return;
    }

    const { candidates, chosen } = await pickModel();
    log(
      `nemotron free candidates: ${candidates.map((c) => `${c.id} [${c.mode}]`).join(', ') || 'none'}`,
    );
    if (chosen === undefined) {
      console.info(lines.join('\n'));
      throw new Error('No free Nemotron model is listed. See the output for the candidate list.');
    }
    log(`chosen: ${chosen.id} (structured output: ${chosen.mode})`);

    let completions = 0;
    const countingFetch: typeof fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.endsWith('/chat/completions')) {
        completions += 1;
        if (completions > MAX_COMPLETIONS) return Promise.reject(new Error('request budget'));
      }
      return fetch(input, init);
    };
    const adapter = createOpenAICompatibleAdapter({
      id: 'openrouter',
      baseUrl: BASE,
      model: chosen.id,
      apiKey: KEY,
      local: false,
      structuredOutput: chosen.mode,
      timeoutMs: 120_000,
      maxTokens: 4000,
      connectionPath: '/key',
      retry429: { max: 1, maxWaitMs: 65_000 },
      fetch: countingFetch,
    });

    const storage = createMemoryStorage();
    const original = buildFixtureBundle();
    await storage.saveProject(original);
    const manager = createTransactionManager({
      storage,
      checkpoints: createMemoryCheckpointStore(),
    });
    const context = buildProjectContext(original.stack);

    let valid = 0;
    let executedOk = 0;
    let stoppedOn: AIIssue['code'] | undefined;
    for (const [index, prompt] of PROMPTS.entries()) {
      const started = Date.now();
      const planned = await requestPlan(adapter, context, prompt, { allowRemote: true });
      const ms = Date.now() - started;
      if (!planned.ok) {
        log(`#${index + 1} ${ms}ms: no plan (${planned.error.code}) ${planned.error.message}`);
        if (planned.error.code === 'PROVIDER_RATE_LIMIT') {
          stoppedOn = planned.error.code;
          break;
        }
        continue;
      }
      valid += 1;
      const run = await manager.execute(
        original.stack.stackId,
        approvePlan(planned.value, () => new Date().toISOString()),
      );
      if (run.ok) {
        executedOk += 1;
        log(
          `#${index + 1} ${ms}ms: valid plan, ${planned.value.commands.length} commands, executed`,
        );
        await manager.rollback(run.value.operationId);
      } else {
        log(
          `#${index + 1} ${ms}ms: valid plan, ${planned.value.commands.length} commands, not executed (${run.error.code} at ${run.error.stage})`,
        );
      }
    }

    const restored = await storage.loadProject(original.stack.stackId);
    log(
      `project restored after each run: ${restored.ok && JSON.stringify(restored.value) === JSON.stringify(original)}`,
    );
    log(`completions sent: ${completions} (budget ${MAX_COMPLETIONS})`);
    log(`plans valid: ${valid}/${PROMPTS.length}, executed: ${executedOk}`);
    if (stoppedOn !== undefined) log(`stopped early: ${stoppedOn}`);
    log(`quota after: ${JSON.stringify(await quota())}`);

    console.info(['--- live OpenRouter run ---', ...lines].join('\n'));
    expect(completions).toBeLessThanOrEqual(MAX_COMPLETIONS);
    expect(JSON.stringify(lines)).not.toContain(KEY);
  }, 600_000);
});
