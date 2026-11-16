import 'fake-indexeddb/auto';
import { arbBundle, arbFault } from '@ghoststack/domain/testing';
import type { ProjectBundle } from '@ghoststack/domain';
import { IDBFactory } from 'fake-indexeddb';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createIndexedDbStorage } from './indexeddb';
import type { FaultStage } from './indexeddb';
import { createFaultController, createMemoryStorage } from './memory';
import type { StorageErrorCode, StoragePort } from './port';

const ERROR_CODES: readonly StorageErrorCode[] = [
  'not-found',
  'validation-failed',
  'quota-exceeded',
  'storage-unavailable',
  'unsupported-version',
  'write-failed',
];

type WriteFaultCode = 'write-failed' | 'quota-exceeded';

interface Subject {
  readonly port: StoragePort;
  /** Makes the next saveProject fail with `code`; `stage` only matters for IndexedDB. */
  arm(code: WriteFaultCode, stage: FaultStage): void;
}

const adapters: ReadonlyArray<readonly [string, () => Subject]> = [
  [
    'memory',
    () => {
      const faults = createFaultController();
      return { port: createMemoryStorage({ faults }), arm: (code) => faults.failNextWrite(code) };
    },
  ],
  [
    'indexeddb',
    () => {
      let armed: { code: WriteFaultCode; stage: FaultStage } | undefined;
      const port = createIndexedDbStorage({
        factory: new IDBFactory(),
        faultInjection: (stage) => {
          if (armed?.stage !== stage) return;
          const { code } = armed;
          armed = undefined;
          if (code === 'quota-exceeded') throw new DOMException('Quota.', 'QuotaExceededError');
          throw new Error('Injected write failure.');
        },
      });
      return {
        port,
        arm: (code, stage) => {
          armed = { code, stage };
        },
      };
    },
  ],
];

interface Scenario {
  readonly stored: ProjectBundle;
  readonly attempt: ProjectBundle;
  readonly expected: StorageErrorCode;
  readonly inject?: { readonly code: WriteFaultCode; readonly stage: FaultStage };
}

const arbStage = fc.constantFrom<FaultStage>('after-stack-put', 'after-asset-put');
const arbWriteFault = fc.constantFrom<WriteFaultCode>('write-failed', 'quota-exceeded');
const hasAssets = (bundle: ProjectBundle): boolean => Object.keys(bundle.assets).length > 0;

/** The attempted save targets the same stack as the stored one, so it would replace it. */
const retarget = (next: ProjectBundle, stored: ProjectBundle): ProjectBundle => ({
  stack: { ...next.stack, stackId: stored.stack.stackId },
  assets: next.assets,
});

const arbScenario: fc.Arbitrary<Scenario> = fc
  .tuple(arbBundle, arbBundle)
  .chain(([stored, next]) => {
    const attempt = retarget(next, stored);
    const invalid = arbFault.map((fault): Scenario => ({
      stored,
      attempt: { ...attempt, stack: fault.apply(attempt.stack) as ProjectBundle['stack'] },
      expected: 'validation-failed',
    }));
    const missingBytes = fc
      .tuple(arbBundle.filter(hasAssets), fc.nat())
      .map(([withAssets, pick]): Scenario => {
        const target = retarget(withAssets, stored);
        const ids = Object.keys(target.assets);
        const dropped = ids[pick % ids.length];
        const assets = Object.fromEntries(
          Object.entries(target.assets).filter(([assetId]) => assetId !== dropped),
        );
        return { stored, attempt: { stack: target.stack, assets }, expected: 'validation-failed' };
      });
    const writeFault = fc.tuple(arbWriteFault, arbStage).map(([code, stage]): Scenario => ({
      stored,
      attempt,
      expected: code,
      inject: { code, stage },
    }));
    return fc.oneof(invalid, missingBytes, writeFault);
  });

/**
 * Property 10: A failed save leaves stored data unchanged.
 * **Validates: Requirements 5.3, 5.7, 6.5, 6.6**
 */
describe.each(adapters)(
  'Property 10: a failed save leaves stored data unchanged (%s)',
  (_, make) => {
    it('returns a coded error and keeps the stored stack and asset bytes', async () => {
      await fc.assert(
        fc.asyncProperty(arbScenario, async ({ stored, attempt, expected, inject }) => {
          const subject = make();
          const { port } = subject;
          const first = await port.saveProject(stored);
          expect(first.ok).toBe(true);
          if (inject) subject.arm(inject.code, inject.stage);

          const result = await port.saveProject(attempt);

          expect(result.ok).toBe(false);
          if (result.ok) return;
          expect(ERROR_CODES).toContain(result.error.code);
          expect(result.error.code).toBe(expected);

          const loaded = await port.loadProject(stored.stack.stackId);
          expect(loaded.ok).toBe(true);
          if (!loaded.ok) return;
          expect(loaded.value.stack).toEqual(stored.stack);
          expect(loaded.value.assets).toEqual(stored.assets);
        }),
      );
    });
  },
);
