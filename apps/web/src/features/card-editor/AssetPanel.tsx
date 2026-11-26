import { useRef, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import type { StackSession } from '@ghoststack/shared-contracts';
import { useAssetUrl, describeAssetFile } from '../../app/assets';
import { useServices } from '../../app/services';
import { useSessionStack } from '../../app/useStackSession';
import { Button, Dialog, EmptyState } from '../../components';
import { dispatchAll, gestureKey } from './canvas-actions';
import { assetRows, formatBytes, orphanIds } from './assets-model';
import type { AssetRow } from './assets-model';
import { IMAGE_TYPES, MAX_IMAGE_BYTES } from './Inspector';
import './assets.css';

export interface AssetPanelProps {
  session: StackSession;
  open: boolean;
  onClose: () => void;
}

function Thumb({ stackId, row }: { stackId: string; row: AssetRow }): ReactNode {
  const url = useAssetUrl(stackId, row.asset.assetId);
  if (url.status === 'ready') {
    return <img className="gs-assets-thumb" src={url.url} alt="" draggable={false} />;
  }
  return (
    <span className="gs-assets-thumb gs-assets-thumb--empty">
      {url.status === 'loading' ? 'Loading' : 'File missing'}
    </span>
  );
}

/** Lists every registered asset with its thumbnail and usage. Replace, delete and clean up from here. */
export function AssetPanel({ session, open, onClose }: AssetPanelProps): ReactNode {
  const stack = useSessionStack(session);
  const { assets } = useServices();
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [replacing, setReplacing] = useState<string | undefined>();
  const fileInput = useRef<HTMLInputElement>(null);
  const rows = assetRows(stack);
  const orphans = orphanIds(rows);

  const guarded = async (job: () => Promise<string | undefined>): Promise<void> => {
    setBusy(true);
    try {
      setError(await job());
    } catch (e) {
      setError(`Could not finish: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const remove = (ids: string[]): Promise<void> =>
    guarded(async () => {
      const r = dispatchAll(
        session,
        ids.map((assetId) => ({ type: 'REMOVE_ASSET', assetId })),
        gestureKey('remove-assets'),
      );
      if (!r.ok) return r.message;
      for (const id of ids) await assets.delete(stack.stackId, id);
      return undefined;
    });

  const replaceWith = (assetId: string, file: File | undefined): Promise<void> =>
    guarded(async () => {
      if (!file) return undefined;
      if (!IMAGE_TYPES.includes(file.type)) return 'Choose a PNG, JPEG, GIF or WebP image.';
      if (file.size > MAX_IMAGE_BYTES) return 'That file is larger than 5 MB. Choose a smaller image.';
      const previous = await assets.get(stack.stackId, assetId);
      const { asset, bytes } = await describeAssetFile(file, assetId);
      await assets.put(stack.stackId, asset, bytes);
      const r = session.dispatch({ type: 'REPLACE_ASSET', asset });
      if (!r.ok) {
        const old = session.getStack().assetRegistry[assetId];
        if (previous && old) await assets.put(stack.stackId, old, previous);
        return r.error.message;
      }
      return undefined;
    });

  const onFile = (e: ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    const id = replacing;
    e.target.value = '';
    setReplacing(undefined);
    if (id) void replaceWith(id, file);
  };

  return (
    <Dialog
      open={open}
      title="Assets"
      onClose={onClose}
      actions={
        <>
          <Button
            variant="danger"
            disabled={busy || orphans.length === 0}
            onClick={() => void remove(orphans)}
            title={
              orphans.length === 0 ? 'Every asset is used by an element.' : 'Delete assets no element uses.'
            }
          >
            {orphans.length === 0 ? 'Remove unused' : `Remove ${orphans.length} unused`}
          </Button>
          <Button variant="primary" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      <div className="gs-assets">
        <input
          ref={fileInput}
          type="file"
          className="gs-assets-file"
          tabIndex={-1}
          aria-label="Replacement image file"
          accept={IMAGE_TYPES.join(',')}
          onChange={onFile}
        />
        <p className="gs-assets-hint">
          Unused assets are left out of exported files. Deleting an asset removes its file from this browser.
          Undo brings back the entry but not the file.
        </p>
        {error ? (
          <p className="gs-error" role="alert">
            {error}
          </p>
        ) : null}
        {rows.length === 0 ? (
          <EmptyState title="No assets in this stack.">
            Add an image element and choose a file in the inspector. It will be listed here.
          </EmptyState>
        ) : (
          <ul className="gs-assets-list" aria-label="Assets">
            {rows.map((row) => (
              <li key={row.asset.assetId} className="gs-assets-row" data-testid="asset-row">
                <Thumb stackId={stack.stackId} row={row} />
                <div className="gs-assets-meta">
                  <span className="gs-assets-name">{row.fileName}</span>
                  <span className="gs-assets-sub">
                    {formatBytes(row.asset.byteSize)} · {row.asset.mimeType} ·{' '}
                    <span data-testid="asset-usage">
                      {row.uses === 0
                        ? 'Not used'
                        : `Used by ${row.uses} element${row.uses === 1 ? '' : 's'}`}
                    </span>
                  </span>
                </div>
                <div className="gs-assets-actions">
                  <Button
                    disabled={busy}
                    aria-label={`Replace file of ${row.fileName}`}
                    onClick={() => {
                      setReplacing(row.asset.assetId);
                      fileInput.current?.click();
                    }}
                  >
                    Replace
                  </Button>
                  <Button
                    variant="danger"
                    disabled={busy || row.uses > 0}
                    aria-label={`Delete ${row.fileName}`}
                    title={row.uses > 0 ? 'Remove the elements that use it first.' : 'Delete this asset.'}
                    onClick={() => void remove([row.asset.assetId])}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  );
}
