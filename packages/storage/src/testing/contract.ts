import { arbBundle, buildFixtureBundle } from '@ghoststack/domain/testing';
import type { ProjectBundle, Result } from '@ghoststack/domain';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { StorageError, StorageErrorCode, StoragePort } from '../port';

const PICTURE = 'ast_00000000-0000-4000-8000-000000000001';
const EMPTY = 'ast_00000000-0000-4000-8000-000000000002';
const EMPTY_CARD = 'crd_00000000-0000-4000-8000-000000000003';
const UNKNOWN_STACK = 'stk_00000000-0000-4000-8000-0000000000aa';
const ASSET_ONLY_STACK = 'stk_00000000-0000-4000-8000-0000000000bb';

export type ContractFaultCode = Extract<StorageErrorCode, 'write-failed' | 'quota-exceeded'>;

/** Makes the next write fail without changing stored state. */
export interface ContractFaults {
  failNextWrite(code: ContractFaultCode): void;
}

export interface ContractSubject {
  readonly port: StoragePort;
  /** Omit when the implementation cannot inject faults; the fault group is skipped. */
  readonly faults?: ContractFaults;
}

/** Must return a fresh, isolated store on every call. */
export type MakeContractSubject = () => ContractSubject | Promise<ContractSubject>;

function unwrap<T>(result: Result<T, StorageError>): T {
  if (!result.ok) throw new Error(`expected ok, got ${result.error.code}`);
  return result.value;
}

function errorOf<T>(result: Result<T, StorageError>): StorageError {
  if (result.ok) throw new Error('expected an error');
  return result.error;
}

function withoutKey<V>(record: Readonly<Record<string, V>>, key: string): Record<string, V> {
  return Object.fromEntries(Object.entries(record).filter(([name]) => name !== key));
}

/** The fixture without the zero-byte asset and the card that referenced it. */
function dropEmptyAsset(bundle: ProjectBundle): ProjectBundle {
  return {
    stack: {
      ...bundle.stack,
      assetRegistry: withoutKey(bundle.stack.assetRegistry, EMPTY),
      cards: {
        ...bundle.stack.cards,
        [EMPTY_CARD]: { cardId: EMPTY_CARD, title: 'Empty file', elements: [] },
      },
    },
    assets: withoutKey(bundle.assets, EMPTY),
  };
}

async function expectStored(port: StoragePort, expected: ProjectBundle): Promise<void> {
  const loaded = unwrap(await port.loadProject(expected.stack.stackId));
  expect(loaded.stack).toEqual(expected.stack);
  expect(loaded.assets).toEqual(expected.assets);
}

