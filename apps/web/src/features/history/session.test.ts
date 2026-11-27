import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { createStack, validateStack } from '@ghoststack/domain';
import { createIdbStorage } from '@ghoststack/storage';
import type { ProjectCommand, StackSession } from '@ghoststack/shared-contracts';
import { createStackSessionFactory, recoveryId } from './session';

let n = 0;
const t0 = '2026-11-26T00:00:00.000Z';
let tick = 0;
const clock = (): string => new Date(Date.parse(t0) + ++tick * 1000).toISOString();

async function setup(debounceMs = 50) {
  const storage = createIdbStorage();
  const stackId = `s${++n}`;
  await storage.stacks.save(createStack({ stackId, cardId: 'c1', title: 'One', now: t0 }));
  const factory = createStackSessionFactory({ ...storage, debounceMs, now: clock });
  const open = async (): Promise<StackSession> => {
    const r = await factory.open(stackId);
    if (!r.ok) throw new Error(r.error.message);
    return r.value;
  };
  return { ...storage, stackId, open };
}

beforeEach(() => {
  // fake-indexeddb schedules its work with setImmediate. Leaving it real keeps storage calls from
  // starving under load (they used to time out on busy machines and CI); the debounce uses setTimeout.
  vi.useFakeTimers({
    shouldAdvanceTime: true,
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
  });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('open', () => {
  it('reports STACK_NOT_FOUND', async () => {
    const storage = createIdbStorage();
    const r = await createStackSessionFactory(storage).open('missing');
    expect(r).toMatchObject({ ok: false, error: { code: 'STACK_NOT_FOUND' } });
  });
});

describe('dispatch and autosave', () => {
  it('rejects invalid commands without recording or dirtying', async () => {
    const { open } = await setup();
    const s = await open();
    expect(s.dispatch({ type: 'RENAME_STACK', title: ' ' }).ok).toBe(false);
    expect(s.getStatus()).toMatchObject({ saveState: 'saved', canUndo: false });
  });

  it('debounces the save and ends saved', async () => {
    const { open, stacks, stackId } = await setup(50);
    const s = await open();
    s.dispatch({ type: 'RENAME_STACK', title: 'A' });
    s.dispatch({ type: 'RENAME_STACK', title: 'B' });
    expect(s.getStatus().saveState).toBe('dirty');
    expect((await stacks.get(stackId))?.title).toBe('One');
    await vi.advanceTimersByTimeAsync(80);
    await s.flush();
    expect(s.getStatus().saveState).toBe('saved');
    expect((await stacks.get(stackId))?.title).toBe('B');
  });

  it('flush saves immediately', async () => {
    const { open, stacks, stackId } = await setup(100000);
    const s = await open();
    s.dispatch({ type: 'RENAME_STACK', title: 'Now' });
    await s.flush();
    expect((await stacks.get(stackId))?.title).toBe('Now');
  });

  it('keeps data on a failed save and retries on flush', async () => {
    const storage = createIdbStorage();
    await storage.stacks.save(createStack({ stackId: 'sf', cardId: 'c1', title: 'One', now: t0 }));
    let fail = true;
    const stacks = {
      ...storage.stacks,
      save: async (st: Parameters<typeof storage.stacks.save>[0]) => {
        if (fail) throw new Error('disk full');
        return storage.stacks.save(st);
      },
    };
    const r = await createStackSessionFactory({ ...storage, stacks, debounceMs: 10, now: clock }).open('sf');
    if (!r.ok) throw new Error('open');
    r.value.dispatch({ type: 'RENAME_STACK', title: 'Kept' });
    await r.value.flush();
    expect(r.value.getStatus()).toMatchObject({ saveState: 'error', error: 'disk full' });
    expect(r.value.getStack().title).toBe('Kept');
    fail = false;
    await r.value.flush();
    expect(r.value.getStatus().saveState).toBe('saved');
    expect((await storage.stacks.get('sf'))?.title).toBe('Kept');
  });
});

describe('undo and redo', () => {
  it('walks back and forward and clears redo on a new edit', async () => {
    const { open } = await setup();
    const s = await open();
    s.dispatch({ type: 'RENAME_STACK', title: 'A' });
    s.dispatch({ type: 'RENAME_STACK', title: 'B' });
    expect(s.getStatus()).toMatchObject({ canUndo: true, canRedo: false });
    expect(s.undo()).toBe(true);
    expect(s.getStack().title).toBe('A');
    expect(s.getStatus().canRedo).toBe(true);
    expect(s.redo()).toBe(true);
    expect(s.getStack().title).toBe('B');
    s.undo();
    s.dispatch({ type: 'RENAME_STACK', title: 'C' });
    expect(s.redo()).toBe(false);
    expect(s.undo()).toBe(true);
    expect(s.undo()).toBe(true);
    expect(s.undo()).toBe(false);
    expect(s.getStack().title).toBe('One');
  });

  it('collapses same-key dispatches into one step', async () => {
    const { open } = await setup();
    const s = await open();
    for (const title of ['a', 'ab', 'abc'])
      s.dispatch({ type: 'RENAME_STACK', title }, { coalesceKey: 'title' });
    s.dispatch({ type: 'RENAME_STACK', title: 'x' }, { coalesceKey: 'other' });
    s.undo();
    expect(s.getStack().title).toBe('abc');
    s.undo();
    expect(s.getStack().title).toBe('One');
    expect(s.undo()).toBe(false);
  });

  it('bounds the history to 100 steps', async () => {
    const { open } = await setup();
    const s = await open();
    for (let i = 0; i < 130; i++) s.dispatch({ type: 'RENAME_STACK', title: `t${i}` });
    let steps = 0;
    while (s.undo()) steps++;
    expect(steps).toBe(100);
  });

  it('restore is one undoable step and rejects foreign snapshots', async () => {
    const { open, stackId } = await setup();
    const s = await open();
    const original = s.getStack();
    s.dispatch({ type: 'RENAME_STACK', title: 'Changed' });
    expect(s.restore({ ...original, stackId: 'other' }).ok).toBe(false);
    expect(s.restore(original).ok).toBe(true);
    expect(s.getStack().title).toBe('One');
    s.undo();
    expect(s.getStack().title).toBe('Changed');
    expect(s.stackId).toBe(stackId);
  });

  it('undo and redo return to the original and final Stacks for any valid sequence', async () => {
    const { open } = await setup();
    const commandArb = fc.oneof(
      fc
        .string({ minLength: 1, maxLength: 8 })
        .filter((x) => x.trim().length > 0)
        .map((title): ProjectCommand => ({ type: 'RENAME_STACK', title })),
      fc.constant<ProjectCommand>({ type: 'ADD_CARD', cardId: '', title: 'Card' }),
    );
    await fc.assert(
      fc.asyncProperty(fc.array(commandArb, { maxLength: 12 }), async (cmds) => {
        const s = await open();
        const start = s.getStack();
        let i = 0;
        for (const c of cmds) {
          const cmd = c.type === 'ADD_CARD' ? { ...c, cardId: `card-${i++}` } : c;
          s.dispatch(cmd);
          expect(validateStack(s.getStack()).ok).toBe(true);
        }
        const end = s.getStack();
        while (s.undo());
        expect({ ...s.getStack(), updatedAt: '' }).toEqual({ ...start, updatedAt: '' });
        while (s.redo());
        expect({ ...s.getStack(), updatedAt: '' }).toEqual({ ...end, updatedAt: '' });
        s.dispose();
      }),
      { numRuns: 25 },
    );
  });
});

describe('recovery', () => {
  it('restores edits from an abandoned session', async () => {
    const { open, stacks, stackId } = await setup(100000);
    const first = await open();
    first.dispatch({ type: 'RENAME_STACK', title: 'Unsaved' });
    await vi.advanceTimersByTimeAsync(10);
    await new Promise((r) => setTimeout(r, 30));
    expect((await stacks.get(stackId))?.title).toBe('One');

    const second = await open();
    expect(second.getStack().title).toBe('Unsaved');
    expect(second.getStatus().recovered).toBe(true);
    await second.flush();
    expect((await stacks.get(stackId))?.title).toBe('Unsaved');
    expect(await createIdbStorage().checkpoints.get(recoveryId(stackId))).toBeUndefined();
  });

  it('discards an invalid recovery checkpoint', async () => {
    const { open, checkpoints, stacks, stackId } = await setup();
    const saved = (await stacks.get(stackId))!;
    const bad = { ...saved, updatedAt: '2030-01-01T00:00:00.000Z', entryCardId: 'ghost' };
    await checkpoints.put({
      checkpointId: recoveryId(stackId),
      stackId,
      label: 'Recovery',
      kind: 'recovery',
      createdAt: bad.updatedAt,
      stack: bad,
    });
    const s = await open();
    expect(s.getStack().entryCardId).toBe('c1');
    expect(s.getStatus().recovered).toBeUndefined();
  });

  it('clears the recovery checkpoint after a durable save', async () => {
    const { open, checkpoints, stackId } = await setup(10);
    const s = await open();
    s.dispatch({ type: 'RENAME_STACK', title: 'Z' });
    await s.flush();
    expect(await checkpoints.get(recoveryId(stackId))).toBeUndefined();
  });
});
