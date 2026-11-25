// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { createStack } from '@ghoststack/domain';
import { createIdbStorage } from '@ghoststack/storage';
import type { StackSession } from '@ghoststack/shared-contracts';
import { ServicesProvider } from '../../app/services';
import { HistoryControls, isEditableTarget, shortcutFor } from './index';
import { createStackSessionFactory } from './session';

afterEach(cleanup);

describe('shortcutFor', () => {
  const k = (key: string, over: object = {}) => ({
    key,
    ctrlKey: true,
    metaKey: false,
    shiftKey: false,
    ...over,
  });
  it('maps undo and redo chords and ignores the rest', () => {
    expect(shortcutFor(k('z'))).toBe('undo');
    expect(shortcutFor(k('z', { shiftKey: true }))).toBe('redo');
    expect(shortcutFor(k('y'))).toBe('redo');
    expect(shortcutFor(k('z', { ctrlKey: false }))).toBeUndefined();
    expect(shortcutFor(k('a'))).toBeUndefined();
  });
  it('treats form fields as editable', () => {
    expect(isEditableTarget(document.createElement('input'))).toBe(true);
    expect(isEditableTarget(document.createElement('button'))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});

describe('HistoryControls', () => {
  async function mount(): Promise<StackSession> {
    const storage = createIdbStorage();
    await storage.stacks.save(
      createStack({ stackId: 'h1', cardId: 'c1', title: 'H', now: '2026-11-26T00:00:00.000Z' }),
    );
    const r = await createStackSessionFactory({ ...storage, debounceMs: 10 }).open('h1');
    if (!r.ok) throw new Error(r.error.message);
    render(
      <ServicesProvider>
        <HistoryControls
          session={r.value}
          cardId="c1"
          selectedElementId={undefined}
          onSelectElement={() => undefined}
          viewport="desktop"
          onViewportChange={() => undefined}
        />
      </ServicesProvider>,
    );
    return r.value;
  }

  it('enables undo after an edit, undoes it, and ignores Ctrl+Z inside inputs', async () => {
    const session = await mount();
    const undo = screen.getByRole('button', { name: 'Undo' });
    expect((undo as HTMLButtonElement).disabled).toBe(true);
    session.dispatch({ type: 'RENAME_STACK', title: 'Edited' });
    await waitFor(() =>
      expect((screen.getByRole('button', { name: 'Undo' }) as HTMLButtonElement).disabled).toBe(false),
    );
    const input = document.body.appendChild(document.createElement('input'));
    input.focus();
    await userEvent.keyboard('{Control>}z{/Control}');
    expect(session.getStack().title).toBe('Edited');
    input.blur();
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(session.getStack().title).toBe('H');
    await userEvent.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');
    expect(session.getStack().title).toBe('Edited');
  });

  it('saves and lists a checkpoint, then restores it after confirmation', async () => {
    const session = await mount();
    await userEvent.click(screen.getByRole('button', { name: 'Checkpoints' }));
    expect(await screen.findByText(/No checkpoints yet/)).toBeTruthy();
    await userEvent.type(screen.getByLabelText('Checkpoint name'), 'v1');
    await userEvent.click(screen.getByRole('button', { name: 'Save checkpoint' }));
    expect(await screen.findByText(/^v1/)).toBeTruthy();
    session.dispatch({ type: 'RENAME_STACK', title: 'Later' });
    await userEvent.click(screen.getByRole('button', { name: 'Restore v1' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm restore' }));
    await waitFor(() => expect(session.getStack().title).toBe('H'));
    session.undo();
    expect(session.getStack().title).toBe('Later');
  });
});
