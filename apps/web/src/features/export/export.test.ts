import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { applyCommand, createStack } from '@ghoststack/domain';
import { exportGsp, sha256Hex } from '@ghoststack/project-format';
import { createIdbStorage } from '@ghoststack/storage';
import type { AssetRepository, Stack } from '@ghoststack/shared-contracts';
import { importGspBytes } from './importFlow';
import { safeFileName } from './files';

const T = '2026-11-26T00:00:00.000Z';
const png = new Uint8Array([137, 80, 78, 71, 1, 2]);

function source(): { stack: Stack; bytes: Uint8Array } {
  let s = createStack({ stackId: 'orig', cardId: 'c1', title: 'Original', now: T });
  const steps = [
    {
      type: 'REGISTER_ASSET' as const,
      asset: {
        assetId: 'a1',
        relativePath: 'a1-dot.png',
        mimeType: 'image/png',
        byteSize: png.length,
        checksum: sha256Hex(png),
      },
    },
    {
      type: 'ADD_ELEMENT' as const,
      cardId: 'c1',
      element: {
        elementId: 'i',
        type: 'image' as const,
        name: 'i',
        properties: { alt: 'dot' },
        assetId: 'a1',
        layout: { x: 0, y: 0, width: 5, height: 5, zIndex: 0 },
        behaviors: [],
      },
    },
  ];
  for (const c of steps) {
    const r = applyCommand(s, c, T);
    if (!r.ok) throw new Error(r.error.message);
    s = r.value;
  }
  const out = exportGsp(s, { a1: png });
  if (!out.ok) throw new Error(out.error.message);
  return { stack: s, bytes: out.value };
}

describe('importGspBytes', () => {
  it('stores the project under a new id with its assets and leaves other Stacks alone', async () => {
    const { stacks, assets } = createIdbStorage();
    const { stack, bytes } = source();
    await stacks.save(stack);
    const r = await importGspBytes(bytes, {
      stacks,
      assets,
      newStackId: 'copy',
      now: '2026-11-27T00:00:00.000Z',
    });
    expect(r).toEqual({ ok: true, value: { stackId: 'copy' } });
    const copy = await stacks.get('copy');
    expect(copy).toMatchObject({ stackId: 'copy', title: 'Original', updatedAt: '2026-11-27T00:00:00.000Z' });
    expect({ ...copy, stackId: 'orig', updatedAt: stack.updatedAt }).toEqual(stack);
    expect(await assets.get('copy', 'a1')).toEqual(png);
    expect(await stacks.get('orig')).toEqual(stack);
  });

  it('rejects a bad archive without storing anything', async () => {
    const { stacks, assets } = createIdbStorage();
    const before = (await stacks.list()).length;
    const r = await importGspBytes(new Uint8Array([1, 2, 3]), { stacks, assets, newStackId: 'bad', now: T });
    expect(r).toMatchObject({ ok: false, error: { code: 'PROJECT_IMPORT_FAILED' } });
    expect((await stacks.list()).length).toBe(before);
  });

  it('removes the new Stack and its assets when storing an asset fails', async () => {
    const { stacks, assets } = createIdbStorage();
    const failing: AssetRepository = {
      ...assets,
      put: async () => Promise.reject(new Error('quota exceeded')),
    };
    const { bytes } = source();
    const r = await importGspBytes(bytes, { stacks, assets: failing, newStackId: 'half', now: T });
    expect(r).toMatchObject({ ok: false, error: { code: 'STORAGE_FAILED' } });
    expect(await stacks.get('half')).toBeUndefined();
    expect(await assets.getAll('half')).toEqual({});
  });
});

describe('safeFileName', () => {
  it.each([
    ['My Quiz', '.gsp', 'My Quiz.gsp'],
    ['../../etc/passwd', '.gsp', 'etc_passwd.gsp'],
    ['  ', '.zip', 'stack.zip'],
    ['a:b*c?.', '.gsp', 'a_b_c.gsp'],
    ['Caf\u00e9', '.gsp', 'Cafe.gsp'],
  ])('sanitizes %j', (title, ext, expected) => {
    expect(safeFileName(title, ext)).toBe(expected);
  });
});
