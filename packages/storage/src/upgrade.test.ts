import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { expect, it } from 'vitest';
import { createStack } from '@ghoststack/domain';
import { DB_NAME, createIdbStorage } from './index';

const now = '2026-11-25T00:00:00.000Z';

it('upgrades a v1 database to v2 without losing Stacks and adds the new stores', async () => {
  const legacy = await openDB(DB_NAME, 1, {
    upgrade: (db) => void db.createObjectStore('stacks', { keyPath: 'stackId' }),
  });
  await legacy.put('stacks', createStack({ stackId: 'old', cardId: 'c', title: 'Old', now }));
  legacy.close();

  const { stacks, assets, checkpoints } = createIdbStorage();
  expect((await stacks.get('old'))?.title).toBe('Old');
  await assets.put(
    'old',
    { assetId: 'a', relativePath: 'a.png', mimeType: 'image/png', byteSize: 1, checksum: 'x' },
    new Uint8Array([1]),
  );
  expect(await assets.get('old', 'a')).toEqual(new Uint8Array([1]));
  expect(await checkpoints.list('old')).toEqual([]);
});
