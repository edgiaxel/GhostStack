import type { ProjectBundle } from '@ghoststack/domain';
import { arbBundle } from '@ghoststack/domain/testing';
import { createMemoryStorage } from '@ghoststack/storage';
import type { StoragePort } from '@ghoststack/storage';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { serializeProject } from '../serialize';
import { truncateArchive } from '../testing/archive';
import { importProject } from './importProject';

interface StoredProject {
  readonly bundle: ProjectBundle;
}

/** Reads the listing and every project's stack and asset bytes. */
async function snapshot(storage: StoragePort) {
  const listing = await storage.listProjects();
  if (!listing.ok) throw new Error('listProjects failed');
  const projects: Record<string, StoredProject> = {};
  for (const { stackId } of listing.value.summaries) {
    const loaded = await storage.loadProject(stackId);
    if (!loaded.ok) throw new Error(`loadProject failed for ${stackId}`);
    projects[stackId] = { bundle: loaded.value };
  }
  return { listing: listing.value, projects };
}

const arbStoredBundles = fc
  .array(arbBundle, { maxLength: 3 })
  .map((bundles) => [...new Map(bundles.map((b) => [b.stack.stackId, b])).values()]);

describe('Property 24: Failed imports leave stored data unchanged', () => {
  // Feature: m1-foundation, Property 24: Failed imports leave stored data unchanged
  // **Validates: Requirements 10.15, 8.8**
  it('does not change storage when importProject rejects an archive', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbStoredBundles,
        arbBundle,
        fc.uint8Array({ maxLength: 256 }),
        fc.double({ min: 0, max: 1, noNaN: true, maxExcluded: true }),
        async (stored, incoming, randomBytes, cut) => {
          const storage = createMemoryStorage();
          for (const bundle of stored) {
            const saved = await storage.saveProject(bundle);
            expect(saved.ok).toBe(true);
          }
          const exported = await serializeProject(incoming);
          expect(exported.ok).toBe(true);
          if (!exported.ok) return;
          const truncated = truncateArchive(
            exported.value,
            Math.floor(cut * exported.value.byteLength),
          );
          const before = await snapshot(storage);
          const existingStackIds = new Set(Object.keys(before.projects));

          for (const archive of [new Uint8Array(0), randomBytes, truncated]) {
            const result = await importProject(archive, { existingStackIds });
            if (result.ok) continue;
            expect(result.error.code).toBe('PROJECT_IMPORT_FAILED');
            expect(await snapshot(storage)).toEqual(before);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
