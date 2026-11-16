import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { MAX_ASSET_BYTES } from '../schemas';
import type { Stack } from '../schemas';
import { arbBundle } from '../testing';
import { validateProject } from './validateProject';

const arbBundleWithAssets = arbBundle.filter(
  ({ stack }) => Object.keys(stack.assetRegistry).length > 0,
);

const arbName = fc.stringMatching(/^[A-Za-z0-9_-]{1,20}$/);

// Each generator breaks exactly one path rule, so the expected rule name is unambiguous.
const arbBadPath: fc.Arbitrary<{ rule: string; path: string }> = fc.oneof(
  arbName.map((name) => ({ rule: 'absolute', path: `/assets/${name}` })),
  arbName.map((name) => ({ rule: 'absolute', path: `C:assets/${name}` })),
  arbName.map((name) => ({ rule: 'dot-dot', path: `assets/../${name}` })),
  arbName.map((name) => ({ rule: 'backslash', path: `assets\\${name}` })),
  arbName.map((name) => ({ rule: 'null-char', path: `assets/${name}\u0000` })),
  fc
    .tuple(
      arbName.filter((dir) => dir !== 'assets'),
      arbName,
    )
    .map(([dir, name]) => ({ rule: 'prefix', path: `${dir}/${name}` })),
);

const arbBadSize: fc.Arbitrary<{ rule: string; size: number }> = fc.oneof(
  fc.integer({ min: -1_000_000_000, max: -1 }).map((size) => ({ rule: 'negative', size })),
  fc
    .double({ min: 0, max: 1_000_000, noNaN: true, noDefaultInfinity: true })
    .filter((size) => !Number.isInteger(size))
    .map((size) => ({ rule: 'non-integer', size })),
  fc
    .integer({ min: MAX_ASSET_BYTES + 1, max: Number.MAX_SAFE_INTEGER })
    .map((size) => ({ rule: 'too-large', size })),
);

function withAssetChange(stack: Stack, assetId: string, change: Record<string, unknown>): unknown {
  const asset = stack.assetRegistry[assetId];
  return {
    ...stack,
    assetRegistry: { ...stack.assetRegistry, [assetId]: { ...asset, ...change } },
  };
}

describe('asset path and size rules', () => {
  // Feature: m1-foundation, Property 8: Asset path and size rules are enforced
  // **Validates: Requirements 4.10, 4.11**
  it('reports ASSET_PATH_INVALID with the matching rule and assetId', () => {
    fc.assert(
      fc.property(arbBundleWithAssets, fc.nat(), arbBadPath, ({ stack }, pick, bad) => {
        const ids = Object.keys(stack.assetRegistry);
        const assetId = ids[pick % ids.length] as string;
        const result = validateProject(withAssetChange(stack, assetId, { relativePath: bad.path }));
        const hits = result.errors.filter((error) => error.code === 'ASSET_PATH_INVALID');
        expect(hits).toHaveLength(1);
        expect(hits[0]?.details).toEqual({ assetId, rule: bad.rule });
        expect(result.errors).toHaveLength(1);
      }),
      { numRuns: 200 },
    );
  });

  // Feature: m1-foundation, Property 8: Asset path and size rules are enforced
  // **Validates: Requirements 4.10, 4.11**
  it('reports ASSET_SIZE_INVALID with the matching rule and assetId', () => {
    fc.assert(
      fc.property(arbBundleWithAssets, fc.nat(), arbBadSize, ({ stack }, pick, bad) => {
        const ids = Object.keys(stack.assetRegistry);
        const assetId = ids[pick % ids.length] as string;
        const result = validateProject(withAssetChange(stack, assetId, { byteSize: bad.size }));
        const hits = result.errors.filter((error) => error.code === 'ASSET_SIZE_INVALID');
        expect(hits).toHaveLength(1);
        expect(hits[0]?.details).toEqual({ assetId, rule: bad.rule });
        expect(result.errors).toHaveLength(1);
      }),
      { numRuns: 200 },
    );
  });

  it('accepts the size boundaries 0 and 26,214,400', () => {
    fc.assert(
      fc.property(arbBundleWithAssets, fc.constantFrom(0, MAX_ASSET_BYTES), ({ stack }, size) => {
        const assetId = Object.keys(stack.assetRegistry)[0] as string;
        const result = validateProject(withAssetChange(stack, assetId, { byteSize: size }));
        expect(result.errors).toEqual([]);
      }),
      { numRuns: 20 },
    );
  });
});
