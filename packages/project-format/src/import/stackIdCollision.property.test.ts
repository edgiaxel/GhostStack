import { ID_PATTERNS } from '@ghoststack/domain';
import { arbBundle, arbId } from '@ghoststack/domain/testing';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { serializeProject } from '../serialize';
import { importProject } from './importProject';

describe('Property 22: Imported stack IDs never collide with existing projects', () => {
  /**
   * **Validates: Requirements 10.14, 11.1**
   */
  it('keeps the original stack ID when free and replaces only stackId on collision', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbBundle,
        fc.array(arbId('stk'), { maxLength: 8 }),
        fc.boolean(),
        async (bundle, others, includeOriginal) => {
          const original = bundle.stack.stackId;
          const existing = new Set(others);
          if (includeOriginal) existing.add(original);
          else existing.delete(original);

          const exported = await serializeProject(bundle);
          expect(exported.ok).toBe(true);
          if (!exported.ok) return;

          const imported = await importProject(exported.value, { existingStackIds: existing });
          expect(imported.ok).toBe(true);
          if (!imported.ok) return;
          const { stack, assets } = imported.value;

          expect(existing.has(stack.stackId)).toBe(false);
          expect(assets).toEqual(bundle.assets);
          if (includeOriginal) {
            expect(stack.stackId).not.toBe(original);
            expect(stack.stackId).toMatch(ID_PATTERNS.stk);
            expect({ ...stack, stackId: original }).toEqual(bundle.stack);
          } else {
            expect(stack).toEqual(bundle.stack);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
