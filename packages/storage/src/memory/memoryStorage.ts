import { err, isValid, ok, validateProject } from '@ghoststack/domain';
import type { Result, Stack } from '@ghoststack/domain';
import { checkBundle } from '../port';
import type { ProjectListing, StorageError, StoragePort } from '../port';
import { createFaultController } from './faults';
import type { FaultController } from './faults';

export interface MemoryStorageOptions {
  readonly faults?: FaultController;
}

type StoredAssets = Map<string, Uint8Array>;

const notFound = (
  message: string,
  ids: Pick<StorageError, 'stackId' | 'assetId'>,
): StorageError => ({
  code: 'not-found',
  message,
  ...ids,
});

const faultMessage = (code: 'write-failed' | 'quota-exceeded'): string =>
  code === 'quota-exceeded' ? 'Storage quota exceeded.' : 'The write failed.';

export function createMemoryStorage(options: MemoryStorageOptions = {}): StoragePort {
  const faults = options.faults ?? createFaultController();
  let stacks = new Map<string, Stack>();
  let assets = new Map<string, StoredAssets>();

  const failIfFaulted = (stackId: string): StorageError | undefined => {
    const code = faults.takeFault();
    return code === undefined ? undefined : { code, message: faultMessage(code), stackId };
  };

  const exists = (stackId: string): boolean => stacks.has(stackId) || assets.has(stackId);

  return {
    saveProject(bundle) {
      const invalid = checkBundle(bundle);
      if (invalid) return Promise.resolve(err(invalid));
      const { stackId } = bundle.stack;
      const fault = failIfFaulted(stackId);
      if (fault) return Promise.resolve(err(fault));

      // Build the next state fully, then swap it in with plain assignments.
      const nextAssets: StoredAssets = new Map(
        Object.entries(bundle.assets).map(([assetId, bytes]) => [assetId, bytes.slice()]),
      );
      const nextStacks = new Map(stacks).set(stackId, structuredClone(bundle.stack));
      const nextAssetMap = new Map(assets).set(stackId, nextAssets);
      stacks = nextStacks;
      assets = nextAssetMap;
      return Promise.resolve(ok(undefined));
    },

    loadProject(stackId) {
      const stored = stacks.get(stackId);
      if (stored === undefined) {
        return Promise.resolve(err(notFound('No project with this stack ID.', { stackId })));
      }
      const stack = structuredClone(stored);
      const validation = validateProject(stack);
      if (!isValid(validation)) {
        return Promise.resolve(
          err({
            code: 'validation-failed',
            message: 'The stored project is not valid.',
            stackId,
            validationErrors: validation.errors,
          }),
        );
      }
      const storedAssets = assets.get(stackId);
      const copies: Record<string, Uint8Array> = {};
      for (const [assetId, asset] of Object.entries(stack.assetRegistry)) {
        const bytes = storedAssets?.get(assetId);
        if (bytes === undefined) {
          return Promise.resolve(
            err(notFound('A registered asset has no stored bytes.', { stackId, assetId })),
          );
        }
        if (bytes.length !== asset.byteSize) {
          return Promise.resolve(
            err({
              code: 'validation-failed',
              message: 'Stored asset bytes do not match the registered size.',
              stackId,
              assetId,
            }),
          );
        }
        copies[assetId] = bytes.slice();
      }
      return Promise.resolve(ok({ stack, assets: copies }));
    },

    listProjects() {
      const listing: ProjectListing = {
        summaries: [...stacks.values()].map(({ stackId, title, updatedAt }) => ({
          stackId,
          title,
          updatedAt,
        })),
        unreadable: [],
      };
      return Promise.resolve(ok(listing));
    },

    deleteProject(stackId) {
      if (!exists(stackId)) {
        return Promise.resolve(err(notFound('No project with this stack ID.', { stackId })));
      }
      const fault = failIfFaulted(stackId);
      if (fault) return Promise.resolve(err(fault));
      const nextStacks = new Map(stacks);
      const nextAssets = new Map(assets);
      nextStacks.delete(stackId);
      nextAssets.delete(stackId);
      stacks = nextStacks;
      assets = nextAssets;
      return Promise.resolve(ok(undefined));
    },

    saveAsset(stackId, assetId, bytes) {
      const fault = failIfFaulted(stackId);
      if (fault) return Promise.resolve(err({ ...fault, assetId }));
      const scoped = assets.get(stackId) ?? new Map<string, Uint8Array>();
      scoped.set(assetId, bytes.slice());
      assets.set(stackId, scoped);
      return Promise.resolve(ok(undefined));
    },

    loadAsset(stackId, assetId): Promise<Result<Uint8Array, StorageError>> {
      const bytes = assets.get(stackId)?.get(assetId);
      if (bytes === undefined) {
        return Promise.resolve(err(notFound('No asset with this ID.', { stackId, assetId })));
      }
      return Promise.resolve(ok(bytes.slice()));
    },

    deleteAsset(stackId, assetId) {
      const scoped = assets.get(stackId);
      if (scoped === undefined || !scoped.has(assetId)) {
        return Promise.resolve(err(notFound('No asset with this ID.', { stackId, assetId })));
      }
      const fault = failIfFaulted(stackId);
      if (fault) return Promise.resolve(err({ ...fault, assetId }));
      scoped.delete(assetId);
      return Promise.resolve(ok(undefined));
    },
  };
}
