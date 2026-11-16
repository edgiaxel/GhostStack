import { arbBundle } from '@ghoststack/domain/testing';
import type { ProjectBundle } from '@ghoststack/domain';
import { unzipSync } from 'fflate';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { importProject } from './import/importProject';
import { serializeProject } from './serialize';

// Rebuilds plain objects with keys in reverse order. Typed arrays are copied, arrays keep their order.
function reverseKeys(value: unknown): unknown {
  if (value instanceof Uint8Array) return value.slice();
  if (Array.isArray(value)) return value.map(reverseKeys);
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .reverse()
        .map(([key, entry]) => [key, reverseKeys(entry)]),
    );
  }
  return value;
}

async function archiveOf(bundle: ProjectBundle): Promise<Uint8Array> {
  const result = await serializeProject(bundle);
  if (!result.ok) throw new Error(`export failed: ${JSON.stringify(result.error)}`);
  return result.value;
}

function jsonEntries(archive: Uint8Array): { manifest: Uint8Array; stack: Uint8Array } {
  const entries = unzipSync(archive);
  const manifest = entries['manifest.json'];
  const stack = entries['stack.json'];
  if (manifest === undefined || stack === undefined) throw new Error('missing JSON entries');
  return { manifest, stack };
}

describe('serializeProject determinism', () => {
  // Feature: m1-foundation, Property 16: Serialization is deterministic and idempotent
  // **Validates: Requirements 9.6, 11.5**
  it('returns byte-identical archives for equal bundles, whatever the key insertion order', async () => {
    await fc.assert(
      fc.asyncProperty(arbBundle, async (bundle) => {
        const first = await archiveOf(bundle);
        const second = await archiveOf(bundle);
        const reordered = await archiveOf(reverseKeys(bundle) as ProjectBundle);
        expect(second).toEqual(first);
        expect(reordered).toEqual(first);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: m1-foundation, Property 16: Serialization is deterministic and idempotent
  // **Validates: Requirements 9.6, 11.5**
  it('keeps manifest.json and stack.json byte-equal after import and serialize again', async () => {
    await fc.assert(
      fc.asyncProperty(arbBundle, async (bundle) => {
        const first = await archiveOf(bundle);
        const imported = await importProject(first);
        if (!imported.ok) throw new Error(`import failed: ${JSON.stringify(imported.error)}`);
        const again = await archiveOf(imported.value);
        const before = jsonEntries(first);
        const after = jsonEntries(again);
        expect(after.manifest).toEqual(before.manifest);
        expect(after.stack).toEqual(before.stack);
      }),
      { numRuns: 100 },
    );
  });
});
