import { createStack, validateProject } from '@ghoststack/domain';
import type { FactoryDeps, Project } from '@ghoststack/domain';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { applyPlan } from './patch';
import { parseAIPlan } from './plan';
import type { AIPlan } from './plan';

const counterDeps = (): FactoryDeps => {
  let n = 0;
  const hex = (value: number) => value.toString(16).padStart(12, '0');
  return {
    clock: () => '2026-01-02T00:00:00.000Z',
    newId: (prefix) => `${prefix}_00000000-0000-4000-8000-${hex((n += 1))}`,
  };
};

const baseProject = (): Project => {
  const created = createStack('Quiz', {
    clock: () => '2026-01-01T00:00:00.000Z',
    newId: (prefix) =>
      `${prefix}_00000000-0000-4000-8000-${'0'.repeat(11)}${prefix === 'stk' ? '1' : '2'}`,
  });
  if (!created.ok) throw new Error('fixture');
  return created.value;
};

const textElement = {
  type: 'text' as const,
  name: 'Heading',
  layout: { x: 0, y: 0, width: 200, height: 40 },
  properties: { text: 'Hello' },
};

const plan = (commands: unknown[]): AIPlan => {
  const parsed = parseAIPlan({ planVersion: 1, planId: 'p', requestSummary: 's', commands });
  if (!parsed.ok) throw new Error(`fixture plan invalid: ${JSON.stringify(parsed.issues)}`);
  return parsed.plan;
};

const applied = (project: Project, commands: unknown[]) => {
  const result = applyPlan(project, plan(commands), { deps: counterDeps() });
  if (!result.ok) throw new Error(`unexpected failure: ${JSON.stringify(result.error)}`);
  return result.value;
};

