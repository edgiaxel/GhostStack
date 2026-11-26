// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { createStack } from '@ghoststack/domain';
import { createIdbStorage } from '@ghoststack/storage';
import type { StackSession } from '@ghoststack/shared-contracts';
import { createStackSessionFactory } from '../history/session';
import { BehaviorEditorPanel } from './index';

afterEach(cleanup);

async function mount(elementId?: string): Promise<StackSession> {
  const storage = createIdbStorage();
  const base = createStack({ stackId: 'b1', cardId: 'c1', title: 'B', now: '2026-11-26T00:00:00.000Z' });
  await storage.stacks.save({
    ...base,
    stateSchema: { score: { type: 'number', initial: 0 } },
    cards: {
      c1: {
        cardId: 'c1',
        title: 'Card 1',
        behaviors: [],
        elements: [
          {
            elementId: 'btn',
            type: 'button',
            name: 'Go',
            properties: { text: 'Go' },
            layout: { x: 0, y: 0, width: 10, height: 10, zIndex: 0 },
            behaviors: [],
          },
        ],
      },
    },
  });
  const r = await createStackSessionFactory({ ...storage, debounceMs: 5 }).open('b1');
  if (!r.ok) throw new Error(r.error.message);
  render(
    <BehaviorEditorPanel
      session={r.value}
      cardId="c1"
      selectedElementId={elementId}
      onSelectElement={() => undefined}
      viewport="desktop"
      onViewportChange={() => undefined}
    />,
  );
  return r.value;
}

describe('BehaviorEditorPanel blocks', () => {
  it('shows an empty state, then adds a behavior and an action through UPDATE_BEHAVIOR', async () => {
    const session = await mount('btn');
    expect(screen.getByText(/No behaviors yet/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Add behavior' }));
    const el = () => session.getStack().cards['c1']!.elements[0]!;
    await waitFor(() => expect(el().behaviors).toHaveLength(1));
    expect(el().behaviors[0]).toMatchObject({ trigger: 'element.click', enabled: true, actions: [] });

    await userEvent.selectOptions(screen.getByLabelText('Add action to Behavior 1'), 'setState');
    await waitFor(() => expect(el().behaviors[0]?.actions).toHaveLength(1));
    expect(el().behaviors[0]?.actions[0]).toMatchObject({ type: 'setState', key: 'score' });

    await userEvent.selectOptions(screen.getByLabelText('Behavior 1 action 1 value kind'), 'binary');
    await waitFor(() =>
      expect(el().behaviors[0]?.actions[0]).toMatchObject({ value: { kind: 'binary', op: '==' } }),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Remove Behavior 1' }));
    await waitFor(() => expect(el().behaviors).toHaveLength(0));
  });

  it('offers only the card trigger for the card and writes card behaviors', async () => {
    const session = await mount();
    await userEvent.click(screen.getByRole('button', { name: 'Add behavior' }));
    await waitFor(() => expect(session.getStack().cards['c1']!.behaviors).toHaveLength(1));
    expect(session.getStack().cards['c1']!.behaviors[0]?.trigger).toBe('card.enter');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toContain('When the card opens');
  });

  it('declares variables and shows the domain message when a used variable is deleted', async () => {
    const session = await mount();
    await userEvent.click(screen.getByRole('tab', { name: 'Variables' }));
    await userEvent.type(screen.getByLabelText('New variable'), 'lives');
    await userEvent.click(screen.getByRole('button', { name: 'Add variable' }));
    await waitFor(() =>
      expect(session.getStack().stateSchema['lives']).toEqual({ type: 'number', initial: 0 }),
    );

    await userEvent.click(screen.getByRole('tab', { name: 'Blocks' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add behavior' }));
    await userEvent.selectOptions(screen.getByLabelText('Add action to Behavior 1'), 'setState');
    await waitFor(() => expect(session.getStack().cards['c1']!.behaviors[0]?.actions).toHaveLength(1));
    await userEvent.click(screen.getByRole('tab', { name: 'Variables' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete variable score' }));
    expect((await screen.findByRole('alert')).textContent).toContain('score');
    expect(session.getStack().stateSchema['score']).toBeDefined();
  });
});

describe('BehaviorEditorPanel lists', () => {
  it('declares a list variable, edits its items and builds list blocks', async () => {
    const session = await mount('btn');
    await userEvent.click(screen.getByRole('tab', { name: 'Variables' }));
    await userEvent.type(screen.getByLabelText('New variable'), 'items');
    await userEvent.selectOptions(screen.getByLabelText('New variable type'), 'list');
    await userEvent.click(screen.getByRole('button', { name: 'Add variable' }));
    await waitFor(() =>
      expect(session.getStack().stateSchema['items']).toEqual({ type: 'list', initial: [] }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Add item to items' }));
    await waitFor(() => expect(session.getStack().stateSchema['items']?.initial).toEqual(['']));
    await userEvent.type(screen.getByLabelText('items item 0'), 'milk');
    await waitFor(() => expect(session.getStack().stateSchema['items']?.initial).toEqual(['milk']));
    await userEvent.click(screen.getByRole('button', { name: 'Remove items item 0' }));
    await waitFor(() => expect(session.getStack().stateSchema['items']?.initial).toEqual([]));

    await userEvent.click(screen.getByRole('tab', { name: 'Blocks' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add behavior' }));
    const el = () => session.getStack().cards['c1']!.elements[0]!;
    await userEvent.selectOptions(screen.getByLabelText('Add action to Behavior 1'), 'listAdd');
    await waitFor(() =>
      expect(el().behaviors[0]?.actions[0]).toMatchObject({ type: 'listAdd', key: 'items' }),
    );
    await userEvent.selectOptions(screen.getByLabelText('Add action to Behavior 1'), 'nextCard');
    await userEvent.selectOptions(screen.getByLabelText('Behavior 1 action 1 value kind'), 'listJoin');
    await waitFor(() =>
      expect(el().behaviors[0]?.actions[0]).toMatchObject({
        value: { kind: 'listJoin', key: 'items', separator: ', ' },
      }),
    );
    await userEvent.selectOptions(screen.getByLabelText('Behavior 1 action 1 value separator'), '\n');
    await waitFor(() => expect(el().behaviors[0]?.actions[0]).toMatchObject({ value: { separator: '\n' } }));
    expect(
      screen.getByText(/When Go is clicked, add items as text to items, then go to the next card/),
    ).toBeTruthy();
  });

  it('disables list actions until a list variable exists, and collapses a behavior', async () => {
    await mount('btn');
    await userEvent.click(screen.getByRole('button', { name: 'Add behavior' }));
    const option = screen.getByRole('option', { name: /Add to list/ }) as HTMLOptionElement;
    expect(option.disabled).toBe(true);
    const toggle = screen.getByRole('button', { name: 'Collapse Behavior 1' });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    await userEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Expand Behavior 1' }).getAttribute('aria-expanded')).toBe(
      'false',
    );
    const body = screen.getByLabelText('Add action to Behavior 1').closest('.gs-beh-body') as HTMLElement;
    expect(body.hidden).toBe(true);
  });
});
