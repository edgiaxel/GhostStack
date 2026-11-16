import { buildFixtureBundle } from '@ghoststack/domain/testing';
import type { ProjectBundle, Result } from '@ghoststack/domain';
import { describe, expect, it } from 'vitest';
import type { StorageError, StoragePort } from '../port';
import { createFaultController } from './faults';
import { createMemoryStorage } from './memoryStorage';

const PICTURE = 'ast_00000000-0000-4000-8000-000000000001';
const EMPTY = 'ast_00000000-0000-4000-8000-000000000002';

function setup() {
  const faults = createFaultController();
  const port: StoragePort = createMemoryStorage({ faults });
  return { port, faults, bundle: buildFixtureBundle() };
}

function unwrap<T>(result: Result<T, StorageError>): T {
  if (!result.ok) throw new Error(`expected ok, got ${result.error.code}`);
  return result.value;
}

function withoutKey<V>(record: Readonly<Record<string, V>>, key: string): Record<string, V> {
  return Object.fromEntries(Object.entries(record).filter(([name]) => name !== key));
}

function errorOf<T>(result: Result<T, StorageError>): StorageError {
  if (result.ok) throw new Error('expected an error');
  return result.error;
}

describe('createMemoryStorage', () => {
  it('round trips a project with its asset bytes, including a zero-byte asset', async () => {
    const { port, bundle } = setup();
    unwrap(await port.saveProject(bundle));
    const loaded = unwrap(await port.loadProject(bundle.stack.stackId));
    expect(loaded.stack).toEqual(bundle.stack);
    expect(loaded.assets[PICTURE]).toEqual(bundle.assets[PICTURE]);
    expect(loaded.assets[EMPTY]?.length).toBe(0);
  });

  it('lists summaries with exactly stackId, title and updatedAt, and no unreadable records', async () => {
    const { port, bundle } = setup();
    expect(unwrap(await port.listProjects())).toEqual({ summaries: [], unreadable: [] });
    unwrap(await port.saveProject(bundle));
    const updated = {
      ...bundle,
      stack: { ...bundle.stack, updatedAt: '2026-02-02T00:00:00.000Z' },
    };
    unwrap(await port.saveProject(updated));
    const listing = unwrap(await port.listProjects());
    expect(listing.unreadable).toEqual([]);
    expect(listing.summaries).toEqual([
      {
        stackId: bundle.stack.stackId,
        title: bundle.stack.title,
        updatedAt: '2026-02-02T00:00:00.000Z',
      },
    ]);
    expect(Object.keys(listing.summaries[0] ?? {}).sort()).toEqual([
      'stackId',
      'title',
      'updatedAt',
    ]);
  });

  it('returns not-found for a missing project, project delete, and assets', async () => {
    const { port } = setup();
    const stackId = 'stk_00000000-0000-4000-8000-0000000000aa';
    expect(errorOf(await port.loadProject(stackId))).toMatchObject({ code: 'not-found', stackId });
    expect(errorOf(await port.deleteProject(stackId)).code).toBe('not-found');
    expect(errorOf(await port.loadAsset(stackId, PICTURE))).toMatchObject({
      code: 'not-found',
      stackId,
      assetId: PICTURE,
    });
    expect(errorOf(await port.deleteAsset(stackId, PICTURE)).code).toBe('not-found');
    expect(unwrap(await port.listProjects()).summaries).toEqual([]);
  });

  it('deleteProject cascades to assets', async () => {
    const { port, bundle } = setup();
    unwrap(await port.saveProject(bundle));
    unwrap(await port.deleteProject(bundle.stack.stackId));
    expect(errorOf(await port.loadProject(bundle.stack.stackId)).code).toBe('not-found');
    expect(errorOf(await port.loadAsset(bundle.stack.stackId, PICTURE)).code).toBe('not-found');
  });

  it('saves, loads and deletes a single asset scoped by stack and asset ID', async () => {
    const { port } = setup();
    const stackId = 'stk_00000000-0000-4000-8000-0000000000bb';
    unwrap(await port.saveAsset(stackId, PICTURE, Uint8Array.from([1, 2, 3])));
    expect(unwrap(await port.loadAsset(stackId, PICTURE))).toEqual(Uint8Array.from([1, 2, 3]));
    expect(errorOf(await port.loadAsset(stackId, EMPTY)).code).toBe('not-found');
    unwrap(await port.deleteAsset(stackId, PICTURE));
    expect(errorOf(await port.loadAsset(stackId, PICTURE)).code).toBe('not-found');
  });

  describe('validation-failed', () => {
    it('rejects an invalid project with validator errors and stores nothing', async () => {
      const { port, bundle } = setup();
      const invalid: ProjectBundle = { ...bundle, stack: { ...bundle.stack, entryCardId: 'nope' } };
      const error = errorOf(await port.saveProject(invalid));
      expect(error.code).toBe('validation-failed');
      expect(error.validationErrors?.length).toBeGreaterThan(0);
      expect(unwrap(await port.listProjects()).summaries).toEqual([]);
    });

    it('rejects a non-object stack without throwing', async () => {
      const { port } = setup();
      const bad = { stack: null, assets: {} } as unknown as ProjectBundle;
      expect(errorOf(await port.saveProject(bad)).code).toBe('validation-failed');
    });

    it('rejects a bundle missing bytes for a registered asset', async () => {
      const { port, bundle } = setup();
      const rest = withoutKey(bundle.assets, PICTURE);
      const error = errorOf(await port.saveProject({ ...bundle, assets: rest }));
      expect(error).toMatchObject({ code: 'validation-failed', assetId: PICTURE });
    });

    it('rejects bytes whose length differs from the registered size', async () => {
      const { port, bundle } = setup();
      const assets = { ...bundle.assets, [PICTURE]: Uint8Array.from([1]) };
      const error = errorOf(await port.saveProject({ ...bundle, assets }));
      expect(error).toMatchObject({ code: 'validation-failed', assetId: PICTURE });
    });

    it('rejects bytes for an unregistered asset', async () => {
      const { port, bundle } = setup();
      const extra = 'ast_00000000-0000-4000-8000-0000000000ff';
      const assets = { ...bundle.assets, [extra]: Uint8Array.from([1]) };
      const error = errorOf(await port.saveProject({ ...bundle, assets }));
      expect(error).toMatchObject({ code: 'validation-failed', assetId: extra });
    });

    it('keeps the previous project when a later save is invalid', async () => {
      const { port, bundle } = setup();
      unwrap(await port.saveProject(bundle));
      const invalid = { ...bundle, stack: { ...bundle.stack, title: '' + 'x'.repeat(101) } };
      expect(errorOf(await port.saveProject(invalid)).code).toBe('validation-failed');
      expect(unwrap(await port.loadProject(bundle.stack.stackId)).stack).toEqual(bundle.stack);
    });
  });

  describe('replace semantics', () => {
    it('removes assets that the new bundle drops', async () => {
      const { port, bundle } = setup();
      unwrap(await port.saveProject(bundle));
      const registry = withoutKey(bundle.stack.assetRegistry, EMPTY);
      const assets = withoutKey(bundle.assets, EMPTY);
      const smaller: ProjectBundle = {
        stack: {
          ...bundle.stack,
          assetRegistry: registry,
          cards: {
            ...bundle.stack.cards,
            ['crd_00000000-0000-4000-8000-000000000003']: {
              cardId: 'crd_00000000-0000-4000-8000-000000000003',
              title: 'Empty file',
              elements: [],
            },
          },
        },
        assets,
      };
      unwrap(await port.saveProject(smaller));
      expect(errorOf(await port.loadAsset(bundle.stack.stackId, EMPTY)).code).toBe('not-found');
      expect(unwrap(await port.loadAsset(bundle.stack.stackId, PICTURE)).length).toBe(8);
    });
  });

  describe('fault injection', () => {
    it.each(['write-failed', 'quota-exceeded'] as const)(
      'a %s fault during save leaves the old project and assets unchanged',
      async (code) => {
        const { port, faults, bundle } = setup();
        unwrap(await port.saveProject(bundle));
        faults.failNextWrite(code);
        const next = { ...bundle, stack: { ...bundle.stack, title: 'Changed' } };
        expect(errorOf(await port.saveProject(next)).code).toBe(code);
        const loaded = unwrap(await port.loadProject(bundle.stack.stackId));
        expect(loaded.stack).toEqual(bundle.stack);
        expect(loaded.assets[PICTURE]).toEqual(bundle.assets[PICTURE]);
      },
    );

    it('a fault applies once and then clears', async () => {
      const { port, faults, bundle } = setup();
      faults.failNextWrite('write-failed');
      expect(errorOf(await port.saveProject(bundle)).code).toBe('write-failed');
      unwrap(await port.saveProject(bundle));
    });

    it('a fault on deleteProject keeps the project', async () => {
      const { port, faults, bundle } = setup();
      unwrap(await port.saveProject(bundle));
      faults.failNextWrite('write-failed');
      expect(errorOf(await port.deleteProject(bundle.stack.stackId)).code).toBe('write-failed');
      unwrap(await port.loadProject(bundle.stack.stackId));
    });

    it('a fault on saveAsset and deleteAsset keeps the stored asset', async () => {
      const { port, faults } = setup();
      const stackId = 'stk_00000000-0000-4000-8000-0000000000bb';
      unwrap(await port.saveAsset(stackId, PICTURE, Uint8Array.from([1])));
      faults.failNextWrite('quota-exceeded');
      expect(errorOf(await port.saveAsset(stackId, PICTURE, Uint8Array.from([9]))).code).toBe(
        'quota-exceeded',
      );
      faults.failNextWrite('write-failed');
      expect(errorOf(await port.deleteAsset(stackId, PICTURE)).code).toBe('write-failed');
      expect(unwrap(await port.loadAsset(stackId, PICTURE))).toEqual(Uint8Array.from([1]));
    });
  });

  describe('copy isolation', () => {
    it('does not see caller mutations made after save', async () => {
      const { port, bundle } = setup();
      unwrap(await port.saveProject(bundle));
      bundle.stack.title = 'Mutated';
      bundle.assets[PICTURE]?.fill(0);
      const loaded = unwrap(await port.loadProject(bundle.stack.stackId));
      expect(loaded.stack.title).toBe('Fixture stack');
      expect(loaded.assets[PICTURE]?.[0]).toBe(0x47);
    });

    it('does not change stored state when a loaded project is mutated', async () => {
      const { port, bundle } = setup();
      unwrap(await port.saveProject(bundle));
      const first = unwrap(await port.loadProject(bundle.stack.stackId));
      first.stack.title = 'Mutated';
      first.assets[PICTURE]?.fill(0);
      const second = unwrap(await port.loadProject(bundle.stack.stackId));
      expect(second.stack.title).toBe('Fixture stack');
      expect(second.assets[PICTURE]?.[0]).toBe(0x47);
    });

    it('copies single asset bytes on write and read', async () => {
      const { port } = setup();
      const stackId = 'stk_00000000-0000-4000-8000-0000000000bb';
      const input = Uint8Array.from([5, 6]);
      unwrap(await port.saveAsset(stackId, PICTURE, input));
      input.fill(0);
      const out = unwrap(await port.loadAsset(stackId, PICTURE));
      out.fill(0);
      expect(unwrap(await port.loadAsset(stackId, PICTURE))).toEqual(Uint8Array.from([5, 6]));
    });
  });
});
