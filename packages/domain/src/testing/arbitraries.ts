import fc from 'fast-check';
import type { IdPrefix } from '../ids';
import { FORMAT_VERSION, MAX_ASSET_BYTES, MAX_TITLE_CODE_POINTS } from '../schemas';
import type {
  Asset,
  AssetBytes,
  Card,
  Element,
  ProjectBundle,
  Stack,
  StateEntry,
} from '../schemas';
import type { PathSegment, ValidationErrorCode } from '../validation/types';
import { checksumOf } from './sha256';

export const MAX_ARBITRARY_ASSET_BYTES = 2048;

const arbCodePoint: fc.Arbitrary<string> = fc
  .oneof(
    { weight: 4, arbitrary: fc.integer({ min: 0x20, max: 0x7e }) },
    { weight: 2, arbitrary: fc.integer({ min: 0xa0, max: 0xd7ff }) },
    { weight: 1, arbitrary: fc.integer({ min: 0xe000, max: 0xfffd }) },
    { weight: 1, arbitrary: fc.integer({ min: 0x10000, max: 0x10ffff }) },
  )
  .map((codePoint) => String.fromCodePoint(codePoint));

// No lone surrogates, so text survives UTF-8 and JSON round trips unchanged.
const arbText = (maxCodePoints: number, minCodePoints = 0): fc.Arbitrary<string> =>
  fc
    .array(arbCodePoint, { minLength: minCodePoints, maxLength: maxCodePoints })
    .map((parts) => parts.join(''));

// Up to 100 code points, the limit the validator applies. Astral characters make the
// UTF-16 length exceed 100, which the structural phase deliberately ignores for card titles.
const arbTitle: fc.Arbitrary<string> = arbText(MAX_TITLE_CODE_POINTS);

// `+ 0` turns -0 into 0 so values survive a JSON round trip.
const arbFiniteNumber = (min: number, max: number): fc.Arbitrary<number> =>
  fc.double({ min, max, noNaN: true, noDefaultInfinity: true }).map((value) => value + 0);

export const arbId = (prefix: IdPrefix): fc.Arbitrary<string> =>
  fc.uuid({ version: 4 }).map((uuid) => `${prefix}_${uuid}`);

const arbLayout = fc.record({
  x: arbFiniteNumber(-100_000, 100_000),
  y: arbFiniteNumber(-100_000, 100_000),
  width: arbFiniteNumber(0, 100_000),
  height: arbFiniteNumber(0, 100_000),
});

/** Image elements reference one of `assetIds`, or null when the list is empty or by choice. */
export function arbElement(assetIds: readonly string[] = []): fc.Arbitrary<Element> {
  const common = {
    elementId: arbId('elm'),
    name: arbText(100),
    layout: arbLayout,
  };
  const imageAsset: fc.Arbitrary<string | null> =
    assetIds.length === 0
      ? fc.constant(null)
      : fc.oneof(fc.constant(null), fc.constantFrom(...assetIds));
  return fc.oneof(
    fc.record({
      ...common,
      type: fc.constant('text' as const),
      properties: fc.record({ text: arbText(200) }),
    }),
    fc.record({
      ...common,
      type: fc.constant('button' as const),
      properties: fc.record({ label: arbText(50) }),
    }),
    fc.record({
      ...common,
      type: fc.constant('input' as const),
      properties: fc.record({ placeholder: arbText(50) }),
    }),
    fc.record({
      ...common,
      type: fc.constant('image' as const),
      properties: fc.record({ assetId: imageAsset, alt: arbText(100) }),
    }),
    fc.record({
      ...common,
      type: fc.constant('shape' as const),
      properties: fc.record({
        shape: fc.constantFrom('rectangle' as const, 'ellipse' as const),
        fill: arbText(20),
      }),
    }),
    fc.record({
      ...common,
      type: fc.constant('line' as const),
      properties: fc.record({ stroke: arbText(20), strokeWidth: arbFiniteNumber(0, 1000) }),
    }),
  );
}

export function arbCard(assetIds: readonly string[] = []): fc.Arbitrary<Card> {
  return fc.record({
    cardId: arbId('crd'),
    title: arbTitle,
    elements: fc.uniqueArray(arbElement(assetIds), {
      selector: (element) => element.elementId,
      maxLength: 5,
    }),
  });
}

export interface AssetWithBytes {
  readonly asset: Asset;
  readonly bytes: Uint8Array;
}

// Zero-length bytes get their own branch so the empty case shows up often.
const arbAssetBytes: fc.Arbitrary<Uint8Array> = fc.oneof(
  { weight: 1, arbitrary: fc.constant(new Uint8Array(0)) },
  { weight: 4, arbitrary: fc.uint8Array({ minLength: 0, maxLength: MAX_ARBITRARY_ASSET_BYTES }) },
);

