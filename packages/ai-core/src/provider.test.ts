import { buildFixtureBundle } from '@ghoststack/domain/testing';
import { err } from '@ghoststack/domain';
import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';
import { createDemoAdapter } from './demo';
import {
  MAX_PROVIDER_TEXT_CHARS,
  buildProjectContext,
  parsePlanText,
  requestPlan,
} from './provider';
import type { AIProviderAdapter } from './provider';

const validPlan = {
  planVersion: 1,
  planId: 'p',
  requestSummary: 's',
  commands: [{ command: 'ADD_CARD', title: 'A' }],
};

describe('parsePlanText', () => {
  it('accepts plain JSON and a fenced JSON block', () => {
    expect(parsePlanText(JSON.stringify(validPlan)).ok).toBe(true);
    expect(parsePlanText('```json\n' + JSON.stringify(validPlan) + '\n```').ok).toBe(true);
    expect(parsePlanText('```\n' + JSON.stringify(validPlan) + '\n```').ok).toBe(true);
  });

  it.each([
    ['empty text', ''],
    ['prose', 'Sure! Here is your plan.'],
    ['truncated JSON', '{"planVersion":1,"planId":"p"'],
    ['JSON with prose around it', 'Here: ' + JSON.stringify(validPlan)],
    ['wrong shape', '{"hello":"world"}'],
    ['an array', '[1,2,3]'],
    ['null', 'null'],
  ])('rejects %s with INVALID_AI_PLAN', (_name, text) => {
    const result = parsePlanText(text);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_AI_PLAN');
  });

  it('rejects oversized text without parsing it', () => {
    const spy = vi.spyOn(JSON, 'parse');
    const result = parsePlanText('x'.repeat(MAX_PROVIDER_TEXT_CHARS + 1));
    expect(result.ok).toBe(false);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('is total for arbitrary strings', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 500 }), (text) => {
        expect(typeof parsePlanText(text).ok).toBe('boolean');
      }),
      { numRuns: 300 },
    );
  });
});

describe('buildProjectContext', () => {
  it('shares titles and counts only, never element text or asset data', () => {
    const { stack } = buildFixtureBundle();
    const context = buildProjectContext(stack);
    const serialized = JSON.stringify(context);
    expect(context.cards).toHaveLength(stack.cardOrder.length);
    for (const asset of Object.values(stack.assetRegistry)) {
      expect(serialized).not.toContain(asset.checksum);
      expect(serialized).not.toContain(asset.relativePath);
    }
    expect(Object.keys(context).sort()).toEqual(['cards', 'stackId', 'stateKeys', 'title']);
  });
});

describe('requestPlan privacy', () => {
  const remote = (generate: () => void): AIProviderAdapter => ({
    id: 'remote',
    capabilities: { structuredOutput: 'json-schema', local: false, requiresCredential: true },
    testConnection: () =>
      Promise.resolve(err({ code: 'PROVIDER_UNAVAILABLE', message: 'unused', path: [] })),
    generatePlan: () => {
      generate();
      return Promise.resolve(err({ code: 'PROVIDER_UNAVAILABLE', message: 'unused', path: [] }));
    },
  });
  const context = buildProjectContext(buildFixtureBundle().stack);

  it('does not call a remote provider without explicit permission', async () => {
    const generate = vi.fn();
    const result = await requestPlan(remote(generate), context, 'go', { allowRemote: false });
    expect(!result.ok && result.error.code).toBe('REMOTE_PROVIDER_NOT_ALLOWED');
    expect(generate).not.toHaveBeenCalled();
  });

  it('calls a local provider without remote permission', async () => {
    const result = await requestPlan(createDemoAdapter(), context, 'go', { allowRemote: false });
    expect(result.ok).toBe(true);
  });

  it('calls a remote provider once permission is given', async () => {
    const generate = vi.fn();
    await requestPlan(remote(generate), context, 'go', { allowRemote: true });
    expect(generate).toHaveBeenCalledTimes(1);
  });
});

describe('demo adapter', () => {
  it('is deterministic and adapts to the context', async () => {
    const context = buildProjectContext(buildFixtureBundle().stack);
    const a = await createDemoAdapter().generatePlan(context, 'one');
    const b = await createDemoAdapter().generatePlan(context, 'something else entirely');
    expect(a).toEqual(b);
    expect(a.ok && a.value.planId).toBe(`demo-plan-${context.cards.length + 1}`);
    const withScore = await createDemoAdapter().generatePlan(
      { ...context, stateKeys: ['score'] },
      'x',
    );
    expect(
      withScore.ok && withScore.value.commands.some((c) => c.command === 'UPDATE_STATE_SCHEMA'),
    ).toBe(false);
  });

  it('reports a working connection without a network', async () => {
    const result = await createDemoAdapter().testConnection();
    expect(result.ok && result.value.model).toBe('demo-deterministic');
  });
});
