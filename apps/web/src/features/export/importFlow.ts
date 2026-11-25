import { importGsp } from '@ghoststack/project-format';
import { validateStack } from '@ghoststack/domain';
import { err, ok } from '@ghoststack/shared-contracts';
import type { AssetRepository, GhostError, Result, StackRepository } from '@ghoststack/shared-contracts';

export interface ImportDeps {
  stacks: StackRepository;
  assets: AssetRepository;
  /** Fresh id for the imported Stack, so an import never overwrites an existing one. */
  newStackId: string;
  now: string;
}

/**
 * Reads a `.gsp` archive into storage as a new Stack. All-or-nothing: if any step fails the new
 * Stack (and the assets stored so far) is removed and no other Stack is touched.
 */
export async function importGspBytes(
  bytes: Uint8Array,
  deps: ImportDeps,
): Promise<Result<{ stackId: string }, GhostError>> {
  const parsed = importGsp(bytes);
  if (!parsed.ok) return parsed;
  const stack = validateStack({ ...parsed.value.stack, stackId: deps.newStackId, updatedAt: deps.now });
  if (!stack.ok) return err({ code: 'PROJECT_IMPORT_FAILED', message: stack.error.message });
  try {
    await deps.stacks.save(stack.value);
    for (const asset of Object.values(stack.value.assetRegistry)) {
      const data = parsed.value.assets[asset.assetId];
      if (data) await deps.assets.put(deps.newStackId, asset, data);
    }
  } catch (e) {
    await deps.stacks.delete(deps.newStackId).catch(() => undefined);
    return err({
      code: 'STORAGE_FAILED',
      message: `Could not store the imported project: ${e instanceof Error ? e.message : String(e)}`,
    });
  }
  return ok({ stackId: deps.newStackId });
}
