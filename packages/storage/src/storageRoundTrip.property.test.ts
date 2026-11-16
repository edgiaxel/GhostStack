import 'fake-indexeddb/auto';
import { arbBundle } from '@ghoststack/domain/testing';
import type { ProjectBundle } from '@ghoststack/domain';
import { IDBFactory } from 'fake-indexeddb';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createIndexedDbStorage } from './indexeddb';
import { createMemoryStorage } from './memory';
import type { StoragePort } from './port';

interface Backend {
  readonly name: string;
  /** Returns a fresh empty store and a way to open another port on the same store, if any. */
  readonly make: () => { port: StoragePort; reopen?: () => StoragePort };
}

const backends: readonly Backend[] = [
  { name: 'memory', make: () => ({ port: createMemoryStorage() }) },
  {
    name: 'indexeddb',
    make: () => {
      const factory = new IDBFactory();
      return {
        port: createIndexedDbStorage({ factory }),
        reopen: () => createIndexedDbStorage({ factory }),
      };
    },
  },
];

async function expectStored(port: StoragePort, bundle: ProjectBundle): Promise<void> {
  const { stack } = bundle;
  const loaded = await port.loadProject(stack.stackId);
  if (!loaded.ok) throw new Error(`load failed: ${loaded.error.code}`);
  expect(loaded.value.stack).toEqual(stack);
  expect(Object.keys(loaded.value.assets).sort()).toEqual(Object.keys(bundle.assets).sort());
  for (const [assetId, bytes] of Object.entries(bundle.assets)) {
    expect(Array.from(loaded.value.assets[assetId] ?? [])).toEqual(Array.from(bytes));
  }

  const listed = await port.listProjects();
  if (!listed.ok) throw new Error(`list failed: ${listed.error.code}`);
  const summary = { stackId: stack.stackId, title: stack.title, updatedAt: stack.updatedAt };
  expect(listed.value.summaries).toContainEqual(summary);
  expect(listed.value.unreadable).toEqual([]);
}

describe.each(backends)('storage round trip ($name)', ({ make }) => {
  // Feature: m1-foundation, Property 9: Storage round trip preserves projects and asset bytes
  // **Validates: Requirements 5.1, 5.2, 5.5, 6.9, 12.7**
  it('loads back the saved stack, asset bytes and list summary', async () => {
    await fc.assert(
      fc.asyncProperty(arbBundle, async (bundle) => {
        const { port, reopen } = make();
        const saved = await port.saveProject(bundle);
        if (!saved.ok) throw new Error(`save failed: ${JSON.stringify(saved.error)}`);
        await expectStored(port, bundle);
        // A second port on the same store models a page reload.
        if (reopen !== undefined) await expectStored(reopen(), bundle);
      }),
      { numRuns: 100 },
    );
  });
});
