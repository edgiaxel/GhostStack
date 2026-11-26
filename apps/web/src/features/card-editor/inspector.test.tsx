// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fc from 'fast-check';
import { afterEach, describe, expect, it } from 'vitest';
import { applyCommand, createStack, validateStack } from '@ghoststack/domain';
import { createIdbStorage } from '@ghoststack/storage';
import {
  ANCHORS,
  DEFAULT_ELEMENT_PLACEMENT,
  ELEMENT_DEFAULTS,
  SCALE_MODES,
  VIEWPORT_PRESETS,
} from '@ghoststack/shared-contracts';
import type { ElementType, Stack, StackSession } from '@ghoststack/shared-contracts';
import { ServicesProvider } from '../../app/services';
import { createStackSessionFactory } from '../history/session';
import { CardInspector } from './index';
import { PIN_GRID } from './inspector-extras';
import { MIXED, describeBehavior, fixHint, sharedValue } from './inspector-model';

afterEach(cleanup);
const NOW = '2026-11-26T00:00:00.000Z';
const TYPES: ElementType[] = ['text', 'button', 'input', 'image', 'shape', 'line'];

function stackWithAllTypes(): Stack {
  let stack = createStack({ stackId: 's', cardId: 'c1', title: 'T', now: NOW });
  for (const type of TYPES) {
    const d = ELEMENT_DEFAULTS[type];
    const r = applyCommand(
      stack,
      {
        type: 'ADD_ELEMENT',
        cardId: 'c1',
        element: {
          elementId: type,
          type,
          name: d.name,
          properties: { ...d.properties },
          layout: { x: 0, y: 0, width: d.width, height: d.height, zIndex: 0, ...DEFAULT_ELEMENT_PLACEMENT },
          behaviors: [],
        },
      },
      NOW,
    );
    if (!r.ok) throw new Error(r.error.message);
    stack = r.value;
  }
  return stack;
}

describe('inspector model', () => {
  it('shares equal values and reports MIXED for differing ones', () => {
    fc.assert(
      fc.property(fc.array(fc.integer(), { minLength: 1, maxLength: 6 }), (xs) => {
        const same = sharedValue(xs.map(() => xs[0]));
        expect(same).toBe(xs[0]);
        const r = sharedValue(xs);
        expect(r === MIXED).toBe(new Set(xs).size > 1);
      }),
      { numRuns: 100 },
    );
    expect(sharedValue([])).toBe(MIXED);
  });

  it('pins to exactly the nine anchors', () => {
    expect([...PIN_GRID]).toEqual([...ANCHORS]);
    expect(PIN_GRID).toHaveLength(9);
  });

  it('gives a fix hint for common rejections', () => {
    expect(fixHint('fill', 'bad')).toMatch(/hex/);
    expect(fixHint('width', 'must be at least 0')).toMatch(/larger/);
    expect(fixHint('x', 'something odd')).toMatch(/Undo/);
  });

  it('describes a behavior in one sentence with names, not ids', () => {
    const stack = stackWithAllTypes();
    const text = describeBehavior(
      {
        behaviorId: 'b',
        trigger: 'element.click',
        conditions: [],
        actions: [
          { type: 'hide', elementId: 'shape' },
          { type: 'navigate', cardId: 'c1' },
        ],
        enabled: true,
      },
      stack,
    );
    expect(text).toBe('When clicked: hide Shape, then go to card "Card 1".');
  });
});

const hex = fc
  .tuple(fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }))
  .map(([r, g, b]) => `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`);
const anyValue = fc.oneof(
  fc.double({ noNaN: true, min: -1e4, max: 1e4 }),
  fc.string({ maxLength: 12 }),
  hex,
  fc.boolean(),
  fc.constantFrom('transparent', 'red;', '', '#fff'),
);
const propertyName = fc.constantFrom(
  'text',
  'fontSize',
  'fontWeight',
  'align',
  'color',
  'background',
  'fill',
  'stroke',
  'strokeWidth',
  'radius',
  'opacity',
  'visible',
  'fit',
  'shape',
  'flipY',
  'placeholder',
  'defaultValue',
  'alt',
);