const ASSET_NAME_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-';
const arbAssetName = fc
  .array(fc.constantFrom(...ASSET_NAME_CHARS), { minLength: 1, maxLength: 40 })
  .map((chars) => chars.join(''))
  .filter((name) => name !== '.' && name !== '..');

/** A registry entry with the bytes it describes: real size and real SHA-256 checksum. */
export const arbAsset: fc.Arbitrary<AssetWithBytes> = fc
  .record({
    assetId: arbId('ast'),
    name: arbAssetName,
    mimeType: fc.constantFrom('image/png', 'image/jpeg', 'text/plain', 'application/octet-stream'),
    bytes: arbAssetBytes,
  })
  .map(({ assetId, name, mimeType, bytes }) => ({
    asset: {
      assetId,
      relativePath: `assets/${name}`,
      mimeType,
      byteSize: bytes.length,
      checksum: checksumOf(bytes),
    },
    bytes,
  }));

const arbStateEntry: fc.Arbitrary<StateEntry> = fc.oneof(
  fc.record({ type: fc.constant('string' as const), initial: arbText(20) }),
  fc.record({ type: fc.constant('number' as const), initial: arbFiniteNumber(-1e6, 1e6) }),
  fc.record({ type: fc.constant('boolean' as const), initial: fc.boolean() }),
);

const arbTimestamp = fc
  .date({
    min: new Date('2000-01-01T00:00:00.000Z'),
    max: new Date('2100-01-01T00:00:00.000Z'),
    noInvalidDate: true,
  })
  .map((date) => date.toISOString());

/** A valid project plus matching bytes for every registered asset. Passes `validateProject`. */
export const arbBundle: fc.Arbitrary<ProjectBundle> = fc
  .uniqueArray(arbAsset, { selector: (entry) => entry.asset.assetId, maxLength: 3 })
  .chain((entries) => {
    // Index prefix keeps relative paths unique when generated names collide.
    const assets = entries.map(({ asset, bytes }, index) => ({
      asset: {
        ...asset,
        relativePath: `assets/${index}_${asset.relativePath.slice('assets/'.length)}`,
      },
      bytes,
    }));
    const assetIds = assets.map(({ asset }) => asset.assetId);
    return fc
      .uniqueArray(arbCard(assetIds), {
        minLength: 1,
        maxLength: 4,
        selector: (card) => card.cardId,
      })
      .chain((cards) => {
        const cardIds = cards.map((card) => card.cardId);
        return fc
          .record({
            stackId: arbId('stk'),
            title: arbTitle,
            createdAt: arbTimestamp,
            updatedAt: arbTimestamp,
            entryCardId: fc.constantFrom(...cardIds),
            cardOrder: fc.shuffledSubarray(cardIds, {
              minLength: cardIds.length,
              maxLength: cardIds.length,
            }),
            stateSchema: fc.dictionary(
              fc.stringMatching(/^[a-z][a-zA-Z0-9]{0,15}$/),
              arbStateEntry,
              {
                maxKeys: 3,
              },
            ),
            viewportDefaults: fc.record({
              width: fc.integer({ min: 1, max: 16384 }),
              height: fc.integer({ min: 1, max: 16384 }),
            }),
          })
          .map((fields): ProjectBundle => {
            const stack: Stack = {
              ...fields,
              formatVersion: FORMAT_VERSION,
              cards: Object.fromEntries(cards.map((card) => [card.cardId, card])),
              assetRegistry: Object.fromEntries(assets.map(({ asset }) => [asset.assetId, asset])),
            };
            const bytes: AssetBytes = Object.fromEntries(
              assets.map(({ asset, bytes: data }) => [asset.assetId, data]),
            );
            return { stack, assets: bytes };
          });
      });
  });

// JSON round trip drops anything JSON cannot hold, so the result is always plain JSON data.
export const arbJsonValue: fc.Arbitrary<unknown> = fc
  .jsonValue()
  .map((value) => JSON.parse(JSON.stringify(value)) as unknown);

/**
 * A defect injected into a valid Stack. `apply` returns a modified deep copy and leaves its
 * input untouched. `validateProject` must report `code` with the given `path` and `details`.
 */
export interface Fault {
  readonly code: ValidationErrorCode;
  /** Absent when the index depends on the input, as with card order entries. */
  readonly path?: readonly PathSegment[];
  readonly details: Readonly<Record<string, string | number>>;
  readonly apply: (stack: Stack) => unknown;
}

