import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createStack } from '@ghoststack/domain';
import { createIdbStackRepository, createIdbStorage } from './index';

const now = '2026-11-25T00:00:00.000Z';

describe('createIdbStackRepository', () => {
  it('persists, lists, reloads and deletes a Stack', async () => {
    const repo = createIdbStackRepository();
    const stack = createStack({ stackId: 's1', cardId: 'c1', title: 'Demo', now });
    await repo.save(stack);
    expect(await repo.list()).toEqual([{ stackId: 's1', title: 'Demo', updatedAt: now, cardCount: 1 }]);
    expect(await createIdbStackRepository().get('s1')).toEqual(stack);
    await repo.delete('s1');
    expect(await repo.get('s1')).toBeUndefined();
  });

  it('rejects an invalid Stack without writing', async () => {
    const repo = createIdbStackRepository();
    await expect(repo.save({ stackId: 'bad' } as never)).rejects.toMatchObject({
      code: 'PROJECT_VALIDATION_FAILED',
    });
    expect(await repo.get('bad')).toBeUndefined();
  });
});

describe('assets', () => {
  const asset = (assetId: string, byteSize: number) => ({
    assetId,
    relativePath: `${assetId}.png`,
    mimeType: 'image/png',
    byteSize,
    checksum: 'abc',
  });

  it('stores bytes per stack, reads them back, and lists them for export', async () => {
    const { assets } = createIdbStorage();
    await assets.put('sA', asset('a1', 3), new Uint8Array([1, 2, 3]));
    await assets.put('sA', asset('a2', 1), new Uint8Array([9]));
    await assets.put('sB', asset('a1', 2), new Uint8Array([7, 7]));
    expect(await assets.get('sA', 'a1')).toEqual(new Uint8Array([1, 2, 3]));
    expect(await assets.get('sB', 'a1')).toEqual(new Uint8Array([7, 7]));
    expect(await assets.get('sA', 'missing')).toBeUndefined();
    expect(Object.keys(await assets.getAll('sA')).sort()).toEqual(['a1', 'a2']);
    await assets.delete('sA', 'a1');
    expect(await assets.get('sA', 'a1')).toBeUndefined();
  });

  it('rejects bytes that do not match byteSize and unsafe paths', async () => {
    const { assets } = createIdbStorage();
    await expect(assets.put('sC', asset('a1', 5), new Uint8Array([1]))).rejects.toMatchObject({
      code: 'STORAGE_FAILED',
    });
    await expect(
      assets.put('sC', { ...asset('a1', 1), relativePath: '../x' }, new Uint8Array([1])),
    ).rejects.toMatchObject({ code: 'STORAGE_FAILED' });
    expect(await assets.get('sC', 'a1')).toBeUndefined();
  });
});

describe('checkpoints', () => {
  it('stores, lists newest first, overwrites by id, and validates', async () => {
    const { checkpoints } = createIdbStorage();
    const stack = createStack({ stackId: 'sK', cardId: 'c1', title: 'K', now });
    await checkpoints.put({
      checkpointId: 'k1',
      stackId: 'sK',
      label: 'one',
      kind: 'manual',
      createdAt: '2026-11-26T00:00:01.000Z',
      stack,
    });
    await checkpoints.put({
      checkpointId: 'k2',
      stackId: 'sK',
      label: 'two',
      kind: 'auto',
      createdAt: '2026-11-26T00:00:02.000Z',
      stack,
    });
    expect((await checkpoints.list('sK')).map((c) => c.checkpointId)).toEqual(['k2', 'k1']);
    await checkpoints.put({
      checkpointId: 'k1',
      stackId: 'sK',
      label: 'renamed',
      kind: 'manual',
      createdAt: '2026-11-26T00:00:03.000Z',
      stack,
    });
    expect((await checkpoints.list('sK'))[0]).toMatchObject({ checkpointId: 'k1', label: 'renamed' });
    expect((await checkpoints.get('k2'))?.stack).toEqual(stack);
    await expect(
      checkpoints.put({
        checkpointId: 'bad',
        stackId: 'other',
        label: 'x',
        kind: 'auto',
        createdAt: now,
        stack,
      }),
    ).rejects.toMatchObject({ code: 'CHECKPOINT_FAILED' });
    await checkpoints.delete('k2');
    expect(await checkpoints.get('k2')).toBeUndefined();
  });

  it('deleting a Stack also removes its assets and checkpoints', async () => {
    const { stacks, assets, checkpoints } = createIdbStorage();
    const stack = createStack({ stackId: 'sD', cardId: 'c1', title: 'D', now });
    await stacks.save(stack);
    await assets.put(
      'sD',
      { assetId: 'a', relativePath: 'a.png', mimeType: 'image/png', byteSize: 1, checksum: 'x' },
      new Uint8Array([1]),
    );
    await checkpoints.put({
      checkpointId: 'kd',
      stackId: 'sD',
      label: 'x',
      kind: 'auto',
      createdAt: now,
      stack,
    });
    await stacks.delete('sD');
    expect(await assets.getAll('sD')).toEqual({});
    expect(await checkpoints.list('sD')).toEqual([]);
  });
});
