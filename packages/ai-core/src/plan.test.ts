import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { MAX_PLAN_COMMANDS, aiPlanJsonSchema, parseAIPlan } from './plan';

const textElement = {
  type: 'text',
  name: 'Heading',
  layout: { x: 0, y: 0, width: 200, height: 40 },
  properties: { text: 'Hello' },
};

const plan = (commands: unknown[]) => ({
  planVersion: 1,
  planId: 'plan-1',
  requestSummary: 'Add a welcome card',
  commands,
});

describe('parseAIPlan', () => {
  it('accepts a plan that uses refs declared earlier', () => {
    const result = parseAIPlan(
      plan([
        { command: 'ADD_CARD', ref: 'welcome', title: 'Welcome' },
        { command: 'ADD_ELEMENT', ref: 'heading', cardId: 'welcome', element: textElement },
        {
          command: 'UPDATE_ELEMENT',
          cardId: 'welcome',
          elementId: 'heading',
          changes: { name: 'Title' },
        },
      ]),
    );
    expect(result.ok).toBe(true);
  });

  it.each([
    [{ command: 'DELETE_CARD', cardId: 'crd_x' }],
    [{ command: 'DELETE_ELEMENT', cardId: 'crd_x', elementId: 'elm_x' }],
    [{ command: 'UPDATE_STATE_SCHEMA', set: { score: { type: 'number', initial: 0 } } }],
    [{ command: 'UPDATE_BEHAVIOR', cardId: 'crd_x', behavior: { anything: true } }],
  ])('accepts %j', (command) => {
    expect(parseAIPlan(plan([command])).ok).toBe(true);
  });

  it('rejects an unknown command type with a located issue', () => {
    const result = parseAIPlan(plan([{ command: 'RUN_SHELL', cmd: 'rm -rf /' }]));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('INVALID_AI_PLAN');
      expect(result.issues[0]?.path.slice(0, 2)).toEqual(['commands', 0]);
    }
  });

  it('rejects unknown fields instead of ignoring them', () => {
    const result = parseAIPlan({ ...plan([{ command: 'DELETE_CARD', cardId: 'a' }]), extra: 1 });
    expect(result.ok).toBe(false);
  });

  it('rejects an empty command list and an oversized one', () => {
    expect(parseAIPlan(plan([])).ok).toBe(false);
    const many = Array.from({ length: MAX_PLAN_COMMANDS + 1 }, () => ({
      command: 'DELETE_CARD',
      cardId: 'a',
    }));
    expect(parseAIPlan(plan(many)).ok).toBe(false);
  });

  it('rejects a wrong plan version', () => {
    expect(
      parseAIPlan({ ...plan([{ command: 'DELETE_CARD', cardId: 'a' }]), planVersion: 2 }).ok,
    ).toBe(false);
  });

  it('rejects an element that carries its own identifier', () => {
    const result = parseAIPlan(
      plan([
        {
          command: 'ADD_ELEMENT',
          cardId: 'crd_x',
          element: { ...textElement, elementId: 'elm_1' },
        },
      ]),
    );
    expect(result.ok).toBe(false);
  });

  it('rejects an element whose type and properties disagree', () => {
    const result = parseAIPlan(
      plan([
        {
          command: 'ADD_ELEMENT',
          cardId: 'crd_x',
          element: { ...textElement, properties: { label: 'wrong shape' } },
        },
      ]),
    );
    expect(result.ok).toBe(false);
  });

  it('rejects a duplicate ref', () => {
    const result = parseAIPlan(
      plan([
        { command: 'ADD_CARD', ref: 'a', title: 'One' },
        { command: 'ADD_CARD', ref: 'a', title: 'Two' },
      ]),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0]?.message).toContain('duplicate_ref');
  });

  it('rejects a ref used before it is declared', () => {
    const result = parseAIPlan(
      plan([
        { command: 'ADD_ELEMENT', cardId: 'later', element: textElement },
        { command: 'ADD_CARD', ref: 'later', title: 'Later' },
      ]),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0]?.message).toContain('ref_used_before_declared');
  });

  it('does not echo input values in issue messages', () => {
    const secret = ['sk', 'or', 'v1', 'should-never-appear'].join('-');
    const result = parseAIPlan(
      plan([{ command: 'ADD_CARD', title: secret.repeat(10), ref: secret }]),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(JSON.stringify(result.issues)).not.toContain(secret);
    }
  });

  it('truncates unknown key names in messages', () => {
    const result = parseAIPlan({
      ...plan([{ command: 'DELETE_CARD', cardId: 'a' }]),
      ['k'.repeat(500)]: 1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(JSON.stringify(result.issues).length).toBeLessThan(400);
  });
});

describe('parseAIPlan properties', () => {
  it('is total for any JSON value', () => {
    fc.assert(
      fc.property(fc.jsonValue(), (value) => {
        const result = parseAIPlan(value);
        expect(typeof result.ok).toBe('boolean');
      }),
      { numRuns: 300 },
    );
  });

  it('does not mutate its input', () => {
    fc.assert(
      fc.property(fc.jsonValue(), (value) => {
        const before = JSON.stringify(value);
        parseAIPlan(value);
        expect(JSON.stringify(value)).toBe(before);
      }),
      { numRuns: 200 },
    );
  });

  it('survives deeply nested behavior payloads', () => {
    let deep: unknown = 'x';
    for (let i = 0; i < 2000; i += 1) deep = [deep];
    const result = parseAIPlan(
      plan([{ command: 'UPDATE_BEHAVIOR', cardId: 'crd_x', behavior: deep }]),
    );
    expect(typeof result.ok).toBe('boolean');
  });
});

describe('aiPlanJsonSchema', () => {
  it('contains no keyword that provider grammar compilers reject', () => {
    const text = JSON.stringify(aiPlanJsonSchema());
    expect(text).not.toContain('propertyNames');
    expect(text).not.toContain('$schema');
  });

  it('still describes the plan: top-level fields and the command union', () => {
    const schema = aiPlanJsonSchema() as {
      properties: Record<string, unknown>;
      required: string[];
    };
    expect(Object.keys(schema.properties).sort()).toEqual([
      'commands',
      'planId',
      'planVersion',
      'requestSummary',
    ]);
    expect(schema.required).toEqual(
      expect.arrayContaining(['planVersion', 'planId', 'requestSummary', 'commands']),
    );
  });

  it('does not loosen local validation: a bad state key is still rejected by the parser', () => {
    const result = parseAIPlan(
      plan([
        {
          command: 'UPDATE_STATE_SCHEMA',
          set: { ['k'.repeat(61)]: { type: 'number', initial: 0 } },
        },
      ]),
    );
    expect(result.ok).toBe(false);
  });
});
