import { z } from 'zod';
import { MAX_ASSET_BYTES } from '@ghoststack/domain';

export const ManifestSchema = z.strictObject({
  formatVersion: z.literal(1),
  producer: z.string().min(1).max(100),
  stackId: z.string(),
  assets: z.array(
    z.strictObject({
      assetId: z.string(),
      relativePath: z.string(),
      mimeType: z.string().max(127),
      byteSize: z.number().int().min(0).max(MAX_ASSET_BYTES),
      checksum: z.string().regex(/^sha256:[0-9a-f]{64}$/),
    }),
  ),
});

export type Manifest = z.infer<typeof ManifestSchema>;
