import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { validateStack } from '@ghoststack/domain';
import { createRuntime } from '@ghoststack/behavior';
import { exportGsp, importGsp } from '@ghoststack/project-format';
import { TEMPLATES } from './index';

const NOW = '2026-01-01T00:00:00.000Z';
const counter = () => {
  let n = 0;
  return () => `id-${++n}`;
};

describe('templates', () => {
  it('lists the five templates', () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual(['blank', 'quiz', 'recipes', 'inventory', 'guide']);
  });

  for (const t of TEMPLATES) {
    it(`${t.name}: valid for any title, same inputs give the same Stack, survives .gsp round trip`, () => {
      fc.assert(
        fc.property(fc.string({ maxLength: 60 }), (title) => {
          const a = t.build({ stackId: 's1', title, now: NOW, newId: counter() });
          const b = t.build({ stackId: 's1', title, now: NOW, newId: counter() });
          expect(a.ok).toBe(true);
          if (!a.ok || !b.ok) return;
          expect(a.value).toEqual(b.value);
          expect(validateStack(a.value).ok).toBe(true);
          const bytes = exportGsp(a.value, {});
          expect(bytes.ok).toBe(true);
          if (!bytes.ok) return;
          const back = importGsp(bytes.value);
          expect(back.ok).toBe(true);
          if (back.ok) expect(back.value.stack).toEqual(a.value);
        }),
        { numRuns: 25 },
      );
    });

    it(`${t.name}: starts the runtime without errors`, () => {
      const r = t.build({ stackId: 's1', title: t.name, now: NOW, newId: counter() });
      if (!r.ok) throw new Error(r.error.message);
      expect(createRuntime(r.value).start().errors).toEqual([]);
    });
  }

  it('inventory adds and removes an item at runtime', () => {
    const t = TEMPLATES.find((x) => x.id === 'inventory')!;
    const r = t.build({ stackId: 's1', title: 'Inv', now: NOW, newId: counter() });
    if (!r.ok) throw new Error(r.error.message);
    const stack = r.value;
    const card = stack.cards[stack.entryCardId]!;
    const el = (name: string) => card.elements.find((e) => e.name === name)!;
    const rt = createRuntime(stack);
    expect(rt.start().elements[el('List').elementId]?.text).toBe('No items yet.');
    rt.dispatch({ type: 'element.change', elementId: el('New entry').elementId, value: 'milk' });
    rt.dispatch({ type: 'element.click', elementId: el('Add button').elementId });
    rt.dispatch({ type: 'element.change', elementId: el('New entry').elementId, value: 'eggs' });
    let snap = rt.dispatch({ type: 'element.click', elementId: el('Add button').elementId });
    expect(snap.elements[el('List').elementId]?.text).toBe('milk\neggs');
    snap = rt.dispatch({ type: 'element.click', elementId: el('Remove last button').elementId });
    expect(snap.elements[el('List').elementId]?.text).toBe('milk');
    expect(snap.errors).toEqual([]);
    rt.dispatch({ type: 'element.click', elementId: el('Remove last button').elementId });
    snap = rt.dispatch({ type: 'element.click', elementId: el('Remove last button').elementId });
    expect(snap.elements[el('List').elementId]?.text).toBe('No items yet.');
    expect(snap.errors).toEqual([]);
  });
});
