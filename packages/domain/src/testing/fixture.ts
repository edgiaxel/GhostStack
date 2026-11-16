import { FORMAT_VERSION } from '../schemas';
import type { Card, ProjectBundle } from '../schemas';
import { checksumOf } from './sha256';

const STACK_ID = 'stk_00000000-0000-4000-8000-000000000001';
const CARD_IDS = [
  'crd_00000000-0000-4000-8000-000000000001',
  'crd_00000000-0000-4000-8000-000000000002',
  'crd_00000000-0000-4000-8000-000000000003',
] as const;
const ASSET_IDS = [
  'ast_00000000-0000-4000-8000-000000000001',
  'ast_00000000-0000-4000-8000-000000000002',
] as const;
const TIMESTAMP = '2026-01-01T00:00:00.000Z';
const LAYOUT = { x: 10, y: 10, width: 200, height: 40 };

/** Deterministic project: three cards, two assets, the second asset has zero bytes. */
export function buildFixtureBundle(): ProjectBundle {
  const pictureBytes = Uint8Array.from([0x47, 0x68, 0x6f, 0x73, 0x74, 0x00, 0xff, 0x10]);
  const emptyBytes = new Uint8Array(0);
  const [first, second, third] = CARD_IDS;
  const [picture, empty] = ASSET_IDS;

  const cards: Card[] = [
    {
      cardId: first,
      title: 'Welcome',
      elements: [
        {
          elementId: 'elm_00000000-0000-4000-8000-000000000001',
          type: 'text',
          name: 'Heading',
          layout: LAYOUT,
          properties: { text: 'Welcome to the stack' },
        },
        {
          elementId: 'elm_00000000-0000-4000-8000-000000000002',
          type: 'button',
          name: 'Next',
          layout: LAYOUT,
          properties: { label: 'Next card' },
        },
      ],
    },
    {
      cardId: second,
      title: 'Picture',
      elements: [
        {
          elementId: 'elm_00000000-0000-4000-8000-000000000003',
          type: 'image',
          name: 'Picture',
          layout: LAYOUT,
          properties: { assetId: picture, alt: 'A small picture' },
        },
      ],
    },
    {
      cardId: third,
      title: 'Empty file',
      elements: [
        {
          elementId: 'elm_00000000-0000-4000-8000-000000000004',
          type: 'image',
          name: 'Placeholder',
          layout: LAYOUT,
          properties: { assetId: empty, alt: '' },
        },
      ],
    },
  ];

  return {
    stack: {
      stackId: STACK_ID,
      title: 'Fixture stack',
      formatVersion: FORMAT_VERSION,
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
      entryCardId: first,
      cardOrder: [...CARD_IDS],
      cards: Object.fromEntries(cards.map((card) => [card.cardId, card])),
      assetRegistry: {
        [picture]: {
          assetId: picture,
          relativePath: 'assets/picture.bin',
          mimeType: 'application/octet-stream',
          byteSize: pictureBytes.length,
          checksum: checksumOf(pictureBytes),
        },
        [empty]: {
          assetId: empty,
          relativePath: 'assets/empty.bin',
          mimeType: 'application/octet-stream',
          byteSize: 0,
          checksum: checksumOf(emptyBytes),
        },
      },
      stateSchema: {},
      viewportDefaults: { width: 1280, height: 720 },
    },
    assets: { [picture]: pictureBytes, [empty]: emptyBytes },
  };
}
