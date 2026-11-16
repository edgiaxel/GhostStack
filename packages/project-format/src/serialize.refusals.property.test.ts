import { arbBundle, arbFault } from '@ghoststack/domain/testing';
import type { ProjectBundle } from '@ghoststack/domain';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { serializeProject } from './serialize';

const arbBundleWithAssets = arbBundle.filter(
  ({ stack }) => Object.keys(stack.assetRegistry).length > 0,
);
const arbBundleWithBytes = arbBundleWithAssets.filter(({ stack, assets }) =>
  Object.keys(stack.assetRegistry).some((id) => (assets[id]?.length ?? 0) > 0),
);

/** Runs the export and checks the refusal contract that every case shares. */
async function refuse(input: ProjectBundle) {
  const before = structuredClone(input);
  const result = await serializeProject(input);
  expect(result.ok).toBe(false);
  expect(input).toEqual(before);
  if (result.ok) throw new Error('Expected the export to be refused');
  expect(result.error.code).toBe('PROJECT_EXPORT_FAILED');
  return result.error;
}

describe('serializeProject refusals', () => {
  // Feature: m1-foundation, Property 17: Invalid exports are refused without side effects
  // **Validates: Requirements 9.1, 9.2, 9.5**
  it('refuses an invalid project with VALIDATION_FAILED', async () => {
    await fc.assert(
      fc.asyncProperty(arbBundle, arbFault, async (bundle, fault) => {
        const broken = { ...bundle, stack: fault.apply(bundle.stack) } as ProjectBundle;
        const error = await refuse(broken);
        expect(error.reason).toBe('VALIDATION_FAILED');
        expect(error.validationErrors?.length).toBeGreaterThan(0);
      }),
    );
  });

  // **Validates: Requirements 9.1, 9.2, 9.5**
  it('refuses a registered asset without bytes and names it', async () => {
    await fc.assert(
      fc.asyncProperty(arbBundleWithAssets, fc.nat(), async (bundle, pick) => {
        const ids = Object.keys(bundle.stack.assetRegistry);
        const assetId = ids[pick % ids.length] as string;
        const assets = Object.fromEntries(
          Object.entries(bundle.assets).filter(([id]) => id !== assetId),
        );
        const error = await refuse({ ...bundle, assets });
        expect(error.reason).toBe('ASSET_BYTES_MISSING');
        expect(error.assetId).toBe(assetId);
      }),
    );
  });

  // **Validates: Requirements 9.1, 9.2, 9.5**
  it('refuses bytes whose length differs from the registered size and names the asset', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbBundleWithAssets,
        fc.nat(),
        fc.uint8Array({ minLength: 1, maxLength: 16 }),
        async (bundle, pick, extra) => {
          const ids = Object.keys(bundle.stack.assetRegistry);
          const assetId = ids[pick % ids.length] as string;
          const original = bundle.assets[assetId] as Uint8Array;
          const longer = Uint8Array.from([...original, ...extra]);
          const error = await refuse({
            ...bundle,
            assets: { ...bundle.assets, [assetId]: longer },
          });
          expect(error.reason).toBe('ASSET_INCONSISTENT');
          expect(error.assetId).toBe(assetId);
        },
      ),
    );
  });

  // **Validates: Requirements 9.1, 9.2, 9.5**
  it('refuses same-length bytes with a different checksum and names the asset', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbBundleWithBytes,
        fc.nat(),
        fc.nat(),
        fc.integer({ min: 1, max: 255 }),
        async (bundle, pickAsset, pickByte, mask) => {
          const ids = Object.keys(bundle.stack.assetRegistry).filter(
            (id) => (bundle.assets[id]?.length ?? 0) > 0,
          );
          const assetId = ids[pickAsset % ids.length] as string;
          const flipped = Uint8Array.from(bundle.assets[assetId] as Uint8Array);
          const index = pickByte % flipped.length;
          flipped[index] = (flipped[index] as number) ^ mask;
          const error = await refuse({
            ...bundle,
            assets: { ...bundle.assets, [assetId]: flipped },
          });
          expect(error.reason).toBe('ASSET_INCONSISTENT');
          expect(error.assetId).toBe(assetId);
        },
      ),
    );
  });
});
