import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { exportGsp, exportWebApp, GSP_LIMITS } from '@ghoststack/project-format';
import type { Stack } from '@ghoststack/shared-contracts';
import type { AssetRepository } from '@ghoststack/shared-contracts';
import type { EditorSlotProps } from '../../app/editorContext';
import { navigate } from '../../app/router';
import { useServices } from '../../app/services';
import { downloadBytes, safeFileName } from './files';
import { importGspBytes } from './importFlow';

type Message = { kind: 'ok' | 'error'; text: string };

/** Registered assets whose bytes are not in storage. */
async function missingAssets(stack: Stack, assets: AssetRepository): Promise<string[]> {
  const have = await assets.getAll(stack.stackId);
  return Object.values(stack.assetRegistry)
    .filter((a) => !have[a.assetId])
    .map((a) => a.relativePath);
}

/** Preview, `.gsp` export and standalone web export. Renders in the workspace toolbar. */
export function ExportMenu({ session }: EditorSlotProps): ReactNode {
  const { assets } = useServices();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | undefined>();
  const stackId = session.stackId;

  async function run(task: () => Promise<Message>): Promise<void> {
    setBusy(true);
    setMessage(undefined);
    try {
      await session.flush();
      if (session.getStatus().saveState === 'error') {
        return setMessage({
          kind: 'error',
          text: `Fix the save problem first: ${session.getStatus().error ?? 'unknown error'}`,
        });
      }
      setMessage(await task());
    } catch (e) {
      setMessage({ kind: 'error', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  const exportGspFile = (): Promise<void> =>
    run(async () => {
      const stack = session.getStack();
      const missing = await missingAssets(stack, assets);
      if (missing.length > 0) {
        return {
          kind: 'error',
          text: `These image files are missing: ${missing.join(', ')}. Pick the images again in the inspector, then export.`,
        };
      }
      const r = exportGsp(stack, await assets.getAll(stackId));
      if (!r.ok) return { kind: 'error', text: `Export failed: ${r.error.message}` };
      downloadBytes(r.value, safeFileName(stack.title, '.gsp'), 'application/octet-stream');
      return { kind: 'ok', text: `Exported ${safeFileName(stack.title, '.gsp')}.` };
    });

  const exportWeb = (): Promise<void> =>
    run(async () => {
      const stack = session.getStack();
      const res = await fetch(new URL('player.standalone.js', document.baseURI));
      if (!res.ok)
        return {
          kind: 'error',
          text: 'The player bundle could not be loaded. Rebuild the app (npm run build:player) and try again.',
        };
      const playerJs = await res.text();
      const r = exportWebApp(stack, await assets.getAll(stackId), playerJs);
      if (!r.ok) return { kind: 'error', text: `Export failed: ${r.error.message}` };
      const name = safeFileName(`${stack.title}-web`, '.zip');
      downloadBytes(r.value.bytes, name, 'application/zip');
      const note =
        r.value.missingAssets.length > 0
          ? ` Missing image files will show a placeholder: ${r.value.missingAssets.join(', ')}.`
          : '';
      return { kind: 'ok', text: `Exported ${name}. Unzip it and open index.html.${note}` };
    });

  return (
    <>
      <button
        type="button"
        className="gs-btn"
        disabled={busy}
        onClick={() =>
          void run(async () => {
            navigate(`/stack/${encodeURIComponent(stackId)}/preview`);
            return { kind: 'ok', text: '' };
          })
        }
      >
        Preview
      </button>
      <button type="button" className="gs-btn" disabled={busy} onClick={() => void exportGspFile()}>
        Export .gsp
      </button>
      <button type="button" className="gs-btn" disabled={busy} onClick={() => void exportWeb()}>
        Export web app
      </button>
      {message && message.text ? (
        <span
          role={message.kind === 'error' ? 'alert' : 'status'}
          className={message.kind === 'error' ? 'gs-error' : undefined}
        >
          {message.text}
        </span>
      ) : null}
    </>
  );
}

/** Imports a `.gsp` file as a new Stack and opens it. Never touches existing Stacks. */
export function ImportGspButton(): ReactNode {
  const { stacks, assets } = useServices();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function load(file: File): Promise<void> {
    setError(undefined);
    if (file.size > GSP_LIMITS.maxTotalBytes) return setError('That file is too large to import.');
    setBusy(true);
    try {
      const newStackId = crypto.randomUUID();
      const r = await importGspBytes(new Uint8Array(await file.arrayBuffer()), {
        stacks,
        assets,
        newStackId,
        now: new Date().toISOString(),
      });
      if (!r.ok) return setError(`Import failed: ${r.error.message}`);
      navigate(`/stack/${encodeURIComponent(r.value.stackId)}`);
    } catch (e) {
      setError(`Import failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="gs-btn" disabled={busy} onClick={() => input.current?.click()}>
        Import .gsp
      </button>
      <input
        ref={input}
        type="file"
        accept=".gsp,application/octet-stream"
        hidden
        aria-label="Choose a .gsp file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void load(file);
        }}
      />
      {error ? (
        <span className="gs-error" role="alert">
          {error}
        </span>
      ) : null}
    </>
  );
}