export function runStoragePortContract(name: string, makePort: MakeContractSubject): void {
  describe(`StoragePort contract: ${name}`, () => {
    describe('round trip', () => {
      it('returns an equal stack and byte-identical assets, including a zero-byte asset', async () => {
        const { port } = await makePort();
        const bundle = buildFixtureBundle();
        unwrap(await port.saveProject(bundle));
        await expectStored(port, bundle);
        expect(unwrap(await port.loadAsset(bundle.stack.stackId, EMPTY)).length).toBe(0);
      });

      it('holds for generated projects', async () => {
        await fc.assert(
          fc.asyncProperty(arbBundle, async (bundle) => {
            const { port } = await makePort();
            unwrap(await port.saveProject(bundle));
            await expectStored(port, bundle);
          }),
          { numRuns: 25 },
        );
      });
    });

    describe('list', () => {
      it('is empty before any save', async () => {
        const { port } = await makePort();
        expect(unwrap(await port.listProjects())).toEqual({ summaries: [], unreadable: [] });
      });

      it('reports exactly stackId, title and updatedAt, reflecting the latest save', async () => {
        const { port } = await makePort();
        const bundle = buildFixtureBundle();
        unwrap(await port.saveProject(bundle));
        const updatedAt = '2026-02-02T00:00:00.000Z';
        unwrap(
          await port.saveProject({
            ...bundle,
            stack: { ...bundle.stack, title: 'Renamed', updatedAt },
          }),
        );
        const listing = unwrap(await port.listProjects());
        expect(listing.unreadable).toEqual([]);
        expect(listing.summaries).toEqual([
          { stackId: bundle.stack.stackId, title: 'Renamed', updatedAt },
        ]);
        expect(Object.keys(listing.summaries[0] ?? {}).sort()).toEqual([
          'stackId',
          'title',
          'updatedAt',
        ]);
      });
    });

    describe('missing', () => {
      it('returns not-found for unknown IDs without throwing', async () => {
        const { port } = await makePort();
        expect(errorOf(await port.loadProject(UNKNOWN_STACK))).toMatchObject({
          code: 'not-found',
          stackId: UNKNOWN_STACK,
        });
        expect(errorOf(await port.deleteProject(UNKNOWN_STACK)).code).toBe('not-found');
        expect(errorOf(await port.loadAsset(UNKNOWN_STACK, PICTURE))).toMatchObject({
          code: 'not-found',
          stackId: UNKNOWN_STACK,
          assetId: PICTURE,
        });
        expect(errorOf(await port.deleteAsset(UNKNOWN_STACK, PICTURE)).code).toBe('not-found');
      });

      it('does not create a project by loading a missing one', async () => {
        const { port } = await makePort();
        await port.loadProject(UNKNOWN_STACK);
        expect(unwrap(await port.listProjects()).summaries).toEqual([]);
      });

      it('returns not-found when a registered asset has no stored bytes', async () => {
        const { port } = await makePort();
        const bundle = buildFixtureBundle();
        unwrap(await port.saveProject(bundle));
        unwrap(await port.deleteAsset(bundle.stack.stackId, PICTURE));
        expect(errorOf(await port.loadProject(bundle.stack.stackId))).toMatchObject({
          code: 'not-found',
          assetId: PICTURE,
        });
      });
    });

    describe('single assets', () => {
      it('saves, loads and deletes an asset scoped by stack and asset ID', async () => {
        const { port } = await makePort();
        unwrap(await port.saveAsset(ASSET_ONLY_STACK, PICTURE, Uint8Array.from([1, 2, 3])));
        expect(unwrap(await port.loadAsset(ASSET_ONLY_STACK, PICTURE))).toEqual(
          Uint8Array.from([1, 2, 3]),
        );
        expect(errorOf(await port.loadAsset(ASSET_ONLY_STACK, EMPTY)).code).toBe('not-found');
        expect(errorOf(await port.loadAsset(UNKNOWN_STACK, PICTURE)).code).toBe('not-found');
        unwrap(await port.deleteAsset(ASSET_ONLY_STACK, PICTURE));
        expect(errorOf(await port.loadAsset(ASSET_ONLY_STACK, PICTURE)).code).toBe('not-found');
      });

      it('overwrites an existing asset', async () => {
        const { port } = await makePort();
        unwrap(await port.saveAsset(ASSET_ONLY_STACK, PICTURE, Uint8Array.from([1])));
        unwrap(await port.saveAsset(ASSET_ONLY_STACK, PICTURE, Uint8Array.from([2, 3])));
        expect(unwrap(await port.loadAsset(ASSET_ONLY_STACK, PICTURE))).toEqual(
          Uint8Array.from([2, 3]),
        );
      });
    });

    describe('delete cascade', () => {
      it('removes the project and its assets, and leaves other projects alone', async () => {
        const { port } = await makePort();
        const bundle = buildFixtureBundle();
        unwrap(await port.saveProject(bundle));
        unwrap(await port.saveAsset(ASSET_ONLY_STACK, PICTURE, Uint8Array.from([7])));
        unwrap(await port.deleteProject(bundle.stack.stackId));
        expect(errorOf(await port.loadProject(bundle.stack.stackId)).code).toBe('not-found');
        expect(errorOf(await port.loadAsset(bundle.stack.stackId, PICTURE)).code).toBe('not-found');
        expect(errorOf(await port.loadAsset(bundle.stack.stackId, EMPTY)).code).toBe('not-found');
        expect(unwrap(await port.loadAsset(ASSET_ONLY_STACK, PICTURE))).toEqual(
          Uint8Array.from([7]),
        );
        expect(unwrap(await port.listProjects()).summaries).toEqual([]);
      });
    });

    describe('invalid save', () => {
      it('returns validator errors and stores nothing', async () => {
        const { port } = await makePort();
        const bundle = buildFixtureBundle();
        const invalid = { ...bundle, stack: { ...bundle.stack, entryCardId: 'nope' } };
        const error = errorOf(await port.saveProject(invalid));
        expect(error.code).toBe('validation-failed');
        expect(error.validationErrors?.length).toBeGreaterThan(0);
        expect(unwrap(await port.listProjects()).summaries).toEqual([]);
        expect(errorOf(await port.loadAsset(bundle.stack.stackId, PICTURE)).code).toBe('not-found');
      });

      it('does not throw for a non-object stack', async () => {
        const { port } = await makePort();
        const bad = { stack: null, assets: {} } as unknown as ProjectBundle;
        expect(errorOf(await port.saveProject(bad)).code).toBe('validation-failed');
      });

      it('rejects missing, mis-sized and unregistered asset bytes', async () => {
        const { port } = await makePort();
        const bundle = buildFixtureBundle();
        const extra = 'ast_00000000-0000-4000-8000-0000000000ff';
        const missing = { ...bundle, assets: withoutKey(bundle.assets, PICTURE) };
        const wrongSize = { ...bundle, assets: { ...bundle.assets, [PICTURE]: Uint8Array.of(1) } };
        const unregistered = { ...bundle, assets: { ...bundle.assets, [extra]: Uint8Array.of(1) } };
        expect(errorOf(await port.saveProject(missing))).toMatchObject({
          code: 'validation-failed',
          assetId: PICTURE,
        });
        expect(errorOf(await port.saveProject(wrongSize))).toMatchObject({
          code: 'validation-failed',
          assetId: PICTURE,
        });
        expect(errorOf(await port.saveProject(unregistered))).toMatchObject({
          code: 'validation-failed',
          assetId: extra,
        });
        expect(unwrap(await port.listProjects()).summaries).toEqual([]);
      });

      it('keeps the previous project when a later save is invalid', async () => {
        const { port } = await makePort();
        const bundle = buildFixtureBundle();
        unwrap(await port.saveProject(bundle));
        const invalid = { ...bundle, stack: { ...bundle.stack, title: 'x'.repeat(101) } };
        expect(errorOf(await port.saveProject(invalid)).code).toBe('validation-failed');
        await expectStored(port, bundle);
      });
    });

    describe('fault during save', () => {
      it.each(['write-failed', 'quota-exceeded'] as const)(
        'a %s fault leaves the previous stack and assets unchanged',
        async (code) => {
          const { port, faults } = await makePort();
          if (!faults) return;
          const bundle = buildFixtureBundle();
          unwrap(await port.saveProject(bundle));
          faults.failNextWrite(code);
          const next = dropEmptyAsset({
            ...bundle,
            stack: { ...bundle.stack, title: 'Changed' },
          });
          expect(errorOf(await port.saveProject(next)).code).toBe(code);
          await expectStored(port, bundle);
        },
      );

      it('a fault on a first save stores nothing', async () => {
        const { port, faults } = await makePort();
        if (!faults) return;
        const bundle = buildFixtureBundle();
        faults.failNextWrite('write-failed');
        expect(errorOf(await port.saveProject(bundle)).code).toBe('write-failed');
        expect(errorOf(await port.loadProject(bundle.stack.stackId)).code).toBe('not-found');
        expect(unwrap(await port.listProjects()).summaries).toEqual([]);
      });

      it('a fault applies once, then saves succeed', async () => {
        const { port, faults } = await makePort();
        if (!faults) return;
        const bundle = buildFixtureBundle();
        faults.failNextWrite('write-failed');
        expect(errorOf(await port.saveProject(bundle)).code).toBe('write-failed');
        unwrap(await port.saveProject(bundle));
        await expectStored(port, bundle);
      });

      it('a fault on deleteProject keeps the project', async () => {
        const { port, faults } = await makePort();
        if (!faults) return;
        const bundle = buildFixtureBundle();
        unwrap(await port.saveProject(bundle));
        faults.failNextWrite('write-failed');
        expect(errorOf(await port.deleteProject(bundle.stack.stackId)).code).toBe('write-failed');
        await expectStored(port, bundle);
      });

      it('a fault on saveAsset or deleteAsset keeps the stored asset', async () => {
        const { port, faults } = await makePort();
        if (!faults) return;
        unwrap(await port.saveAsset(ASSET_ONLY_STACK, PICTURE, Uint8Array.of(1)));
        faults.failNextWrite('quota-exceeded');
        expect(
          errorOf(await port.saveAsset(ASSET_ONLY_STACK, PICTURE, Uint8Array.of(9))).code,
        ).toBe('quota-exceeded');
        faults.failNextWrite('write-failed');
        expect(errorOf(await port.deleteAsset(ASSET_ONLY_STACK, PICTURE)).code).toBe(
          'write-failed',
        );
        expect(unwrap(await port.loadAsset(ASSET_ONLY_STACK, PICTURE))).toEqual(Uint8Array.of(1));
      });
    });

    describe('replace semantics', () => {
      it('removes assets that the new bundle drops', async () => {
        const { port } = await makePort();
        const bundle = buildFixtureBundle();
        unwrap(await port.saveProject(bundle));
        const smaller = dropEmptyAsset(bundle);
        unwrap(await port.saveProject(smaller));
        expect(errorOf(await port.loadAsset(bundle.stack.stackId, EMPTY)).code).toBe('not-found');
        await expectStored(port, smaller);
      });

      it('removes assets stored individually that the bundle does not list', async () => {
        const { port } = await makePort();
        const bundle = buildFixtureBundle();
        const stray = 'ast_00000000-0000-4000-8000-0000000000ee';
        unwrap(await port.saveAsset(bundle.stack.stackId, stray, Uint8Array.of(4)));
        unwrap(await port.saveProject(bundle));
        expect(errorOf(await port.loadAsset(bundle.stack.stackId, stray)).code).toBe('not-found');
      });
    });

    describe('isolation', () => {
      it('ignores caller mutations made after save', async () => {
        const { port } = await makePort();
        const bundle = buildFixtureBundle();
        const expected = buildFixtureBundle();
        unwrap(await port.saveProject(bundle));
        bundle.stack.title = 'Mutated';
        bundle.assets[PICTURE]?.fill(0);
        await expectStored(port, expected);
      });

      it('does not change stored state when a loaded project is mutated', async () => {
        const { port } = await makePort();
        const bundle = buildFixtureBundle();
        unwrap(await port.saveProject(bundle));
        const first = unwrap(await port.loadProject(bundle.stack.stackId));
        first.stack.title = 'Mutated';
        first.assets[PICTURE]?.fill(0);
        await expectStored(port, buildFixtureBundle());
      });

      it('copies single asset bytes on write and read', async () => {
        const { port } = await makePort();
        const input = Uint8Array.of(5, 6);
        unwrap(await port.saveAsset(ASSET_ONLY_STACK, PICTURE, input));
        input.fill(0);
        unwrap(await port.loadAsset(ASSET_ONLY_STACK, PICTURE)).fill(0);
        expect(unwrap(await port.loadAsset(ASSET_ONLY_STACK, PICTURE))).toEqual(
          Uint8Array.of(5, 6),
        );
      });
    });
  });
}
