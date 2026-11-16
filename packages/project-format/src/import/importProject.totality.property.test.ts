import { arbBundle } from '@ghoststack/domain/testing';
import { validateProject } from '@ghoststack/domain';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { serializeProject } from '../serialize';
import { flipByte, truncateArchive } from '../testing/archive';
import { importProject } from './importProject';
import type { ImportError } from './importProject';

async function archiveOf(bundle: Parameters<typeof serializeProject>[0]): Promise<Uint8Array> {
  const result = await serializeProject(bundle);
  if (!result.ok) throw new Error(`Generated bundle failed to export: ${result.error.reason}`);
  return result.value;
}

function expectStructuredFailure(error: ImportError): void {
  expect(error.code).toBe('PROJECT_IMPORT_FAILED');
  expect(typeof error.reason).toBe('string');
  expect(error.reason.length).toBeGreaterThan(0);
  expect(typeof error.message).toBe('string');
  expect(error.message.length).toBeGreaterThan(0);
}

async function expectTotal(bytes: Uint8Array): Promise<void> {
  const result = await importProject(bytes);
  if (result.ok) {
    expect(validateProject(result.value.stack).errors).toEqual([]);
  } else {
    expectStructuredFailure(result.error);
  }
}

describe('Property 18: importer totality and byte flips', () => {
  // Feature: m1-foundation, Property 18: The importer never throws and corruption never yields an invalid project
  // **Validates: Requirements 10.4, 10.16, 11.6**
  it('returns a Result for arbitrary bytes, including empty input', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uint8Array({ maxLength: 512 }), async (bytes) => {
        await expectTotal(bytes);
      }),
      { numRuns: 200 },
    );
  });

  // Feature: m1-foundation, Property 18: The importer never throws and corruption never yields an invalid project
  // **Validates: Requirements 10.4, 10.16, 11.6**
  it('returns a Result for every truncation of a valid archive', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbBundle,
        fc.double({ min: 0, max: 1, noNaN: true }),
        async (bundle, at) => {
          const archive = await archiveOf(bundle);
          const length = Math.min(archive.byteLength - 1, Math.floor(at * archive.byteLength));
          const result = await importProject(truncateArchive(archive, length));
          expect(result.ok).toBe(false);
          if (!result.ok) expectStructuredFailure(result.error);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: m1-foundation, Property 18: The importer never throws and corruption never yields an invalid project
  // **Validates: Requirements 10.4, 10.16, 11.6**
  it('yields a valid project or a structured error for any single flipped byte', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbBundle,
        fc.double({ min: 0, max: 1, noNaN: true, maxExcluded: true }),
        fc.integer({ min: 1, max: 0xff }),
        async (bundle, at, mask) => {
          const archive = await archiveOf(bundle);
          const offset = Math.floor(at * archive.byteLength);
          await expectTotal(flipByte(archive, offset, mask));
        },
      ),
      { numRuns: 300 },
    );
  });
});
