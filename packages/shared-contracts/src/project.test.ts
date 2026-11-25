import { describe, expect, it } from 'vitest';
import { StackSchema, FORMAT_VERSION } from './project';

describe('StackSchema', () => {
  it('rejects an unknown format version', () => {
    const r = StackSchema.safeParse({ formatVersion: FORMAT_VERSION + 1 });
    expect(r.success).toBe(false);
  });
});
