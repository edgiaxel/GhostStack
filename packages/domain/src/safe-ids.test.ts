import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { exportGsp, importGsp, sha256Hex } from '@ghoststack/project-format';
import { FORMAT_VERSION } from '@ghoststack/shared-contracts';
import type { Stack } from '@ghoststack/shared-contracts';
import { validateStack } from './validate';

// Test-only import of project-format: the property spans the domain boundary and the .gsp boundary.
// Names that exist on Object.prototype (toString, constructor) are reserved and covered by hostile.
const safe = fc.stringMatching(/^[A-Za-z0-9_-]{1,64}$/).filter((s) => !(s in Object.prototype));
const hostile = fc.oneof(
  fc.constantFrom(
    '',
    '.',
    '..',
    'a/b',
    'a\\b',
    '../x',
    'a b',
    'a.png',
    'C:x',
    'a\u0000b',
    '�',
    'a'.repeat(129),
  ),
  fc.string({ minLength: 1, maxLength: 12 }).filter((s) => !/^[A-Za-z0-9_-]+$/.test(s)),
);

const BYTES = new Uint8Array([1, 2, 3]);

function build(cardId: string, elementId: string, behaviorId: string, assetId: string): Stack {
  return {
    stackId: 's1',
    title: 'T',
    formatVersion: FORMAT_VERSION,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    entryCardId: cardId,
    cardOrder: [cardId],
    stateSchema: {},
    assetRegistry: {
      [assetId]: {
        assetId,
        relativePath: 'x.png',
        mimeType: 'image/png',
        byteSize: 3,
        checksum: sha256Hex(BYTES),
      },
    },
    cards: {
      [cardId]: {
        cardId,
        title: 'C',
        behaviors: [],
        elements: [
          {
            elementId,
            type: 'text',
            name: 'e',
            properties: { text: 'hi' },
            layout: { x: 0, y: 0, width: 10, height: 10, zIndex: 0 },
            behaviors: [{ behaviorId, trigger: 'element.click', conditions: [], actions: [], enabled: true }],
          },
        ],
      },
    },
    viewportDefaults: { width: 800, height: 600 },
  } as unknown as Stack;
}

describe('path-safe ids', () => {
  it('a Stack with safe ids validates', () => {
    fc.assert(
      fc.property(safe, safe, safe, safe, (c, e, b, a) => {
        expect(validateStack(build(c, e, b, a)).ok).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('any unsafe card, element, asset or behavior id is rejected with a message naming the kind', () => {
    fc.assert(
      fc.property(hostile, fc.constantFrom(0, 1, 2, 3), (bad, slot) => {
        const ids = ['c1', 'e1', 'b1', 'a1'];
        ids[slot] = bad;
        const r = validateStack(build(ids[0]!, ids[1]!, ids[2]!, ids[3]!));
        expect(r.ok).toBe(false);
        // An empty id is already rejected by the schema, before the safe-id check.
        if (!r.ok && bad !== '') expect(r.error.message).toMatch(/Unsafe (card|element|behavior|asset) id/);
      }),
      { numRuns: 200 },
    );
  });

  it('safe ids survive .gsp export then import unchanged', () => {
    fc.assert(
      fc.property(safe, safe, safe, safe, (c, e, b, a) => {
        const stack = build(c, e, b, a);
        const exported = exportGsp(stack, { [a]: BYTES });
        expect(exported.ok).toBe(true);
        if (!exported.ok) return;
        const back = importGsp(exported.value);
        expect(back.ok).toBe(true);
        if (back.ok) {
          expect(back.value.stack).toEqual(stack);
          expect(back.value.assets[a]).toEqual(BYTES);
        }
      }),
      { numRuns: 100 },
    );
  });
});
