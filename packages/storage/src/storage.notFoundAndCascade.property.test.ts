import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { arbBundle, arbId } from '@ghoststack/domain/testing';
import type { ProjectBundle, Result } from '@ghoststack/domain';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createIndexedDbStorage } from './indexeddb';
import { createMemoryStorage } from './memory';
import type { StorageError, StoragePort } from './port';

/**
 * Feature: m1-foundation, Property 11: Missing and deleted data return not-found,
 * and deletion cascades.
 *
 * **Validates: Requirements 5.6, 5.8, 6.8**
 */

const implementations: ReadonlyArray<readonly [string, () => StoragePort]> = [
  ['memory', () => createMemoryStorage()],
  ['indexeddb', () => createIndexedDbStorage({ factory: new IDBFactory() })],
];

function unwrap<T>(result: Result<T, StorageError>): T {
  if (!result.ok) throw new Error(`expected ok, got ${result.error.code}`);
  return result.value;
}

function expectNotFound<T>(result: Result<T, StorageError>): void {
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error.code).toBe('not-found');
}

async function saveAll(port: StoragePort, bundles: readonly ProjectBundle[]): Promise<void> {
  for (const bundle of bundles) unwrap(await port.saveProject(bundle));
}

async function sortedSummaryIds(port: StoragePort): Promise<string[]> {
  const listing = unwrap(await port.listProjects());
  return listing.summaries.map((summary) => summary.stackId).sort();
}

const arbDistinctBundles = (minLength: number, maxLength: number): fc.Arbitrary<ProjectBundle[]> =>
  fc.uniqueArray(arbBundle, {
    minLength,
    maxLength,
    selector: (bundle) => bundle.stack.stackId,
  });

describe.each(implementations)('Property 11 on %s storage', (_name, makePort) => {
  it('returns not-found for a stackId that was never saved, and creates no record', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbDistinctBundles(0, 2),
        arbId('stk'),
        arbId('ast'),
        async (stored, unknownStackId, unknownAssetId) => {
          fc.pre(stored.every((bundle) => bundle.stack.stackId !== unknownStackId));
          const port = makePort();
          await saveAll(port, stored);
          const before = await sortedSummaryIds(port);

          expectNotFound(await port.loadProject(unknownStackId));
          expectNotFound(await port.loadAsset(unknownStackId, unknownAssetId));

          // A stored stack with an asset id it does not hold is not-found as well.
          for (const bundle of stored) {
            expectNotFound(await port.loadAsset(bundle.stack.stackId, unknownAssetId));
          }

          expect(await sortedSummaryIds(port)).toEqual(before);
          expectNotFound(await port.loadProject(unknownStackId));
        },
      ),
      { numRuns: 25 },
    );
  });

  it('returns not-found for a deleted stack and its assets, leaving other projects unchanged', async () => {
    await fc.assert(
      fc.asyncProperty(arbDistinctBundles(1, 3), async (bundles) => {
        const [target, ...others] = bundles as [ProjectBundle, ...ProjectBundle[]];
        const port = makePort();
        await saveAll(port, bundles);

        const othersBefore = await Promise.all(
          others.map(async (bundle) => unwrap(await port.loadProject(bundle.stack.stackId))),
        );

        unwrap(await port.deleteProject(target.stack.stackId));

        expectNotFound(await port.loadProject(target.stack.stackId));
        for (const assetId of Object.keys(target.assets)) {
          expectNotFound(await port.loadAsset(target.stack.stackId, assetId));
        }

        const othersAfter = await Promise.all(
          others.map(async (bundle) => unwrap(await port.loadProject(bundle.stack.stackId))),
        );
        expect(othersAfter).toEqual(othersBefore);
        expect(await sortedSummaryIds(port)).toEqual(
          others.map((bundle) => bundle.stack.stackId).sort(),
        );
      }),
      { numRuns: 25 },
    );
  });
});