describe('applyPlan', () => {
  it('adds a card and an element using refs and produces a valid project', () => {
    const outcome = applied(baseProject(), [
      { command: 'ADD_CARD', ref: 'welcome', title: 'Welcome' },
      { command: 'ADD_ELEMENT', ref: 'heading', cardId: 'welcome', element: textElement },
    ]);
    const cardId = outcome.created.cards['welcome'] as string;
    const elementId = outcome.created.elements['heading'] as string;
    expect(outcome.project.cardOrder).toHaveLength(2);
    expect(outcome.project.cards[cardId]?.elements[0]?.elementId).toBe(elementId);
    expect(validateProject(outcome.project).errors).toEqual([]);
    expect(outcome.reports.map((r) => r.command)).toEqual(['ADD_CARD', 'ADD_ELEMENT']);
  });

  it('never mutates the input project', () => {
    const original = baseProject();
    const before = JSON.stringify(original);
    applied(original, [{ command: 'ADD_CARD', title: 'Extra' }]);
    expect(JSON.stringify(original)).toBe(before);
  });

  it('updates an element and keeps its type', () => {
    const base = applied(baseProject(), [
      { command: 'ADD_ELEMENT', ref: 'h', cardId: baseProject().entryCardId, element: textElement },
    ]);
    const updated = applied(base.project, [
      {
        command: 'UPDATE_ELEMENT',
        cardId: base.project.entryCardId,
        elementId: base.created.elements['h'],
        changes: { name: 'Title', layout: { x: 10 }, properties: { text: 'Changed' } },
      },
    ]);
    const element = updated.project.cards[updated.project.entryCardId]?.elements[0];
    expect(element).toMatchObject({
      type: 'text',
      name: 'Title',
      layout: { x: 10, y: 0, width: 200, height: 40 },
      properties: { text: 'Changed' },
    });
  });

  it('deletes an element and a card, moving the entry card when needed', () => {
    const withCard = applied(baseProject(), [{ command: 'ADD_CARD', ref: 'b', title: 'B' }]);
    const entry = withCard.project.entryCardId;
    const result = applied(withCard.project, [{ command: 'DELETE_CARD', cardId: entry }]);
    expect(result.project.entryCardId).toBe(withCard.created.cards['b']);
    expect(validateProject(result.project).errors).toEqual([]);
  });

  it('refuses to delete the last card', () => {
    const project = baseProject();
    const result = applyPlan(
      project,
      plan([{ command: 'DELETE_CARD', cardId: project.entryCardId }]),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_PATCH_COMMAND');
  });

  it('updates the state schema and rejects removing a missing key', () => {
    const set = applied(baseProject(), [
      { command: 'UPDATE_STATE_SCHEMA', set: { score: { type: 'number', initial: 0 } } },
    ]);
    expect(set.project.stateSchema['score']).toEqual({ type: 'number', initial: 0 });
    const removed = applied(set.project, [{ command: 'UPDATE_STATE_SCHEMA', remove: ['score'] }]);
    expect(removed.project.stateSchema).toEqual({});
    const missing = applyPlan(
      baseProject(),
      plan([{ command: 'UPDATE_STATE_SCHEMA', remove: ['nope'] }]),
    );
    expect(missing.ok).toBe(false);
  });

  it('rejects UPDATE_BEHAVIOR as unsupported', () => {
    const project = baseProject();
    const result = applyPlan(
      project,
      plan([{ command: 'UPDATE_BEHAVIOR', cardId: project.entryCardId, behavior: {} }]),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('UNSUPPORTED_COMMAND');
  });

  it('reports the failing command index and leaves the input unchanged', () => {
    const project = baseProject();
    const before = JSON.stringify(project);
    const result = applyPlan(
      project,
      plan([
        { command: 'ADD_CARD', title: 'Fine' },
        { command: 'DELETE_ELEMENT', cardId: project.entryCardId, elementId: 'elm_missing' },
      ]),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.commandIndex).toBe(1);
    expect(JSON.stringify(project)).toBe(before);
  });

  it('rejects a change that makes an element invalid', () => {
    const base = applied(baseProject(), [
      { command: 'ADD_ELEMENT', ref: 'h', cardId: baseProject().entryCardId, element: textElement },
    ]);
    const result = applyPlan(
      base.project,
      plan([
        {
          command: 'UPDATE_ELEMENT',
          cardId: base.project.entryCardId,
          elementId: base.created.elements['h'],
          changes: { properties: { label: 'not a text property' } },
        },
      ]),
    );
    expect(result.ok).toBe(false);
  });

  it('does not resolve prototype keys as targets or state keys', () => {
    const project = baseProject();
    const target = applyPlan(project, plan([{ command: 'DELETE_CARD', cardId: '__proto__' }]));
    expect(target.ok).toBe(false);
    // Zod's record parser drops a "__proto__" key, so a set payload becomes a harmless no-op.
    const dropped = applyPlan(
      project,
      plan([
        {
          command: 'UPDATE_STATE_SCHEMA',
          set: JSON.parse('{"__proto__":{"type":"string","initial":"x"}}') as unknown,
        },
      ]),
    );
    expect(dropped.ok && Object.keys(dropped.value.project.stateSchema)).toEqual([]);
    // The explicit guard rejects reserved names that reach the applier.
    const removed = applyPlan(
      project,
      plan([{ command: 'UPDATE_STATE_SCHEMA', remove: ['__proto__'] }]),
    );
    expect(removed.ok).toBe(false);
    expect(({} as Record<string, unknown>)['type']).toBeUndefined();
  });

  it('reports failures from the beforeCommand hook as a failed operation', () => {
    const project = baseProject();
    const result = applyPlan(project, plan([{ command: 'ADD_CARD', title: 'X' }]), {
      beforeCommand: () => {
        throw new Error('injected');
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('TRANSACTION_FAILED');
  });

  it('is deterministic for the same injected dependencies', () => {
    const commands = [{ command: 'ADD_CARD', ref: 'a', title: 'A' }];
    const first = applyPlan(baseProject(), plan(commands), { deps: counterDeps() });
    const second = applyPlan(baseProject(), plan(commands), { deps: counterDeps() });
    expect(first).toEqual(second);
  });

  it('keeps projects valid for any sequence of valid card and element additions', () => {
    const title = fc
      .string({ minLength: 1, maxLength: 40 })
      .filter((value) => value.trim().length > 0);
    fc.assert(
      fc.property(fc.array(title, { minLength: 1, maxLength: 8 }), (titles) => {
        const project = baseProject();
        const before = JSON.stringify(project);
        const commands = titles.flatMap((t, i) => [
          { command: 'ADD_CARD', ref: `c${'x'.repeat(i)}`, title: t },
          {
            command: 'ADD_ELEMENT',
            cardId: `c${'x'.repeat(i)}`,
            element: { ...textElement, properties: { text: t } },
          },
        ]);
        const outcome = applied(project, commands);
        expect(validateProject(outcome.project).errors).toEqual([]);
        expect(JSON.stringify(project)).toBe(before);
      }),
      { numRuns: 100 },
    );
  });
});
