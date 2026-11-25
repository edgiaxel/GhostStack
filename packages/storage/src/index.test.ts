import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createStack } from '@ghoststack/domain';
import { createIdbStackRepository } from './index';

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