describe('inspector commits', () => {
  it('any accepted property or layout edit yields a valid Stack; a rejected one leaves it unchanged', () => {
    const base = stackWithAllTypes();
    fc.assert(
      fc.property(
        fc.constantFrom(...TYPES),
        propertyName,
        anyValue,
        fc.constantFrom('x', 'y', 'width', 'height'),
        fc.double({ noNaN: true, min: -50, max: 3000 }),
        fc.constantFrom(...ANCHORS),
        fc.constantFrom(...SCALE_MODES),
        (type, name, value, dim, num, anchor, scaleMode) => {
          for (const patch of [
            { properties: { [name]: value } },
            { layout: { [dim]: num } },
            { layout: { anchor, scaleMode } },
          ]) {
            const r = applyCommand(
              base,
              { type: 'UPDATE_ELEMENT', cardId: 'c1', elementId: type, patch },
              NOW,
            );
            if (r.ok) expect(validateStack(r.value).ok).toBe(true);
            else expect(base.cards['c1']!.elements.find((e) => e.elementId === type)).toBeDefined();
          }
        },
      ),
      { numRuns: 150 },
    );
  });

  it('card title, background and frame size commands keep the Stack valid', () => {
    const base = stackWithAllTypes();
    fc.assert(
      fc.property(hex, fc.string({ maxLength: 10 }), fc.integer({ min: 1, max: 4000 }), (bg, title, n) => {
        let s = base;
        for (const c of [
          { type: 'SET_CARD_BACKGROUND', cardId: 'c1', background: bg },
          { type: 'RENAME_CARD', cardId: 'c1', title },
          { type: 'SET_VIEWPORT', width: n, height: n },
        ] as const) {
          const r = applyCommand(s, c, NOW);
          if (r.ok) {
            expect(validateStack(r.value).ok).toBe(true);
            s = r.value;
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});

let n = 0;
async function open(prepare?: (s: StackSession) => void): Promise<StackSession> {
  const storage = createIdbStorage();
  const stackId = `in${++n}`;
  await storage.stacks.save(createStack({ stackId, cardId: 'c1', title: 'T', now: NOW }));
  const r = await createStackSessionFactory({ ...storage, debounceMs: 5 }).open(stackId);
  if (!r.ok) throw new Error(r.error.message);
  prepare?.(r.value);
  return r.value;
}
function add(session: StackSession, type: ElementType, id: string, x = 0): void {
  const d = ELEMENT_DEFAULTS[type];
  const r = session.dispatch({
    type: 'ADD_ELEMENT',
    cardId: 'c1',
    element: {
      elementId: id,
      type,
      name: id,
      properties: { ...d.properties },
      layout: { x, y: 0, width: d.width, height: d.height, zIndex: 0, ...DEFAULT_ELEMENT_PLACEMENT },
      behaviors: [],
    },
  });
  if (!r.ok) throw new Error(r.error.message);
}
function Harness({
  session,
  selected,
  onOpenBehavior,
}: {
  session: StackSession;
  selected: string | undefined;
  onOpenBehavior?: () => void;
}): ReactNode {
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  return (
    <ServicesProvider>
      <CardInspector
        session={session}
        cardId="c1"
        selectedElementId={selected}
        onSelectElement={() => undefined}
        viewport={viewport}
        onViewportChange={setViewport}
        {...(onOpenBehavior ? { onOpenBehavior } : {})}
      />
    </ServicesProvider>
  );
}
const el = (s: StackSession, id: string) =>
  s.getStack().cards['c1']!.elements.find((e) => e.elementId === id)!;

describe('CardInspector', () => {
  it('shows the card section with title, background and frame size when nothing is selected', async () => {
    const session = await open();
    render(<Harness session={session} selected={undefined} />);
    const card = screen.getByLabelText('Card properties');
    await userEvent.clear(within(card).getByLabelText('Title'));
    await userEvent.type(within(card).getByLabelText('Title'), 'Intro');
    await waitFor(() => expect(session.getStack().cards['c1']!.title).toBe('Intro'));
    await userEvent.clear(within(card).getByLabelText('Background'));
    await userEvent.type(within(card).getByLabelText('Background'), '#102030');
    await waitFor(() => expect(session.getStack().cards['c1']!.background).toBe('#102030'));
    await userEvent.click(within(card).getByRole('button', { name: 'Default' }));
    await waitFor(() => expect(session.getStack().cards['c1']!.background).toBeUndefined());
    const w = within(card).getByLabelText('Frame width');
    await userEvent.clear(w);
    await userEvent.type(w, '800');
    await waitFor(() => expect(session.getStack().viewportDefaults.width).toBe(800));
    expect(session.getStack().cards['c1']!.elements).toHaveLength(0);
  });

  it('edits with tabs and keyboard, and the stepper changes the value by one step', async () => {
    const session = await open((s) => add(s, 'shape', 'a'));
    render(<Harness session={session} selected="a" />);
    const panel = screen.getByLabelText('a properties');
    expect(
      within(panel)
        .getAllByRole('tab')
        .map((t) => t.textContent),
    ).toEqual(['Content', 'Layout', 'Appearance', 'Behavior']);
    await userEvent.click(within(panel).getByRole('tab', { name: 'Layout' }));
    const x = within(panel).getByLabelText('X', { exact: true });
    const before = el(session, 'a').layout.x;
    await userEvent.click(within(panel).getByRole('button', { name: 'Increase X' }));
    await waitFor(() => expect(el(session, 'a').layout.x).toBe(before + 1));
    await userEvent.click(within(panel).getByRole('button', { name: 'Decrease X' }));
    await waitFor(() => expect(el(session, 'a').layout.x).toBe(before));
    await userEvent.clear(x);
    await userEvent.type(x, '12');
    await waitFor(() => expect(el(session, 'a').layout.x).toBe(12));
    await userEvent.click(within(panel).getByRole('button', { name: 'Pin bottom right' }));
    await waitFor(() => expect(el(session, 'a').layout.anchor).toBe('bottom-right'));
    expect(within(panel).getByRole('button', { name: 'Pin bottom right' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(within(panel).getByText('Tablet')).toBeTruthy();
    expect(within(panel).getByText('Mobile')).toBeTruthy();
    expect(VIEWPORT_PRESETS.tablet.label).toBe('Tablet');
  });

  it('keeps a rejected value out of the Stack and shows the message with a fix hint', async () => {
    const session = await open((s) => add(s, 'shape', 'a'));
    render(<Harness session={session} selected="a" />);
    const panel = screen.getByLabelText('a properties');
    await userEvent.click(within(panel).getByRole('tab', { name: 'Appearance' }));
    const fill = within(panel).getByLabelText('Fill', { exact: true });
    await userEvent.clear(fill);
    await userEvent.type(fill, 'red;');
    const alert = await within(panel).findByRole('alert');
    expect(alert.textContent).toMatch(/hex color/);
    expect(el(session, 'a').properties['fill']).toBe('#7c5cff');
  });

  it('shows the behavior summary and renders the edit button only when onOpenBehavior is set', async () => {
    const session = await open((s) => {
      add(s, 'button', 'b');
      const r = s.dispatch({
        type: 'UPDATE_BEHAVIOR',
        cardId: 'c1',
        elementId: 'b',
        behaviors: [
          {
            behaviorId: 'x',
            trigger: 'element.click',
            conditions: [],
            actions: [{ type: 'nextCard' }],
            enabled: true,
          },
        ],
      });
      if (!r.ok) throw new Error(r.error.message);
    });
    const { rerender } = render(<Harness session={session} selected="b" />);
    await userEvent.click(screen.getByRole('tab', { name: 'Behavior' }));
    expect(screen.getByText('When clicked: go to the next card.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit behaviors' })).toBeNull();
    let opened = 0;
    rerender(<Harness session={session} selected="b" onOpenBehavior={() => (opened += 1)} />);
    await userEvent.click(screen.getByRole('button', { name: 'Edit behaviors' }));
    expect(opened).toBe(1);
  });

  it('shows an empty state for an element without behaviors', async () => {
    const session = await open((s) => add(s, 'text', 't'));
    render(<Harness session={session} selected="t" />);
    await userEvent.click(screen.getByRole('tab', { name: 'Behavior' }));
    expect(screen.getByText('No behaviors on this element.')).toBeTruthy();
  });
});
