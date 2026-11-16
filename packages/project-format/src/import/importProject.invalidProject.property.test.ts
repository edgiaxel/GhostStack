import { arbBundle, arbFault } from '@ghoststack/domain/testing';
import type { Fault } from '@ghoststack/domain/testing';
import type { ProjectBundle, Stack } from '@ghoststack/domain';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { buildArchive } from '../testing/archive';
import type { ArchivePart } from '../testing/archive';
import { importProject } from './importProject';

// Only faults that survive splitting into entries: each entry stays well-formed and the
// cross-entry checks pass, so the importer can only reject at the final project validation.
const ARCHIVE_SAFE_CODES: ReadonlySet<string> = new Set([
  'ENTRY_CARD_NOT_FOUND',
  'CARD_ORDER_DUPLICATE',
  'ELEMENT_ID_DUPLICATE',
  'ELEMENT_ASSET_NOT_FOUND',
]);
const arbArchiveSafeFault = arbFault.filter((fault) => ARCHIVE_SAFE_CODES.has(fault.code));

const encode = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value));

/** Writes the entries one by one, so no entry is rejected on its own. */
function archiveOf(bundle: ProjectBundle, stack: Stack): Uint8Array {
  const { cards, ...stackFile } = stack;
  const registry = Object.values(stack.assetRegistry);
  const parts: ArchivePart[] = [
    {
      name: 'manifest.json',
      data: encode({
        formatVersion: 1,
        producer: 'ghoststack-web',
        stackId: stack.stackId,
        assets: registry,
      }),
    },
    { name: 'stack.json', data: encode(stackFile) },
    ...Object.values(cards).map((card) => ({
      name: `cards/${card.cardId}.json`,
      data: encode(card),
    })),
    ...registry.map((asset) => ({
      name: asset.relativePath,
      data: bundle.assets[asset.assetId] as Uint8Array,
      level: 0 as const,
    })),
  ];
  return buildArchive(parts);
}

describe('Property 23: invalid projects inside an archive', () => {
  // Feature: m1-foundation, Property 23: Invalid projects inside an archive are rejected
  // **Validates: Requirements 10.11, 10.12**
  it('rejects well-formed entries whose combined project is invalid', async () => {
    await fc.assert(
      fc.asyncProperty(arbBundle, arbArchiveSafeFault, async (bundle, fault: Fault) => {
        const broken = fault.apply(bundle.stack) as Stack;
        const result = await importProject(archiveOf(bundle, broken));

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('PROJECT_IMPORT_FAILED');
        expect(result.error.reason).toBe('PROJECT_INVALID');
        expect(result.error.validationErrors?.length).toBeGreaterThan(0);
        expect(result.error.validationErrors?.map((error) => error.code)).toContain(fault.code);
        expect('value' in result).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});
