import { z } from 'zod';
import { BehaviorSchema, StateVariableSchema } from './behavior';
import { ColorSchema } from './elements';
import { ANCHORS, SCALE_MODES } from './layout';

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
  /** Edge or center the element keeps its offset to when the viewport size changes. Default top-left. */
  anchor: z.enum(ANCHORS).optional(),
  /** How size and offsets follow the viewport. Default fixed. See 
esolveLayout. */
  scaleMode: z.enum(SCALE_MODES).optional(),
});
export type Layout = z.infer<typeof LayoutSchema>;

export const ElementSchema = z.object({
  elementId: z.string().min(1),
  type: ElementTypeSchema,
  name: z.string(),
  properties: z.record(z.string(), z.unknown()),
  layout: LayoutSchema,
  assetId: z.string().min(1).optional(),
  behaviors: z.array(BehaviorSchema),
});
export type Element = z.infer<typeof ElementSchema>;

export const CardSchema = z.object({
  cardId: z.string().min(1),
  title: z.string(),
  /** Card background color. Absent means RENDER_DEFAULTS.cardBackground. */
  background: ColorSchema.optional(),
  elements: z.array(ElementSchema),
  behaviors: z.array(BehaviorSchema),
});
export type Card = z.infer<typeof CardSchema>;

/** Rejects empty, absolute, drive-letter, backslash, control-char and ./.. paths. */
export function isSafeRelativePath(path: string): boolean {
  if (path.length === 0 || path.startsWith('/') || path.includes('\\') || path.includes(':')) return false;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f]/.test(path)) return false;
  return path.split('/').every((s) => s !== '' && s !== '.' && s !== '..');
}

export const AssetSchema = z.object({
  assetId: z.string().min(1),
  relativePath: z.string().refine(isSafeRelativePath, 'Unsafe asset path'),
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
  stateSchema: z.record(z.string(), StateVariableSchema),
  cards: z.record(z.string(), CardSchema),
  assetRegistry: z.record(z.string(), AssetSchema),
  viewportDefaults: z.object({ width: z.number().positive(), height: z.number().positive() }),
});
export type Stack = z.infer<typeof StackSchema>;

export const DEFAULT_VIEWPORT = { width: 1280, height: 720 } as const;