type Rec = Record<string, unknown>;

const edit = (stack: Stack, change: (doc: Rec) => void): unknown => {
  const doc = structuredClone(stack) as unknown as Rec;
  change(doc);
  return doc;
};
const child = (doc: Rec, key: string): Rec => doc[key] as Rec;
const blankCard = (cardId: string): Card => ({ cardId, title: 'Fault card', elements: [] });
const LAYOUT = { x: 0, y: 0, width: 1, height: 1 };
const textElement = (elementId: string): Element => ({
  elementId,
  type: 'text',
  name: 'Fault text',
  layout: LAYOUT,
  properties: { text: 'x' },
});
const sampleAsset = (assetId: string): Asset => ({
  assetId,
  relativePath: 'assets/fault.bin',
  mimeType: 'application/octet-stream',
  byteSize: 1,
  checksum: `sha256:${'0'.repeat(64)}`,
});

const REQUIRED_FIELDS = [
  'stackId',
  'title',
  'createdAt',
  'updatedAt',
  'entryCardId',
  'cardOrder',
  'cards',
  'assetRegistry',
  'stateSchema',
  'viewportDefaults',
] as const;

const BAD_PATHS = [
  ['null-char', 'assets/a\u0000b'],
  ['backslash', 'assets\\a'],
  ['absolute', '/etc/passwd'],
  ['dot-dot', 'assets/../x'],
  ['prefix', 'files/a.png'],
  ['charset', 'assets/a b'],
] as const;

const BAD_SIZES = [
  ['non-integer', 1.5],
  ['negative', -1],
  ['too-large', MAX_ASSET_BYTES + 1],
] as const;

const BAD_CHECKSUMS = ['md5:abc', `sha256:${'A'.repeat(64)}`, `sha256:${'a'.repeat(63)}`] as const;

// A real calendar failure and a format failure.
const BAD_TIMESTAMPS = ['2026-02-30T00:00:00.000Z', '2026-01-01', 'yesterday'] as const;

const overlong = (): string => '\u{1F47B}'.repeat(MAX_TITLE_CODE_POINTS + 1);

const arbCardFault = fc.tuple(arbId('crd'), arbId('crd')).chain(([a, b]): fc.Arbitrary<Fault> => {
  const faults: Fault[] = [
    {
      code: 'ENTRY_CARD_NOT_FOUND',
      path: ['entryCardId'],
      details: { cardId: a },
      apply: (stack) => edit(stack, (doc) => (doc['entryCardId'] = a)),
    },
    {
      code: 'CARD_ORDER_OMITS_CARD',
      path: ['cardOrder'],
      details: { cardId: a },
      apply: (stack) =>
        edit(stack, (doc) => {
          child(doc, 'cards')[a] = blankCard(a);
        }),
    },
    {
      code: 'CARD_KEY_MISMATCH',
      path: ['cards', a, 'cardId'],
      details: { cardId: b, key: a },
      apply: (stack) =>
        edit(stack, (doc) => {
          child(doc, 'cards')[a] = blankCard(b);
        }),
    },
    {
      code: 'CARD_ID_DUPLICATE',
      path: ['cards'],
      details: { cardId: b },
      apply: (stack) =>
        edit(stack, (doc) => {
          const cards = child(doc, 'cards');
          cards[a] = blankCard(b);
          cards[b] = blankCard(b);
        }),
    },
  ];
  return fc.constantFrom(...faults);
});

const arbOrderFault = arbId('crd').chain((fresh): fc.Arbitrary<Fault> => {
  const order = (doc: Rec): unknown[] => doc['cardOrder'] as unknown[];
  return fc.constantFrom<Fault>(
    {
      code: 'CARD_ORDER_REFERENCE_NOT_FOUND',
      details: { cardId: fresh },
      apply: (stack) => edit(stack, (doc) => order(doc).push(fresh)),
    },
    {
      code: 'CARD_ORDER_DUPLICATE',
      details: {},
      apply: (stack) =>
        edit(stack, (doc) => {
          const list = order(doc);
          if (list.length === 0) list.push(fresh, fresh);
          else list.push(list[0]);
        }),
    },
  );
});

