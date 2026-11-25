import { z } from 'zod';
import type { ElementType } from './project';

/**
 * Per-type `Element.properties` contract. The card editor writes these keys, the runtime and the
 * player read them. Schemas are strict so unknown keys from imports or AI output are rejected.
 * Colors are hex or `transparent` only, so values are safe to place in a style attribute.
 */

export const ColorSchema = z
  .string()
  .regex(/^(#[0-9a-fA-F]{3,8}|transparent)$/, 'Use a hex color or transparent');

const common = {
  /** Initial visibility. Default true. `show` and `hide` actions change it at runtime. */
  visible: z.boolean().optional(),
  opacity: z.number().min(0).max(1).optional(),
};
const fontSize = z.number().min(8).max(200).optional();
const text = z.string().max(10_000);

export const TextPropertiesSchema = z
  .object({
    ...common,
    text,
    fontSize,
    fontWeight: z.enum(['normal', 'bold']).optional(),
    align: z.enum(['left', 'center', 'right']).optional(),
    color: ColorSchema.optional(),
  })
  .strict();

export const ButtonPropertiesSchema = z
  .object({
    ...common,
    text,
    fontSize,
    color: ColorSchema.optional(),
    background: ColorSchema.optional(),
  })
  .strict();

export const InputPropertiesSchema = z
  .object({
    ...common,
    placeholder: z.string().max(500).optional(),
    defaultValue: z.string().max(10_000).optional(),
    fontSize,
    /** State variable that receives the typed value on every change. Must exist in `stateSchema`. */
    stateKey: z.string().min(1).optional(),
  })
  .strict();

export const ImagePropertiesSchema = z
  .object({
    ...common,
    alt: z.string().max(500),
    fit: z.enum(['contain', 'cover', 'fill']).optional(),
  })
  .strict();

export const ShapePropertiesSchema = z
  .object({
    ...common,
    shape: z.enum(['rect', 'ellipse']),
    fill: ColorSchema.optional(),
    stroke: ColorSchema.optional(),
    strokeWidth: z.number().min(0).max(64).optional(),
    radius: z.number().min(0).max(1000).optional(),
  })
  .strict();

/** A line runs from the top-left to the bottom-right of its layout box; `flipY` runs bottom-left to top-right. */
export const LinePropertiesSchema = z
  .object({
    ...common,
    stroke: ColorSchema.optional(),
    strokeWidth: z.number().min(0).max(64).optional(),
    flipY: z.boolean().optional(),
  })
  .strict();

export const ELEMENT_PROPERTY_SCHEMAS = {
  text: TextPropertiesSchema,
  button: ButtonPropertiesSchema,
  input: InputPropertiesSchema,
  image: ImagePropertiesSchema,
  shape: ShapePropertiesSchema,
  line: LinePropertiesSchema,
} as const satisfies Record<ElementType, z.ZodType>;

export function validateElementProperties(
  type: ElementType,
  properties: unknown,
): { ok: true; value: Record<string, unknown> } | { ok: false; message: string } {
  const parsed = ELEMENT_PROPERTY_SCHEMAS[type].safeParse(properties);
  if (parsed.success) return { ok: true, value: parsed.data as Record<string, unknown> };
  const issue = parsed.error.issues[0];
  return {
    ok: false,
    message: `${type} properties: ${issue?.path.join('.') ?? ''} ${issue?.message ?? ''}`.trim(),
  };
}

/** Starting properties and size for a freshly inserted element. */
export const ELEMENT_DEFAULTS: Record<
  ElementType,
  { name: string; width: number; height: number; properties: Record<string, unknown> }
> = {
  text: { name: 'Text', width: 240, height: 40, properties: { text: 'Text', fontSize: 20 } },
  button: { name: 'Button', width: 160, height: 44, properties: { text: 'Button', fontSize: 16 } },
  input: { name: 'Input', width: 240, height: 40, properties: { placeholder: 'Type here', fontSize: 16 } },
  image: { name: 'Image', width: 240, height: 160, properties: { alt: '', fit: 'contain' } },
  shape: { name: 'Shape', width: 160, height: 120, properties: { shape: 'rect', fill: '#7c5cff' } },
  line: { name: 'Line', width: 200, height: 0, properties: { stroke: '#8a8aa0', strokeWidth: 2 } },
};
