import { describe, expect, it } from 'vitest';
import type { ProjectCommand, Stack } from '@ghoststack/shared-contracts';
import { applyCommand, createStack, validateStack } from './index';
import { deepClone } from './deep-clone';

const t0 = '2026-11-25T00:00:00.000Z';
const t1 = '2026-11-25T01:00:00.000Z';

const base = (): Stack => createStack({ stackId: 's1', cardId: 'c1', title: 'Demo', now: t0 });

function must(stack: Stack, command: ProjectCommand): Stack {
  const r = applyCommand(stack, command, t1);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

function withCards(): Stack {
  let s = base();
  s = must(s, { type: 'ADD_CARD', cardId: 'c2', title: 'Two' });
  return must(s, { type: 'ADD_CARD', cardId: 'c3', title: 'Three' });
}

describe('applyCommand', () => {
  it('renames the stack, bumps updatedAt, and does not mutate input', () => {
    const s = base();
    const snap = deepClone(s);
    const n = must(s, { type: 'RENAME_STACK', title: 'New' });
    expect(n.title).toBe('New');
    expect(n.updatedAt).toBe(t1);
    expect(s).toEqual(snap);
  });

  it('rejects an empty stack title', () => {
    const r = applyCommand(base(), { type: 'RENAME_STACK', title: '  ' }, t1);
    expect(!r.ok && r.error.code).toBe('INVALID_PATCH_COMMAND');
  });

  it('adds a card at the end and at an index', () => {
    const s = withCards();
    expect(s.cardOrder).toEqual(['c1', 'c2', 'c3']);
    const n = must(s, { type: 'ADD_CARD', cardId: 'c4', title: 'Four', index: 1 });
    expect(n.cardOrder).toEqual(['c1', 'c4', 'c2', 'c3']);
  });

  it('rejects duplicate id, bad index, empty title on ADD_CARD', () => {
    const s = base();
    for (const c of [
      { type: 'ADD_CARD', cardId: 'c1', title: 'x' },
      { type: 'ADD_CARD', cardId: 'z', title: 'x', index: 5 },
      { type: 'ADD_CARD', cardId: 'z', title: 'x', index: -1 },
      { type: 'ADD_CARD', cardId: 'z', title: '' },
    ] as ProjectCommand[]) {
      const r = applyCommand(s, c, t1);
      expect(!r.ok && r.error.code).toBe('INVALID_PATCH_COMMAND');
    }
  });

  it('renames a card and rejects unknown cards', () => {
    const n = must(base(), { type: 'RENAME_CARD', cardId: 'c1', title: 'Intro' });
    expect(n.cards['c1']?.title).toBe('Intro');
    const r = applyCommand(base(), { type: 'RENAME_CARD', cardId: 'nope', title: 'x' }, t1);
    expect(!r.ok && r.error.code).toBe('INVALID_PATCH_COMMAND');
    const r2 = applyCommand(base(), { type: 'RENAME_CARD', cardId: 'c1', title: '' }, t1);
    expect(r2.ok).toBe(false);
  });

  it('does not treat prototype keys as cards', () => {
    const r = applyCommand(base(), { type: 'RENAME_CARD', cardId: 'toString', title: 'x' }, t1);
    expect(r.ok).toBe(false);
  });

  it('duplicates a card deeply and inserts it right after the source', () => {
    let s = withCards();
    const card = s.cards['c1']!;
    s = {
      ...s,
      cards: {
        ...s.cards,
        c1: {
          ...card,
          behaviors: [{ a: { b: 1 } }],
          elements: [
            {
              elementId: 'e1',
              type: 'text',
              name: 'T',
              properties: { text: 'hi' },
              layout: { x: 0, y: 0, width: 10, height: 10, zIndex: 0 },
              behaviors: [],
            },
          ],
        },
      },
    };
    const n = must(s, { type: 'DUPLICATE_CARD', cardId: 'c1', newCardId: 'd1' });
    expect(n.cardOrder).toEqual(['c1', 'd1', 'c2', 'c3']);
    const copy = n.cards['d1']!;
    expect(copy.title).toBe('Card 1 copy');
    expect(copy.elements[0]?.elementId).toBe('e1');
    expect(copy.elements[0]).not.toBe(n.cards['c1']!.elements[0]);
    expect(copy.behaviors).toEqual(n.cards['c1']!.behaviors);
    expect(copy.behaviors).not.toBe(n.cards['c1']!.behaviors);
  });

  it('rejects duplicate with unknown source or taken id', () => {
    const s = base();
    expect(applyCommand(s, { type: 'DUPLICATE_CARD', cardId: 'x', newCardId: 'y' }, t1).ok).toBe(false);
    expect(applyCommand(s, { type: 'DUPLICATE_CARD', cardId: 'c1', newCardId: 'c1' }, t1).ok).toBe(false);
  });

  it('reorders only with a true permutation', () => {
    const s = withCards();
    expect(must(s, { type: 'REORDER_CARDS', cardOrder: ['c3', 'c1', 'c2'] }).cardOrder).toEqual([
      'c3',
      'c1',
      'c2',
    ]);
    for (const order of [
      ['c1', 'c2'],
      ['c1', 'c1', 'c2'],
      ['c1', 'c2', 'zz'],
      ['c1', 'c2', 'c3', 'c3'],
    ]) {
      const r = applyCommand(s, { type: 'REORDER_CARDS', cardOrder: order }, t1);
      expect(!r.ok && r.error.code).toBe('INVALID_PATCH_COMMAND');
    }
  });

  it('deletes a card; entry moves to first remaining card when deleted', () => {
    const s = withCards();
    const n = must(s, { type: 'DELETE_CARD', cardId: 'c1' });
    expect(n.cardOrder).toEqual(['c2', 'c3']);
    expect(n.entryCardId).toBe('c2');
    expect(n.cards['c1']).toBeUndefined();
    const m = must(s, { type: 'DELETE_CARD', cardId: 'c3' });
    expect(m.entryCardId).toBe('c1');
  });

  it('refuses to delete the last card or an unknown card', () => {
    const s = base();
    const r = applyCommand(s, { type: 'DELETE_CARD', cardId: 'c1' }, t1);
    expect(!r.ok && r.error.code).toBe('INVALID_PATCH_COMMAND');
    expect(applyCommand(s, { type: 'DELETE_CARD', cardId: 'x' }, t1).ok).toBe(false);
  });

  it('returns PROJECT_VALIDATION_FAILED when the input stack is already invalid', () => {
    const bad = { ...base(), entryCardId: 'ghost' };
    const r = applyCommand(bad, { type: 'RENAME_STACK', title: 'x' }, t1);
    expect(!r.ok && r.error.code).toBe('PROJECT_VALIDATION_FAILED');
  });
});

describe('applyCommand invariants over random command sequences', () => {
  // Deterministic LCG so failures reproduce.
  function rng(seed: number) {
    let x = seed;
    return () => {
      x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
      return x / 2 ** 32;
    };
  }

  it('keeps every successful result valid and never mutates failed or input stacks', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const rand = rng(seed);
      const pick = <T>(a: T[]): T => a[Math.floor(rand() * a.length)] as T;
      let stack = base();
      let n = 0;
      for (let step = 0; step < 60; step++) {
        const ids = stack.cardOrder;
        const maybe = () => (rand() < 0.15 ? 'missing' : pick(ids));
        const shuffled = [...ids].sort(() => rand() - 0.5);
        const cmds: ProjectCommand[] = [
          { type: 'RENAME_STACK', title: rand() < 0.2 ? '' : `T${step}` },
          {
            type: 'ADD_CARD',
            cardId: rand() < 0.1 ? pick(ids) : `n${n++}`,
            title: `C${step}`,
            index: Math.floor(rand() * (ids.length + 2)) - 0,
          },
          { type: 'RENAME_CARD', cardId: maybe(), title: `R${step}` },
          { type: 'DUPLICATE_CARD', cardId: maybe(), newCardId: rand() < 0.1 ? pick(ids) : `n${n++}` },
          { type: 'REORDER_CARDS', cardOrder: rand() < 0.2 ? shuffled.slice(1) : shuffled },
          { type: 'DELETE_CARD', cardId: maybe() },
        ];
        const cmd = pick(cmds);
        const before = deepClone(stack);
        const now = `2026-11-25T00:00:${String(step).padStart(2, '0')}.000Z`;
        const r = applyCommand(stack, cmd, now);
        expect(stack).toEqual(before);
        if (r.ok) {
          expect(validateStack(r.value).ok).toBe(true);
          expect(r.value.updatedAt).toBe(now);
          expect(r.value.cardOrder.length).toBeGreaterThan(0);
          stack = r.value;
        } else {
          expect(['INVALID_PATCH_COMMAND', 'PROJECT_VALIDATION_FAILED']).toContain(r.error.code);
        }
      }
    }
  });
});
