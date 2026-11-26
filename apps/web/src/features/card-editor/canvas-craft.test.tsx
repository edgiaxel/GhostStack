// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createStack } from '@ghoststack/domain';
import { createIdbStorage } from '@ghoststack/storage';
import { ELEMENT_DEFAULTS } from '@ghoststack/shared-contracts';
import type { Asset, StackSession, ViewportPresetId } from '@ghoststack/shared-contracts';
import { ServicesProvider } from '../../app/services';
import { createStackSessionFactory } from '../history/session';
import { AssetPanel } from './AssetPanel';
import { elementLabel, visibleText } from './ElementView';
import { CardEditorCanvas } from './index';

afterEach(cleanup);
beforeAll(() => {
  URL.createObjectURL = () => 'blob:test';
  URL.revokeObjectURL = () => undefined;
  // jsdom has no pointer capture. The real browser calls these on every drag.
  Element.prototype.setPointerCapture = () => undefined;
  Element.prototype.releasePointerCapture = () => undefined;
  Element.prototype.hasPointerCapture = () => false;
});

let n = 0;
const storage = createIdbStorage();
async function open(): Promise<StackSession> {
  const stackId = `cc${++n}`;
  await storage.stacks.save(
    createStack({ stackId, cardId: 'c1', title: 'T', now: '2026-11-26T00:00:00.000Z' }),
  );
  const r = await createStackSessionFactory({ ...storage, debounceMs: 5 }).open(stackId);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}
const addText = (s: StackSession, id: string, text: string, x: number): void => {
  const r = s.dispatch({
    type: 'ADD_ELEMENT',
    cardId: 'c1',
    element: {
      elementId: id,
      type: 'text',
      name: id,
      properties: { ...ELEMENT_DEFAULTS.text.properties, text },
      layout: { x, y: 10, width: 100, height: 30, zIndex: 0 },
      behaviors: [],
    },
  });
  if (!r.ok) throw new Error(r.error.message);
};
const ids = (s: StackSession): string[] => s.getStack().cards['c1']!.elements.map((e) => e.elementId);

function Harness({ session }: { session: StackSession }): ReactNode {
  const [sel, setSel] = useState<string[]>([]);
  const [viewport, setViewport] = useState<ViewportPresetId>('desktop');
  return (
    <ServicesProvider>
      <CardEditorCanvas
        session={session}
        cardId="c1"
        selectedElementId={sel.length === 1 ? sel[0] : undefined}
        onSelectElement={(id) => setSel(id ? [id] : [])}
        selectedIds={sel}
        onSelectionChange={setSel}
        viewport={viewport}
        onViewportChange={setViewport}
      />
    </ServicesProvider>
  );
}

describe('accessible names', () => {
  it('start with the visible text so the name contains what a sighted user reads', () => {
    const base = {
      elementId: 'a',
      name: 'Title',
      layout: { x: 0, y: 0, width: 1, height: 1, zIndex: 0 },
      behaviors: [],
    };
    const text = { ...base, type: 'text' as const, properties: { text: ' Hello \n world ' } };
    expect(visibleText(text)).toBe('Hello world');
    expect(elementLabel(text)).toBe('Hello world, Title (text)');
    const shape = { ...base, type: 'shape' as const, properties: {} };
    expect(elementLabel(shape, true)).toBe('Title (shape), hidden');
    const input = { ...base, type: 'input' as const, properties: { placeholder: 'Your name' } };
    expect(elementLabel(input)).toBe('Your name, Title (input)');
  });
});

describe('canvas selection and editing', () => {
  it('selects several elements, moves them with the arrow keys as one undo step and deletes them together', async () => {
    const session = await open();
    addText(session, 'a', 'Alpha', 10);
    addText(session, 'b', 'Beta', 200);
    render(<Harness session={session} />);
    const a = screen.getByRole('button', { name: /Alpha, a \(text\)/ });
    const b = screen.getByRole('button', { name: /Beta, b \(text\)/ });
    act(() => a.focus());
    expect(a.getAttribute('aria-pressed')).toBe('true');
    act(() => b.focus());
    // Focus alone replaces the selection, Shift+Space adds to it.
    expect(a.getAttribute('aria-pressed')).toBe('false');
    act(() => a.focus());
    fireEvent.keyDown(b, { key: ' ', shiftKey: true });
    await waitFor(() => expect(b.getAttribute('aria-pressed')).toBe('true'));
    expect(a.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('selection-bounds')).toBeTruthy();

    const before = session.getStack();
    fireEvent.keyDown(a, { key: 'ArrowRight', shiftKey: true });
    fireEvent.keyDown(a, { key: 'ArrowRight', shiftKey: true });
    const xs = session.getStack().cards['c1']!.elements.map((e) => e.layout.x);
    expect(xs).toEqual([30, 220]);
    expect(session.undo()).toBe(true);
    expect(session.getStack().cards['c1']).toEqual(before.cards['c1']);

    fireEvent.keyDown(a, { key: 'Delete' });
    expect(ids(session)).toEqual([]);
    expect(session.undo()).toBe(true);
    expect(ids(session)).toEqual(['a', 'b']);
  });

  it('edits text in place: Enter commits, Escape cancels', async () => {
    const session = await open();
    addText(session, 'a', 'Alpha', 10);
    render(<Harness session={session} />);
    const el = screen.getByRole('button', { name: /Alpha, a \(text\)/ });
    act(() => el.focus());
    fireEvent.keyDown(el, { key: 'F2' });
    const box = await screen.findByRole('textbox', { name: 'Edit text of a' });
    await userEvent.clear(box);
    await userEvent.type(box, 'Renamed{Enter}');
    expect(session.getStack().cards['c1']!.elements[0]!.properties['text']).toBe('Renamed');
    expect(screen.queryByRole('textbox', { name: 'Edit text of a' })).toBeNull();
    expect(screen.getByRole('button', { name: /Renamed, a \(text\)/ })).toBeTruthy();

    fireEvent.keyDown(screen.getByRole('button', { name: /Renamed, a \(text\)/ }), { key: 'F2' });
    const again = await screen.findByRole('textbox', { name: 'Edit text of a' });
    await userEvent.type(again, 'XYZ{Escape}');
    expect(session.getStack().cards['c1']!.elements[0]!.properties['text']).toBe('Renamed');
  });
});

