import { isValid, validateProject } from '@ghoststack/domain';
import type { ProjectBundle } from '@ghoststack/domain';
import type { StorageError } from './types';

/** Checks that bytes match the registry exactly: one entry per asset, equal length. */
function checkAssetBytes(bundle: ProjectBundle): StorageError | undefined {
  const { stack, assets } = bundle;
  for (const [assetId, asset] of Object.entries(stack.assetRegistry)) {
    const bytes = assets[assetId];
    if (bytes === undefined) {
      return {
        code: 'validation-failed',
        message: 'The bundle has no bytes for a registered asset.',
        stackId: stack.stackId,
        assetId,
      };
    }
    if (bytes.length !== asset.byteSize) {
      return {
        code: 'validation-failed',
        message: 'Asset bytes do not match the registered size.',
        stackId: stack.stackId,
        assetId,
      };
    }
  }
  for (const assetId of Object.keys(assets)) {
    if (!(assetId in stack.assetRegistry)) {
      return {
        code: 'validation-failed',
        message: 'The bundle has bytes for an asset that is not registered.',
        stackId: stack.stackId,
        assetId,
      };
    }
  }
  return undefined;
}

export function checkBundle(bundle: ProjectBundle): StorageError | undefined {
  const validation = validateProject(bundle.stack);
  if (!isValid(validation)) {
    const stackId = (bundle.stack as { stackId?: unknown } | null)?.stackId;
    return {
      code: 'validation-failed',
      message: 'The project is not valid.',
      ...(typeof stackId === 'string' ? { stackId } : {}),
      validationErrors: validation.errors,
    };
  }
  return checkAssetBytes(bundle);
}
