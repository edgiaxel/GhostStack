// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createStack, applyCommand } from '@ghoststack/domain';
import { CardNavigator } from './CardNavigator';

function twoCards() {
  const s0 = createStack({ stackId: 's', cardId: 'a', title: 'T', now: '2026-01-01T00:00:00.000Z' });
  const r = applyCommand(s0, { type: 'ADD_CARD', cardId: 'b', title: 'Second' }, '2026-01-01T00:00:00.000Z');
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

function setup(over: Partial<Parameters<typeof CardNavigator>[0]> = {}) {
  const props = {
    stack: twoCards(),
    selectedCardId: 'a',
    busy: false,
    referenceCount: () => 0,
    onSelect: vi.fn(),
    onAdd: vi.fn(),
    onRename: vi.fn(),
    onDuplicate: vi.fn(),
    onMove: vi.fn(),
    onDelete: vi.fn(),
    ...over,
  };
  render(<CardNavigator {...props} />);
  return props;
}

afterEach(cleanup);

describe('CardNavigator', () => {
  it('shows a thumbnail per card and the entry badge on the entry card only', () => {
    setup();
    expect(screen.getAllByText('Entry')).toHaveLength(1);
    expect(document.querySelectorAll('.gs-navigator-thumb svg')).toHaveLength(2);
  });

  it('names the references before deleting and deletes only after confirmation', () => {
    const p = setup({ referenceCount: (id) => (id === 'b' ? 2 : 0) });
    fireEvent.click(screen.getByRole('button', { name: 'Delete Second' }));
    expect(screen.getByRole('alertdialog').textContent).toContain('2 behaviors navigate to it');
    expect(p.onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));
    expect(p.onDelete).toHaveBeenCalledWith('b');
  });

  it('keeps the keyboard move buttons and disables them at the ends', () => {
    const p = setup();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Move Card 1 up' }).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Move Card 1 down' }));
    expect(p.onMove).toHaveBeenCalledWith('a', 1);
  });

  it('drag and drop onto another card moves the dragged card one step toward it', () => {
    const p = setup();
    const items = screen.getAllByRole('listitem');
    fireEvent.dragStart(items[0]!, { dataTransfer: { setData: () => undefined, effectAllowed: '' } });
    fireEvent.dragOver(items[1]!);
    fireEvent.drop(items[1]!);
    expect(p.onMove).toHaveBeenCalledWith('a', 1);
  });
});