describe('asset panel', () => {
  const bytes = new Uint8Array([137, 80, 78, 71]);
  const asset = (assetId: string): Asset => ({
    assetId,
    relativePath: `${assetId}-pic.png`,
    mimeType: 'image/png',
    byteSize: bytes.length,
    checksum: 'x',
  });

  it('shows an empty state, lists usage, refuses to delete a used asset and removes orphans with their bytes', async () => {
    const session = await open();
    render(
      <ServicesProvider>
        <AssetPanel session={session} open onClose={() => undefined} />
      </ServicesProvider>,
    );
    expect(screen.getByText('No assets in this stack.')).toBeTruthy();
    cleanup();

    for (const id of ['used', 'orphan']) {
      await storage.assets.put(session.stackId, asset(id), bytes);
      session.dispatch({ type: 'REGISTER_ASSET', asset: asset(id) });
    }
    session.dispatch({
      type: 'ADD_ELEMENT',
      cardId: 'c1',
      element: {
        elementId: 'img',
        type: 'image',
        name: 'Image 1',
        properties: { ...ELEMENT_DEFAULTS.image.properties },
        layout: { x: 0, y: 0, width: 10, height: 10, zIndex: 0 },
        assetId: 'used',
        behaviors: [],
      },
    });
    render(
      <ServicesProvider>
        <AssetPanel session={session} open onClose={() => undefined} />
      </ServicesProvider>,
    );
    const rows = screen.getAllByTestId('asset-row');
    expect(rows).toHaveLength(2);
    const usage = rows.map((r) => within(r).getByTestId('asset-usage').textContent);
    expect(usage.sort()).toEqual(['Not used', 'Used by 1 element']);
    const deleteButtons = screen.getAllByRole('button', { name: /^Delete / });
    expect(deleteButtons.filter((b) => (b as HTMLButtonElement).disabled)).toHaveLength(1);

    await userEvent.click(screen.getByRole('button', { name: 'Remove 1 unused' }));
    await waitFor(() => expect(Object.keys(session.getStack().assetRegistry)).toEqual(['used']));
    expect(await storage.assets.get(session.stackId, 'orphan')).toBeUndefined();
    expect(await storage.assets.get(session.stackId, 'used')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Remove unused' })).toHaveProperty('disabled', true);
  });

  it('replaces a file under the same id and updates the registry', async () => {
    const session = await open();
    await storage.assets.put(session.stackId, asset('pic'), bytes);
    session.dispatch({ type: 'REGISTER_ASSET', asset: asset('pic') });
    render(
      <ServicesProvider>
        <AssetPanel session={session} open onClose={() => undefined} />
      </ServicesProvider>,
    );
    const input = screen.getByLabelText('Replacement image file') as HTMLInputElement;
    await userEvent.click(screen.getByRole('button', { name: 'Replace file of pic.png' }));
    const file = new File([new Uint8Array([1, 2, 3, 4, 5])], 'new.png', { type: 'image/png' });
    await userEvent.upload(input, file);
    await waitFor(() => expect(session.getStack().assetRegistry['pic']!.byteSize).toBe(5));
    expect(session.getStack().assetRegistry['pic']!.relativePath).toBe('pic-new.png');
    expect((await storage.assets.get(session.stackId, 'pic'))!.length).toBe(5);
  });

  it('rejects a replacement that is not an image and says why', async () => {
    const session = await open();
    await storage.assets.put(session.stackId, asset('pic'), bytes);
    session.dispatch({ type: 'REGISTER_ASSET', asset: asset('pic') });
    render(
      <ServicesProvider>
        <AssetPanel session={session} open onClose={() => undefined} />
      </ServicesProvider>,
    );
    const input = screen.getByLabelText('Replacement image file') as HTMLInputElement;
    await userEvent.click(screen.getByRole('button', { name: 'Replace file of pic.png' }));
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'a.txt', { type: 'text/plain' })] },
    });
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Choose a PNG, JPEG, GIF or WebP image.',
    );
    expect(session.getStack().assetRegistry['pic']!.byteSize).toBe(4);
  });
});
