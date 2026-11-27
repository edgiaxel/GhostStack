import { describe, expect, it } from 'vitest';
import { checkPlanOutput } from './plan-output';

const plan = (element: Record<string, unknown>) =>
  JSON.stringify({
    schemaVersion: 1,
    summary: 'Add a heading.',
    affectedCardIds: ['c1'],
    steps: [
      {
        id: 's1',
        cardId: 'c1',
        rationale: 'Add the heading.',
        command: { type: 'ADD_ELEMENT', cardId: 'c1', element },
      },
    ],
  });

describe('checkPlanOutput element defaults (M3.6 live finding)', () => {
  it('accepts an ADD_ELEMENT without behaviors, properties or zIndex and fills empty values', () => {
    const r = checkPlanOutput(
      plan({
        elementId: 'e1',
        type: 'text',
        name: 'Heading',
        layout: { x: 10, y: 10, width: 200, height: 40 },
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const command = r.plan.steps[0]?.command;
    expect(command?.type).toBe('ADD_ELEMENT');
    if (command?.type !== 'ADD_ELEMENT') return;
    expect(command.element.behaviors).toEqual([]);
    expect(command.element.properties).toEqual({});
    expect(command.element.layout.zIndex).toBe(0);
  });

  it('keeps provided behaviors and zIndex untouched', () => {
    const behaviors = [
      {
        behaviorId: 'b1',
        trigger: 'element.click',
        conditions: [],
        actions: [{ type: 'nextCard' }],
        enabled: true,
      },
    ];
    const r = checkPlanOutput(
      plan({
        elementId: 'e1',
        type: 'button',
        name: 'Next',
        properties: { text: 'Next' },
        layout: { x: 0, y: 0, width: 100, height: 40, zIndex: 3 },
        behaviors,
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok || r.plan.steps[0]?.command.type !== 'ADD_ELEMENT') return;
    expect(r.plan.steps[0].command.element.behaviors).toEqual(behaviors);
    expect(r.plan.steps[0].command.element.layout.zIndex).toBe(3);
  });

  it('still rejects a missing layout or a wrong behavior shape', () => {
    expect(checkPlanOutput(plan({ elementId: 'e1', type: 'text', name: 'H' })).ok).toBe(false);
    expect(
      checkPlanOutput(
        plan({
          elementId: 'e1',
          type: 'text',
          name: 'H',
          layout: { x: 0, y: 0, width: 1, height: 1 },
          behaviors: 'x',
        }),
      ).ok,
    ).toBe(false);
  });

  it('rejects a command given as a bare string', () => {
    const r = checkPlanOutput(
      JSON.stringify({
        schemaVersion: 1,
        summary: 's',
        affectedCardIds: [],
        steps: [{ id: 's1', rationale: 'r', command: 'ADD_CARD' }],
      }),
    );
    expect(r.ok).toBe(false);
  });
});

describe('checkPlanOutput behavior defaults', () => {
  it('fills behaviorId, conditions and enabled on inline and UPDATE_BEHAVIOR behaviors', () => {
    const raw = JSON.stringify({
      schemaVersion: 1,
      summary: 's',
      affectedCardIds: ['c1'],
      steps: [
        {
          id: 's1',
          cardId: 'c1',
          rationale: 'r',
          command: {
            type: 'ADD_ELEMENT',
            cardId: 'c1',
            element: {
              elementId: 'go',
              type: 'button',
              name: 'Go',
              properties: { text: 'Go' },
              layout: { x: 0, y: 0, width: 10, height: 10 },
              behaviors: [{ trigger: 'element.click', actions: [{ type: 'nextCard' }] }],
            },
          },
        },
        {
          id: 's2',
          cardId: 'c1',
          rationale: 'r',
          command: {
            type: 'UPDATE_BEHAVIOR',
            cardId: 'c1',
            behaviors: [{ trigger: 'card.enter', actions: [] }],
          },
        },
      ],
    });
    const r = checkPlanOutput(raw);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [a, b] = r.plan.steps.map((s) => s.command);
    expect(a?.type === 'ADD_ELEMENT' && a.element.behaviors[0]).toMatchObject({
      behaviorId: 'go-b1',
      conditions: [],
      enabled: true,
    });
    expect(b?.type === 'UPDATE_BEHAVIOR' && b.behaviors[0]).toMatchObject({
      behaviorId: 'c1-b1',
      enabled: true,
    });
  });
});

describe('checkPlanOutput step order', () => {
  it('moves state schema and new Card steps before element steps, keeping relative order', () => {
    const step = (id: string, command: Record<string, unknown>) => ({ id, rationale: 'r', command });
    const raw = JSON.stringify({
      schemaVersion: 1,
      summary: 's',
      affectedCardIds: [],
      steps: [
        step('a', { type: 'ADD_CARD', cardId: 'q1', title: 'Q1' }),
        step('b', {
          type: 'ADD_ELEMENT',
          cardId: 'q1',
          element: {
            elementId: 'e',
            type: 'text',
            name: 'E',
            properties: { text: 't' },
            layout: { x: 0, y: 0, width: 1, height: 1 },
          },
        }),
        step('c', { type: 'ADD_CARD', cardId: 'q2', title: 'Q2' }),
        step('d', { type: 'UPDATE_STATE_SCHEMA', stateSchema: {} }),
      ],
    });
    const r = checkPlanOutput(raw);
    expect(r.ok && r.plan.steps.map((s) => s.id)).toEqual(['d', 'a', 'c', 'b']);
  });
});