const arbElementFault = fc
  .tuple(arbId('crd'), arbId('elm'), arbId('ast'))
  .chain(([cardId, elementId, assetId]): fc.Arbitrary<Fault> => {
    const withCard = (stack: Stack, elements: Element[]): unknown =>
      edit(stack, (doc) => {
        child(doc, 'cards')[cardId] = { ...blankCard(cardId), elements };
        (doc['cardOrder'] as unknown[]).push(cardId);
      });
    return fc.constantFrom<Fault>(
      {
        code: 'ELEMENT_ID_DUPLICATE',
        path: ['cards', cardId, 'elements', 1, 'elementId'],
        details: { elementId, cardId },
        apply: (stack) => withCard(stack, [textElement(elementId), textElement(elementId)]),
      },
      {
        code: 'ELEMENT_ASSET_NOT_FOUND',
        path: ['cards', cardId, 'elements', 0, 'properties', 'assetId'],
        details: { elementId, cardId, assetId },
        apply: (stack) =>
          withCard(stack, [
            {
              elementId,
              type: 'image',
              name: 'Missing asset',
              layout: LAYOUT,
              properties: { assetId, alt: '' },
            },
          ]),
      },
    );
  });

const arbAssetFault = fc.tuple(arbId('ast'), arbId('ast')).chain(([a, b]): fc.Arbitrary<Fault> => {
  const withAsset = (stack: Stack, key: string, asset: Asset): unknown =>
    edit(stack, (doc) => {
      child(doc, 'assetRegistry')[key] = asset;
    });
  const faults: Fault[] = [
    {
      code: 'ASSET_KEY_MISMATCH',
      path: ['assetRegistry', a, 'assetId'],
      details: { assetId: b, key: a },
      apply: (stack) => withAsset(stack, a, sampleAsset(b)),
    },
    ...BAD_PATHS.map(([rule, relativePath]): Fault => ({
      code: 'ASSET_PATH_INVALID',
      path: ['assetRegistry', a, 'relativePath'],
      details: { assetId: a, rule },
      apply: (stack) => withAsset(stack, a, { ...sampleAsset(a), relativePath }),
    })),
    ...BAD_SIZES.map(([rule, byteSize]): Fault => ({
      code: 'ASSET_SIZE_INVALID',
      path: ['assetRegistry', a, 'byteSize'],
      details: { assetId: a, rule },
      apply: (stack) => withAsset(stack, a, { ...sampleAsset(a), byteSize }),
    })),
    ...BAD_CHECKSUMS.map((checksum): Fault => ({
      code: 'ASSET_CHECKSUM_INVALID',
      path: ['assetRegistry', a, 'checksum'],
      details: { assetId: a },
      apply: (stack) => withAsset(stack, a, { ...sampleAsset(a), checksum }),
    })),
  ];
  return fc.constantFrom(...faults);
});

const arbStackFault = fc
  .record({
    field: fc.constantFrom(...REQUIRED_FIELDS),
    extraKey: fc.stringMatching(/^[a-z]{1,12}$/).map((key) => `extra_${key}`),
    timestampField: fc.constantFrom('createdAt' as const, 'updatedAt' as const),
    timestamp: fc.constantFrom(...BAD_TIMESTAMPS),
  })
  .chain(({ field, extraKey, timestampField, timestamp }): fc.Arbitrary<Fault> =>
    fc.constantFrom<Fault>(
      {
        code: 'MISSING_FIELD',
        path: [field],
        details: {},
        apply: (stack) => edit(stack, (doc) => delete doc[field]),
      },
      {
        code: 'UNKNOWN_FIELD',
        path: [extraKey],
        details: {},
        apply: (stack) => edit(stack, (doc) => (doc[extraKey] = true)),
      },
      {
        code: 'INVALID_TYPE',
        path: ['title'],
        details: {},
        apply: (stack) => edit(stack, (doc) => (doc['title'] = 5)),
      },
      {
        code: 'INVALID_VALUE',
        path: ['formatVersion'],
        details: {},
        apply: (stack) => edit(stack, (doc) => (doc['formatVersion'] = FORMAT_VERSION + 1)),
      },
      {
        code: 'INVALID_ID',
        path: ['stackId'],
        details: { field: 'stackId' },
        apply: (stack) => edit(stack, (doc) => (doc['stackId'] = 'not-an-id')),
      },
      {
        code: 'TITLE_TOO_LONG',
        path: ['title'],
        details: { field: 'title' },
        apply: (stack) => edit(stack, (doc) => (doc['title'] = overlong())),
      },
      {
        code: 'TIMESTAMP_INVALID',
        path: [timestampField],
        details: { field: timestampField },
        apply: (stack) => edit(stack, (doc) => (doc[timestampField] = timestamp)),
      },
    ),
  );

/** One injected defect, covering every code except `VALIDATOR_INTERNAL_ERROR`. */
export const arbFault: fc.Arbitrary<Fault> = fc.oneof(
  arbStackFault,
  arbCardFault,
  arbOrderFault,
  arbElementFault,
  arbAssetFault,
);
