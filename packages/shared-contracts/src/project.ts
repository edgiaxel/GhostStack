import { z } from 'zod';

/** Current `.gsp` / stored Stack format version. Bump only via the contract owner. */
export const FORMAT_VERSION = 1 as const;

export const ElementTypeSchema = z.enum(['text', 'button', 'input', 'image', 'shape', 'line']);
export type ElementType = z.infer<typeof ElementTypeSchema>;

export const LayoutSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().nonnegative(),
  height: z.number().nonnegative(),
  zIndex: z.number().int(),
});
export type Layout = z.infer<typeof LayoutSchema>;

export const ElementSchema = z.object({
  elementId: z.string().min(1),
  type: ElementTypeSchema,
  name: z.string(),
  properties: z.record(z.string(), z.unknown()),
  layout: LayoutSchema,
  assetId: z.string().min(1).optional(),
  /** Typed by the behavior package in VS-04. Stored opaque until then. */
  behaviors: z.array(z.unknown()),
});
export type Element = z.infer<typeof ElementSchema>;

export const CardSchema = z.object({
  cardId: z.string().min(1),
  title: z.string(),
  elements: z.array(ElementSchema),
  /** Typed by the behavior package in VS-04. Stored opaque until then. */
  behaviors: z.array(z.unknown()),
});
export type Card = z.infer<typeof CardSchema>;

export const AssetSchema = z.object({
  assetId: z.string().min(1),
  relativePath: z.string().min(1),
  mimeType: z.string().min(1),
  byteSize: z.number().int().nonnegative(),
  checksum: z.string().min(1),
});
export type Asset = z.infer<typeof AssetSchema>;

export const StackSchema = z.object({
  stackId: z.string().min(1),
  title: z.string(),
  formatVersion: z.literal(FORMAT_VERSION),
  /** ISO 8601 */
  createdAt: z.string(),
  /** ISO 8601 */
  updatedAt: z.string(),
  entryCardId: z.string().min(1),
  cardOrder: z.array(z.string().min(1)),
  stateSchema: z.record(z.string(), z.unknown()),
  cards: z.record(z.string(), CardSchema),
  assetRegistry: z.record(z.string(), AssetSchema),
  viewportDefaults: z.object({ width: z.number().positive(), height: z.number().positive() }),
});
export type Stack = z.infer<typeof StackSchema>;

export const DEFAULT_VIEWPORT = { width: 1280, height: 720 } as const;
