import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  AssetSchema,
  CardSchema,
  ELEMENT_TYPES,
  ElementSchema,
  FORMAT_VERSION,
  StackSchema,
  type Asset,
  type Card,
  type Element,
  type ElementType,
  type Layout,
  type Project,
  type Stack,
  type StateEntry,
  type ViewportDefaults,
} from './schemas';

const layout: Layout = { x: 0, y: 0, width: 100, height: 40 };
const base = { elementId: 'elm_x', name: 'n', layout };

const elementSamples: Record<ElementType, unknown> = {
  text: { ...base, type: 'text', properties: { text: 'hi' } },
  button: { ...base, type: 'button', properties: { label: 'Go' } },
  input: { ...base, type: 'input', properties: { placeholder: 'Name' } },
  image: { ...base, type: 'image', properties: { assetId: null, alt: '' } },
  shape: { ...base, type: 'shape', properties: { shape: 'ellipse', fill: '#fff' } },
  line: { ...base, type: 'line', properties: { stroke: '#000', strokeWidth: 2 } },
};

function sampleStack(): Stack {
  return {
    stackId: 'stk_a',
    title: 'Demo',
    formatVersion: FORMAT_VERSION,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    entryCardId: 'crd_a',
    cardOrder: ['crd_a'],
    cards: { crd_a: { cardId: 'crd_a', title: 'Card 1', elements: [] } },
    assetRegistry: {},
    stateSchema: {},
    viewportDefaults: { width: 1280, height: 720 },
  };
}

describe('ElementSchema', () => {
  it('defines exactly six element types', () => {
    expect([...ELEMENT_TYPES].sort()).toEqual(
      ['button', 'image', 'input', 'line', 'shape', 'text'].sort(),
    );
  });

  it.each(ELEMENT_TYPES)('parses a %s element', (type) => {
    expect(ElementSchema.safeParse(elementSamples[type]).success).toBe(true);
  });

  it('rejects an unknown element type', () => {
    expect(ElementSchema.safeParse({ ...base, type: 'video', properties: {} }).success).toBe(false);
  });

  it('rejects unknown fields on the element and on its properties', () => {
    const text = elementSamples.text as Record<string, unknown>;
    expect(ElementSchema.safeParse({ ...text, extra: 1 }).success).toBe(false);
    expect(
      ElementSchema.safeParse({ ...text, properties: { text: 'hi', apiKey: 'x' } }).success,
    ).toBe(false);
  });
});

describe('StackSchema', () => {
  it('accepts a minimal stack with an empty stateSchema', () => {
    expect(StackSchema.safeParse(sampleStack()).success).toBe(true);
  });

  it('accepts an empty title', () => {
    expect(StackSchema.safeParse({ ...sampleStack(), title: '' }).success).toBe(true);
  });

  it('rejects unknown fields at the root, in a card, in an asset and in viewportDefaults', () => {
    const stack = sampleStack();
    expect(StackSchema.safeParse({ ...stack, token: 'x' }).success).toBe(false);
    expect(
      CardSchema.safeParse({ cardId: 'crd_a', title: 't', elements: [], extra: 1 }).success,
    ).toBe(false);
    expect(
      AssetSchema.safeParse({
        assetId: 'ast_a',
        relativePath: 'assets/a.png',
        mimeType: 'image/png',
        byteSize: 0,
        checksum: 'sha256:x',
        extra: 1,
      }).success,
    ).toBe(false);
    expect(
      StackSchema.safeParse({ ...stack, viewportDefaults: { width: 1, height: 1, dpi: 2 } })
        .success,
    ).toBe(false);
  });

  it('rejects a formatVersion other than 1', () => {
    expect(StackSchema.safeParse({ ...sampleStack(), formatVersion: 2 }).success).toBe(false);
  });

  it('survives a JSON round trip with no undefined values', () => {
    const stack = StackSchema.parse({
      ...sampleStack(),
      cards: {
        crd_a: {
          cardId: 'crd_a',
          title: 'Card 1',
          elements: [elementSamples.image, elementSamples.text],
        },
      },
    });
    expect(JSON.parse(JSON.stringify(stack))).toEqual(stack);
  });
});

describe('inferred types', () => {
  it('match the documented field set', () => {
    expectTypeOf<Stack>().toEqualTypeOf<{
      stackId: string;
      title: string;
      formatVersion: 1;
      createdAt: string;
      updatedAt: string;
      entryCardId: string;
      cardOrder: string[];
      cards: Record<string, Card>;
      assetRegistry: Record<string, Asset>;
      stateSchema: Record<string, StateEntry>;
      viewportDefaults: ViewportDefaults;
    }>();
    expectTypeOf<Project>().toEqualTypeOf<Stack>();
    expectTypeOf<Card>().toEqualTypeOf<{
      cardId: string;
      title: string;
      elements: Element[];
    }>();
    expectTypeOf<Asset>().toEqualTypeOf<{
      assetId: string;
      relativePath: string;
      mimeType: string;
      byteSize: number;
      checksum: string;
    }>();
    expectTypeOf<Element['type']>().toEqualTypeOf<
      'text' | 'button' | 'input' | 'image' | 'shape' | 'line'
    >();
    expectTypeOf<Extract<Element, { type: 'image' }>['properties']>().toEqualTypeOf<{
      assetId: string | null;
      alt: string;
    }>();
  });
});
