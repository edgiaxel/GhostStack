import { z } from 'zod';

export const FORMAT_VERSION = 1 as const;

export const MAX_TITLE_CODE_POINTS = 100;
export const MAX_ASSET_BYTES = 26_214_400;
export const DEFAULT_VIEWPORT = { width: 1280, height: 720 } as const;

export const ViewportDefaultsSchema = z.strictObject({
  width: z.number().int().min(1).max(16384),
  height: z.number().int().min(1).max(16384),
});

// Empty in M1 and not interpreted by any code yet.
export const StateEntrySchema = z.strictObject({
  type: z.enum(['string', 'number', 'boolean']),
  initial: z.union([z.string(), z.number(), z.boolean()]),
});

export const LayoutSchema = z.strictObject({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().min(0),
  height: z.number().finite().min(0),
});

const elementBase = {
  elementId: z.string(),
  name: z.string().max(100),
  layout: LayoutSchema,
};

export const ELEMENT_TYPES = ['text', 'button', 'input', 'image', 'shape', 'line'] as const;

export const ElementSchema = z.discriminatedUnion('type', [
  z.strictObject({
    ...elementBase,
    type: z.literal('text'),
    properties: z.strictObject({ text: z.string().max(10000) }),
  }),
  z.strictObject({
    ...elementBase,
    type: z.literal('button'),
    properties: z.strictObject({ label: z.string().max(200) }),
  }),
  z.strictObject({
    ...elementBase,
    type: z.literal('input'),
    properties: z.strictObject({ placeholder: z.string().max(200) }),
  }),
  z.strictObject({
    ...elementBase,
    type: z.literal('image'),
    properties: z.strictObject({ assetId: z.string().nullable(), alt: z.string().max(500) }),
  }),
  z.strictObject({
    ...elementBase,
    type: z.literal('shape'),
    properties: z.strictObject({
      shape: z.enum(['rectangle', 'ellipse']),
      fill: z.string().max(64),
    }),
  }),
  z.strictObject({
    ...elementBase,
    type: z.literal('line'),
    properties: z.strictObject({
      stroke: z.string().max(64),
      strokeWidth: z.number().finite().min(0),
    }),
  }),
]);

export const CardSchema = z.strictObject({
  cardId: z.string(),
  title: z.string().max(MAX_TITLE_CODE_POINTS),
  elements: z.array(ElementSchema),
});

// Integer, range, path and checksum rules run in the semantic validation phase.
export const AssetSchema = z.strictObject({
  assetId: z.string(),
  relativePath: z.string(),
  mimeType: z.string().max(127),
  byteSize: z.number(),
  checksum: z.string(),
});

// Title may be empty in stored data; the factory enforces 1 to 100 code points for new Stacks.
// Code-point length and ID patterns are checked in the semantic phase.
export const StackSchema = z.strictObject({
  stackId: z.string(),
  title: z.string(),
  formatVersion: z.literal(FORMAT_VERSION),
  createdAt: z.string(),
  updatedAt: z.string(),
  entryCardId: z.string(),
  cardOrder: z.array(z.string()),
  cards: z.record(z.string(), CardSchema),
  assetRegistry: z.record(z.string(), AssetSchema),
  stateSchema: z.record(z.string(), StateEntrySchema),
  viewportDefaults: ViewportDefaultsSchema,
});

export type ViewportDefaults = z.infer<typeof ViewportDefaultsSchema>;
export type StateEntry = z.infer<typeof StateEntrySchema>;
export type Layout = z.infer<typeof LayoutSchema>;
export type Stack = z.infer<typeof StackSchema>;
export type Project = Stack;
export type Card = z.infer<typeof CardSchema>;
export type Element = z.infer<typeof ElementSchema>;
export type ElementType = Element['type'];
export type Asset = z.infer<typeof AssetSchema>;

export type AssetBytes = Readonly<Record<string, Uint8Array>>;
export interface ProjectBundle {
  readonly stack: Stack;
  readonly assets: AssetBytes;
}
