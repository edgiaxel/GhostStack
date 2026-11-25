import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createStack } from '@ghoststack/domain';
import { createIdbStorage } from '@ghoststack/storage';
import { createPassthroughSessionFactory } from './passthroughSession';

const now = '2026-11-26T00:00:00.000Z';

describe('passthrough session', () => {
  it('reports STACK_NOT_FOUND for an unknown id', async () => {
    const { stacks } = createIdbStorage();
    const r = await createPassthroughSessionFactory(stacks).open('nope');
    expect(r).toMatchObject({ ok: false, error: { code: 'STACK_NOT_FOUND' } });
  });

  it('validates, applies and persists commands to IndexedDB', async () => {
    const { stacks } = createIdbStorage();
    await stacks.save(createStack({ stackId: 's1', cardId: 'c1', title: 'One', now }));
    const opened = await createPassthroughSessionFactory(stacks).open('s1');
    if (!opened.ok) throw new Error(opened.error.message);
    const session = opened.value;

    const notified: string[] = [];
    session.subscribe(() => notified.push(session.getStatus().saveState));

    expect(session.dispatch({ type: 'RENAME_STACK', title: '' }).ok).toBe(false);
    expect(session.getStack().title).toBe('One');

    expect(session.dispatch({ type: 'RENAME_STACK', title: 'Two' }).ok).toBe(true);
    await session.flush();
    expect(session.getStatus().saveState).toBe('saved');
    expect((await stacks.get('s1'))?.title).toBe('Two');
    expect(notified).toContain('saving');
  });

  it('restores a snapshot of the same Stack and rejects a foreign one', async () => {
    const { stacks } = createIdbStorage();
    const original = createStack({ stackId: 's2', cardId: 'c1', title: 'Original', now });
    await stacks.save(original);
    const opened = await createPassthroughSessionFactory(stacks).open('s2');
    if (!opened.ok) throw new Error(opened.error.message);
    const session = opened.value;
    session.dispatch({ type: 'RENAME_STACK', title: 'Changed' });

    expect(session.restore({ ...original, stackId: 'other' }).ok).toBe(false);
    expect(session.restore(original).ok).toBe(true);
    await session.flush();
    expect((await stacks.get('s2'))?.title).toBe('Original');
  });
});
