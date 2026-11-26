import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { ActionNode, Behavior } from '@ghoststack/shared-contracts';
import { locateDomainIssue, parseGhostScript, printGhostScript } from './index';

describe('GhostScript lists and cards', () => {
  const src = `behavior "add" on element.click {
  list add items = "x" + 1
  list remove items at length(items) - 1
  list set items at 0 = item(items, 1)
  list clear items
  next card
  previous card
  text "out" = join(items, "\\n")
}
`;

  it('accepts exactly what the printer writes', () => {
    const r = parseGhostScript(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.behaviors[0]?.actions.map((a) => a.type)).toEqual([
      'listAdd',
      'listRemove',
      'listSet',
      'listClear',
      'nextCard',
      'prevCard',
      'setText',
    ]);
    expect(printGhostScript(r.behaviors)).toBe(src);
  });

  it('writes variables named like keywords with @"..."', () => {
    const b: Behavior = {
      behaviorId: 'k',
      trigger: 'card.enter',
      conditions: [],
      actions: [{ type: 'listClear', key: 'list' }],
      enabled: true,
    };
    expect(printGhostScript([b])).toContain('list clear @"list"');
  });

  it.each([
    'behavior "a" on card.enter { next }',
    'behavior "a" on card.enter { list }',
    'behavior "a" on card.enter { list add items }',
    'behavior "a" on card.enter { list remove items 1 }',
    'behavior "a" on card.enter { set x = length(1) }',
    'behavior "a" on card.enter { set x = join(items) }',
    'behavior "a" on card.enter { set x = item(items, ) }',
  ])('rejects malformed list syntax %j', (s) => {
    expect(parseGhostScript(s).ok).toBe(false);
  });
});

describe('GhostScript name references', () => {
  const refs = {
    cards: [
      { id: 'c1', name: 'Home' },
      { id: 'c2', name: 'Home' },
      { id: 'c3', name: 'Done' },
    ],
    elements: [
      { id: 'e-1', name: 'Title' },
      { id: 'e-2', name: 'Add' },
      { id: 'Add', name: 'Other' },
      { id: 'e-4', name: 'Add' },
    ],
  };

  it('resolves unique names to ids and keeps the AST in ids', () => {
    const r = parseGhostScript('behavior "b" on card.enter {\n go "Done"\n text "Title" = "x"\n}', refs);
    expect(r).toMatchObject({
      ok: true,
      behaviors: [{ actions: [{ cardId: 'c3' }, { elementId: 'e-1' }] }],
    });
  });

  it('keeps ambiguous names as typed and prefers an exact id', () => {
    const r = parseGhostScript('behavior "b" on card.enter {\n go "Home"\n show "Add"\n go "c1"\n}', refs);
    expect(r).toMatchObject({
      ok: true,
      behaviors: [{ actions: [{ cardId: 'Home' }, { elementId: 'Add' }, { cardId: 'c1' }] }],
    });
  });

  it('prints names only where unique and readable back', () => {
    const b: Behavior = {
      behaviorId: 'b',
      trigger: 'card.enter',
      conditions: [],
      actions: [
        { type: 'navigate', cardId: 'c3' },
        { type: 'navigate', cardId: 'c1' },
        { type: 'show', elementId: 'e-1' },
        { type: 'show', elementId: 'e-2' },
        { type: 'hide', elementId: 'Add' },
      ],
      enabled: true,
    };
    const out = printGhostScript([b], refs);
    expect(out).toContain('go "Done"');
    expect(out).toContain('go "c1"');
    expect(out).toContain('show "Title"');
    expect(out).toContain('show "e-2"');
    expect(out).toContain('hide "Other"');
    expect(parseGhostScript(out, refs)).toMatchObject({ ok: true, behaviors: [b] });
  });

  it('property: parse(print(x, refs), refs) equals x for ids the refs know', () => {
    const ids = ['e-1', 'e-2', 'e-3', 'c1', 'c2', 'Home', 'Add'] as const;
    const refArb = fc.array(
      fc.record({
        id: fc.constantFrom(...ids),
        name: fc.constantFrom('Home', 'Add', 'Title', 'e-1', 'c1', 'x y', ''),
      }),
      { maxLength: 6 },
    );
    fc.assert(
      fc.property(
        refArb,
        refArb,
        fc.array(fc.constantFrom(...ids), { minLength: 1, maxLength: 5 }),
        (cards, els, targets) => {
          // An unknown id may collide with a name by design, so targets are limited to known ids.
          const unique = (l: { id: string; name: string }[]) =>
            l.filter((r, i) => l.findIndex((q) => q.id === r.id) === i);
          const c = unique(cards);
          const e = unique(els);
          const actions: ActionNode[] = targets.flatMap((t): ActionNode[] => [
            ...(c.some((r) => r.id === t) ? [{ type: 'navigate', cardId: t } as const] : []),
            ...(e.some((r) => r.id === t) ? [{ type: 'show', elementId: t } as const] : []),
          ]);
          const b: Behavior = {
            behaviorId: 'b',
            trigger: 'card.enter',
            conditions: [],
            actions,
            enabled: true,
          };
          const r = { cards: c, elements: e };
          expect(parseGhostScript(printGhostScript([b], r), r)).toMatchObject({ ok: true, behaviors: [b] });
        },
      ),
      { numRuns: 300 },
    );
  });

  it('reports a schema failure on the line of its behavior', () => {
    const r = parseGhostScript(
      'behavior "a" on card.enter {\n}\n\nbehavior "b" on card.enter {\n set x = join(l, "123456789012345678901")\n}',
    );
    expect(r).toMatchObject({ ok: false, issues: [{ line: 4 }] });
  });
});

describe('locateDomainIssue', () => {
  const script = `behavior "a" on element.click {
  set score = 1
}

behavior "b" on element.click {
  text "label" = "x"
  go "nowhere"
  list add items = 1
}
`;
  it('points at the action that names the bad target', () => {
    expect(locateDomainIssue(script, 'Behavior b navigates to unknown card nowhere')).toEqual({
      line: 7,
      column: 6,
    });
    expect(locateDomainIssue(script, 'Behavior a sets unknown state variable score')).toEqual({
      line: 2,
      column: 7,
    });
    expect(locateDomainIssue(script, 'Behavior b uses items, which is not a list variable')).toEqual({
      line: 8,
      column: 12,
    });
  });
  it('falls back to the behavior header, then to line 1', () => {
    expect(locateDomainIssue(script, 'Behavior b: element.change requires an input element')).toEqual({
      line: 5,
      column: 14,
    });
    expect(locateDomainIssue(script, 'Something else')).toEqual({ line: 1, column: 1 });
  });
  it('maps a duplicate id to the later behavior', () => {
    const dup = `behavior "a" on card.enter {\n}\nbehavior "a" on card.enter {\n}\n`;
    expect(locateDomainIssue(dup, 'Duplicate behavior id a on card c1')).toEqual({ line: 3, column: 1 });
  });
});
