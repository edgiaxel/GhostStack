import { describe, expect, it } from 'vitest';
import { validateStack } from '@ghoststack/domain';
import { dryRunPlan } from './dry-run';
import { NOW, baseStack, plan, quizPlan, recipePlan, step } from './testing';
import { clone } from './util';

describe('dryRunPlan', () => {
  it.each([
    ['quiz', quizPlan],
    ['recipe', recipePlan],
  ])('applies the %s fixture plan to a valid Stack', (_name, make) => {
    const stack = baseStack();
    const before = clone(stack);
    const r = dryRunPlan(stack, make(), NOW);
    expect(r.ok).toBe(true);
    if (!r.ok || r.value.status !== 'ok') throw new Error('expected ok');
    expect(validateStack(r.value.stack).ok).toBe(true);
    expect(r.value.steps).toHaveLength(make().steps.length);
    expect(stack).toEqual(before);
    expect(Object.keys(r.value.stack.cards).length).toBeGreaterThan(1);
  });

  it('is deterministic', () => {
    expect(dryRunPlan(baseStack(), quizPlan(), NOW)).toEqual(dryRunPlan(baseStack(), quizPlan(), NOW));
  });

  it('runs steps in dependency order', () => {
    const p = plan([
      step('el', { type: 'RENAME_CARD', cardId: 'n', title: 'Renamed' }, { dependsOn: ['add'] }),
      step('add', { type: 'ADD_CARD', cardId: 'n', title: 'New' }),
    ]);
    const r = dryRunPlan(baseStack(), p, NOW);
    expect(r.ok && r.value.status === 'ok' && r.value.steps.map((s) => s.stepId)).toEqual(['add', 'el']);
  });

  it('stops at a rejected command and names the step', () => {
    const p = plan([
      step('ok', { type: 'ADD_CARD', cardId: 'n', title: 'New' }),
      step('bad', { type: 'RENAME_CARD', cardId: 'missing', title: 'x' }),
      step('never', { type: 'ADD_CARD', cardId: 'm', title: 'M' }),
    ]);
    const stack = baseStack();
    const r = dryRunPlan(stack, p, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('INVALID_PATCH_COMMAND');
      expect(r.error.stepId).toBe('bad');
      expect(r.error.stepIndex).toBe(1);
      expect(r.error.message).toContain('bad');
    }
    expect(stack).toEqual(baseStack());
  });

  it('rejects a command with an unsafe id through the domain check', () => {
    const p = plan([step('s', { type: 'ADD_CARD', cardId: '../etc', title: 'x' })]);
    const r = dryRunPlan(baseStack(), p, NOW);
    expect(!r.ok && r.error.code).toBe('INVALID_PATCH_COMMAND');
  });

  it('does not register assets: an element pointing to an unknown asset fails', () => {
    const p = quizPlan();
    const withAsset = plan([
      step('img', {
        type: 'ADD_ELEMENT',
        cardId: 'c1',
        element: {
          elementId: 'pic',
          type: 'image',
          name: 'pic',
          properties: {},
          layout: { x: 0, y: 0, width: 10, height: 10, zIndex: 0 },
          assetId: 'not-registered',
          behaviors: [],
        },
      }),
    ]);
    const stack = baseStack();
    const r = dryRunPlan(stack, withAsset, NOW);
    expect(r.ok).toBe(false);
    expect(stack.assetRegistry).toEqual({});
    expect(p.steps.length).toBeGreaterThan(0);
  });

  it('re-checks the allowlist for a plan that skipped parsePlan', () => {
    const sneaky = plan([step('s', { type: 'RENAME_STACK', title: 'x' } as never)]);
    const r = dryRunPlan(baseStack(), sneaky, NOW);
    expect(!r.ok && r.error.code).toBe('INVALID_PATCH_COMMAND');
    expect(!r.ok && r.error.stepId).toBe('s');
  });

  it('reports PROJECT_VALIDATION_FAILED when the final validation fails', () => {
    const r = dryRunPlan(baseStack(), quizPlan(), NOW, {
      validateStack: () => ({ ok: false, error: { code: 'PROJECT_VALIDATION_FAILED', message: 'forced' } }),
    });
    expect(!r.ok && r.error.code).toBe('PROJECT_VALIDATION_FAILED');
    expect(!r.ok && r.error.message).toBe('forced');
  });

  it('turns a throwing injected applyCommand into an error result', () => {
    const r = dryRunPlan(baseStack(), quizPlan(), NOW, {
      applyCommand: () => {
        throw new Error('boom');
      },
    });
    expect(!r.ok && r.error.code).toBe('INVALID_PATCH_COMMAND');
  });

  it('reports progress once per step', () => {
    const calls: number[] = [];
    dryRunPlan(baseStack(), quizPlan(), NOW, { onProgress: (p) => calls.push(p.stepIndex) });
    expect(calls).toEqual(quizPlan().steps.map((_, i) => i));
  });

  it('returns the cancelled state with no Stack when the signal fires between steps', () => {
    const signal = {
      aborted: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    };
    const r = dryRunPlan(baseStack(), quizPlan(), NOW, {
      signal,
      onProgress: (p) => {
        if (p.stepIndex === 1) signal.aborted = true;
      },
    });
    expect(r.ok && r.value.status).toBe('cancelled');
    expect(r.ok && r.value.status === 'cancelled' && r.value.steps).toHaveLength(2);
    expect(r.ok && 'stack' in r.value).toBe(false);
  });
});
