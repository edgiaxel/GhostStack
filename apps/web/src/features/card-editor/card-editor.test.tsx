// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { createStack } from '@ghoststack/domain';
import { createIdbStorage } from '@ghoststack/storage';
import type { StackSession, ViewportPresetId } from '@ghoststack/shared-contracts';
import { ServicesProvider } from '../../app/services';
import { createStackSessionFactory } from '../history/session';
import { CardEditorCanvas, CardInspector } from './index';

afterEach(cleanup);

let n = 0;
async function open(): Promise<StackSession> {
  const storage = createIdbStorage();
  const stackId = `ce${++n}`;
  await storage.stacks.save(
    createStack({ stackId, cardId: 'c1', title: 'T', now: '2026-11-26T00:00:00.000Z' }),
  );
  const r = await createStackSessionFactory({ ...storage, debounceMs: 5 }).open(stackId);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

function Harness({ session }: { session: StackSession }): ReactNode {
  const [sel, setSel] = useState<string | undefined>();
  const [viewport, setViewport] = useState<ViewportPresetId>('desktop');
  const props = {
    session,
    cardId: 'c1',
    selectedElementId: sel,
    onSelectElement: setSel,
    viewport,
    onViewportChange: setViewport,
  };
  return (
    <ServicesProvider>
      <CardEditorCanvas {...props} />
      <CardInspector {...props} />
    </ServicesProvider>
  );
}

const els = (s: StackSession) => s.getStack().cards['c1']!.elements;

describe('card editor', () => {
  it('shows empty states, adds every element type, and selects the new element', async () => {
    const session = await open();
    render(<Harness session={session} />);
    expect(screen.getByText(/This card is empty/)).toBeTruthy();
    for (const type of ['text', 'button', 'input', 'image', 'shape', 'line']) {
      await userEvent.click(screen.getByRole('button', { name: `Add ${type}` }));
    }
    await waitFor(() =>
      expect(els(session).map((e) => e.type)).toEqual(['text', 'button', 'input', 'image', 'shape', 'line']),
    );
    expect(els(session).map((e) => e.layout.zIndex)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(screen.getByRole('button', { name: 'Line 1 (line)' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('No image chosen. Pick a file in the inspector.')).toBeTruthy();
  });

  it('moves and resizes with the keyboard and deletes with Delete', async () => {
    const session = await open();
    render(<Harness session={session} />);
    await userEvent.click(screen.getByRole('button', { name: 'Add shape' }));
    const el = await screen.findByRole('button', { name: 'Shape 1 (shape)' });
    el.focus();
    const { x, y, width } = els(session)[0]!.layout;
    await userEvent.keyboard('{ArrowRight}{ArrowDown}');
    await waitFor(() => expect(els(session)[0]!.layout).toMatchObject({ x: x + 1, y: y + 1 }));
    await userEvent.keyboard('{Shift>}{ArrowRight}{/Shift}');
    expect(els(session)[0]!.layout.x).toBe(x + 11);
    await userEvent.keyboard('{Alt>}{ArrowRight}{/Alt}');
    expect(els(session)[0]!.layout.width).toBe(width + 1);
    await userEvent.keyboard('{Delete}');
    await waitFor(() => expect(els(session)).toHaveLength(0));
    expect(session.undo()).toBe(true);
    expect(els(session)).toHaveLength(1);
  });

  it('edits properties through the inspector and shows the domain message for bad values', async () => {
    const session = await open();
    render(<Harness session={session} />);
    await userEvent.click(screen.getByRole('button', { name: 'Add text' }));
    const inspector = await screen.findByLabelText('Text 1 properties');
    const text = within(inspector).getByLabelText('Text');
    await userEvent.clear(text);
    await userEvent.type(text, 'Hello');
    await waitFor(() => expect(els(session)[0]!.properties['text']).toBe('Hello'));

    await userEvent.click(within(inspector).getByRole('tab', { name: 'Appearance' }));
    const color = within(inspector).getByLabelText('Text color');
    await userEvent.clear(color);
    await userEvent.type(color, 'red;x');
    expect((await within(inspector).findAllByRole('alert'))[0]?.textContent).toMatch(/color|hex/i);
    expect(els(session)[0]!.properties['color']).toBeUndefined();
    await userEvent.clear(color);
    await userEvent.type(color, '#ff0000');
    await waitFor(() => expect(els(session)[0]!.properties['color']).toBe('#ff0000'));
    await userEvent.click(within(inspector).getByRole('button', { name: 'Default' }));
    await waitFor(() => expect(els(session)[0]!.properties['color']).toBeUndefined());

    await userEvent.click(within(inspector).getByRole('tab', { name: 'Layout' }));
    await userEvent.selectOptions(within(inspector).getByLabelText('Anchor'), 'bottom-right');
    await waitFor(() => expect(els(session)[0]!.layout.anchor).toBe('bottom-right'));
  });

  it('locks editing outside the design viewport and explains why', async () => {
    const session = await open();
    render(<Harness session={session} />);
    await userEvent.click(screen.getByRole('button', { name: 'Add button' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Tablet' }));
    expect((screen.getByRole('button', { name: 'Add text' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('note').textContent).toContain('Previewing anchoring at Tablet');
    const el = screen.getByRole('button', { name: 'Button 1 (button)' });
    el.focus();
    const before = els(session)[0]!.layout.x;
    await userEvent.keyboard('{ArrowRight}');
    expect(els(session)[0]!.layout.x).toBe(before);
  });

  it('creates elements that scale, and applies scaling to older elements in one undo step', async () => {
    const session = await open();
    render(<Harness session={session} />);
    await userEvent.click(screen.getByRole('button', { name: 'Add text' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add shape' }));
    await waitFor(() => expect(els(session)).toHaveLength(2));
    expect(els(session).map((e) => [e.layout.anchor, e.layout.scaleMode])).toEqual([
      ['top-left', 'scale'],
      ['top-left', 'scale'],
    ]);
    const apply = screen.getByRole('button', { name: 'Apply scaling to all' });
    expect((apply as HTMLButtonElement).disabled).toBe(true);
    for (const e of els(session)) {
      const r = session.dispatch({
        type: 'UPDATE_ELEMENT',
        cardId: 'c1',
        elementId: e.elementId,
        patch: { layout: { scaleMode: 'fixed' } },
      });
      expect(r.ok).toBe(true);
    }
    await waitFor(() => expect((apply as HTMLButtonElement).disabled).toBe(false));
    await userEvent.click(apply);
    await waitFor(() => expect(els(session).every((e) => e.layout.scaleMode === 'scale')).toBe(true));
    session.undo();
    expect(els(session).map((e) => e.layout.scaleMode)).toEqual(['fixed', 'fixed']);
  });

  it('paints the card background on the stage', async () => {
    const session = await open();
    session.dispatch({ type: 'SET_CARD_BACKGROUND', cardId: 'c1', background: '#112233' });
    render(<Harness session={session} />);
    expect(screen.getByTestId('card-stage').style.background).toBe('rgb(17, 34, 51)');
  });
});
