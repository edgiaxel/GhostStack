import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import * as mainEntry from '../index';
import { MAX_TITLE_CODE_POINTS } from '../schemas';
import { VALIDATION_ERROR_CODES, isValid } from '../validation/types';
import { validateProject } from '../validation/validateProject';
import {
  MAX_ARBITRARY_ASSET_BYTES,
  arbBundle,
  arbCard,
  arbFault,
  arbId,
  arbJsonValue,
  buildFixtureBundle,
  checksumOf,
  sha256Hex,
} from './index';
import { ID_PATTERNS } from '../ids';
import type { IdPrefix } from '../ids';

const toHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');

describe('sha256Hex', () => {
  it('matches the published vectors', () => {
    expect(sha256Hex(new Uint8Array(0))).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
    expect(sha256Hex(new TextEncoder().encode('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('matches Web Crypto for arbitrary bytes, including block boundaries', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uint8Array({ maxLength: 300 }), async (bytes) => {
        expect(sha256Hex(bytes)).toBe(toHex(await crypto.subtle.digest('SHA-256', bytes)));
      }),
    );
  });
});

describe('arbitraries', () => {
  it('arbId matches the identifier pattern for its prefix', () => {
    for (const prefix of ['stk', 'crd', 'elm', 'ast'] as const satisfies readonly IdPrefix[]) {
      fc.assert(fc.property(arbId(prefix), (id) => ID_PATTERNS[prefix].test(id)));
    }
  });

  it('every arbBundle sample passes validateProject with matching bytes and checksums', () => {
    let sawEmptyAsset = false;
    fc.assert(
      fc.property(arbBundle, ({ stack, assets }) => {
        expect(validateProject(stack).errors).toEqual([]);
        const registry = Object.values(stack.assetRegistry);
        expect(Object.keys(assets).sort()).toEqual(Object.keys(stack.assetRegistry).sort());
        const paths = registry.map((asset) => asset.relativePath);
        expect(new Set(paths).size).toBe(paths.length);
        for (const asset of registry) {
          const bytes = assets[asset.assetId]!;
          expect(bytes.length).toBe(asset.byteSize);
          expect(bytes.length).toBeLessThanOrEqual(MAX_ARBITRARY_ASSET_BYTES);
          expect(checksumOf(bytes)).toBe(asset.checksum);
          if (bytes.length === 0) sawEmptyAsset = true;
        }
      }),
      { numRuns: 200 },
    );
    expect(sawEmptyAsset).toBe(true);
  });

  it('arbBundle output survives a JSON round trip unchanged', () => {
    fc.assert(
      fc.property(arbBundle, ({ stack }) => {
        expect(JSON.parse(JSON.stringify(stack))).toEqual(stack);
      }),
    );
  });

  it('card titles use the validator limit of 100 code points, not UTF-16 units', () => {
    const [bundle] = fc.sample(arbBundle, 1);
    const card = {
      ...fc.sample(arbCard(), 1)[0]!,
      title: '\u{1F47B}'.repeat(MAX_TITLE_CODE_POINTS),
    };
    const stack = structuredClone(bundle!.stack);
    stack.cards[card.cardId] = card;
    stack.cardOrder.push(card.cardId);
    expect(card.title.length).toBe(MAX_TITLE_CODE_POINTS * 2);
    expect(validateProject(stack).errors).toEqual([]);
    fc.assert(
      fc.property(arbCard(), (generated) => {
        expect(Array.from(generated.title).length).toBeLessThanOrEqual(MAX_TITLE_CODE_POINTS);
      }),
    );
  });

  it('every arbFault makes validateProject report its code, path and details', () => {
    const seen = new Set<string>();
    fc.assert(
      fc.property(arbBundle, arbFault, ({ stack }, fault) => {
        const frozen = JSON.stringify(stack);
        const result = validateProject(fault.apply(stack));
        expect(JSON.stringify(stack)).toBe(frozen);
        const match = result.errors.find(
          (error) =>
            error.code === fault.code &&
            (fault.path === undefined ||
              JSON.stringify(error.path) === JSON.stringify(fault.path)) &&
            Object.entries(fault.details).every(([key, value]) => error.details[key] === value),
        );
        expect(match, `${fault.code} not reported at ${JSON.stringify(fault.path)}`).toBeDefined();
        seen.add(fault.code);
      }),
      { numRuns: 500 },
    );
    const expected = VALIDATION_ERROR_CODES.filter((code) => code !== 'VALIDATOR_INTERNAL_ERROR');
    expect([...seen].sort()).toEqual([...expected].sort());
  });

  it('arbJsonValue yields plain JSON data', () => {
    fc.assert(
      fc.property(arbJsonValue, (value) => {
        expect(JSON.parse(JSON.stringify(value))).toEqual(value);
      }),
    );
  });
});

describe('buildFixtureBundle', () => {
  it('has three cards, two assets and one zero-byte asset, and is valid', () => {
    const { stack, assets } = buildFixtureBundle();
    expect(isValid(validateProject(stack))).toBe(true);
    expect(stack.cardOrder).toHaveLength(3);
    expect(Object.keys(stack.cards)).toHaveLength(3);
    const registry = Object.values(stack.assetRegistry);
    expect(registry).toHaveLength(2);
    expect(registry.filter((asset) => asset.byteSize === 0)).toHaveLength(1);
    for (const asset of registry) {
      expect(assets[asset.assetId]!.length).toBe(asset.byteSize);
      expect(checksumOf(assets[asset.assetId]!)).toBe(asset.checksum);
    }
  });

  it('is deterministic', () => {
    expect(buildFixtureBundle()).toEqual(buildFixtureBundle());
  });
});

describe('main entry', () => {
  it('does not export the testing helpers', () => {
    const names = Object.keys(mainEntry);
    for (const name of ['arbBundle', 'arbFault', 'arbId', 'buildFixtureBundle', 'checksumOf']) {
      expect(names).not.toContain(name);
    }
  });
});
