import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createRuntime } from '@ghoststack/behavior';
import { mountPlayer } from '@ghoststack/player';
import type { PlayerHandle } from '@ghoststack/player';
import { VIEWPORT_PRESETS } from '@ghoststack/shared-contracts';
import type { Stack } from '@ghoststack/shared-contracts';
import { useServices } from '../../app/services';
import './preview.css';

type Load =
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'error'; message: string }
  | { status: 'ready'; stack: Stack; urls: Record<string, string> };
type Size = 'fit' | keyof typeof VIEWPORT_PRESETS;

const countElements = (stack: Stack): number =>
  Object.values(stack.cards).reduce((n, c) => n + c.elements.length, 0);

/** Runs the saved Stack through the same player and behavior runtime the web export uses. */
export function PreviewPage({ stackId }: { stackId: string }): ReactNode {
  const { stacks, assets } = useServices();
  const [attempt, setAttempt] = useState(0);
  const key = `${stackId}:${attempt}`;
  const [loaded, setLoaded] = useState<{ key: string; state: Load } | undefined>();
  const state: Load = loaded?.key === key ? loaded.state : { status: 'loading' };

  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    (async () => {
      const stack = await stacks.get(stackId);
      if (cancelled) return;
      if (!stack) return setLoaded({ key, state: { status: 'not-found' } });
      const bytes = await assets.getAll(stackId);
      if (cancelled) return;
      const map: Record<string, string> = {};
      for (const [id, data] of Object.entries(bytes)) {
        const asset = stack.assetRegistry[id];
        const url = URL.createObjectURL(
          new Blob([data.slice().buffer], { type: asset?.mimeType ?? 'application/octet-stream' }),
        );
        urls.push(url);
        map[id] = url;
      }
      setLoaded({ key, state: { status: 'ready', stack, urls: map } });
    })().catch((e: unknown) => {
      if (!cancelled)
        setLoaded({ key, state: { status: 'error', message: e instanceof Error ? e.message : String(e) } });
    });
    return () => {
      cancelled = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [stacks, assets, stackId, key]);

  const back = `#/stack/${encodeURIComponent(stackId)}`;
  if (state.status === 'loading') return <p className="gs-empty">Loading preview…</p>;
  if (state.status === 'not-found') {
    return (
      <div className="gs-pv-page">
        <p className="gs-error" role="alert">
          Stack not found. It may have been deleted. Open the Library to pick another stack.
        </p>
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <div className="gs-pv-page">
        <p className="gs-error" role="alert">
          Could not load the preview: {state.message}
        </p>
        <button type="button" className="gs-btn" onClick={() => setAttempt((n) => n + 1)}>
          Retry
        </button>
      </div>
    );
  }
  return <Player stack={state.stack} urls={state.urls} back={back} />;
}

function Player({
  stack,
  urls,
  back,
}: {
  stack: Stack;
  urls: Record<string, string>;
  back: string;
}): ReactNode {
  const host = useRef<HTMLDivElement>(null);
  const handle = useRef<PlayerHandle | undefined>(undefined);
  const [size, setSize] = useState<Size>('fit');
  const [issues, setIssues] = useState<string[]>([]);
  const empty = countElements(stack) === 0;

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    const h = mountPlayer({
      container,
      stack,
      createRuntime,
      resolveAssetUrl: (id) => urls[id],
      onError: (m) => setIssues((prev) => (prev.length < 50 ? [...prev, m] : prev)),
    });
    handle.current = h;
    return () => {
      h.destroy();
      handle.current = undefined;
    };
  }, [stack, urls]);

  const preset = size === 'fit' ? undefined : VIEWPORT_PRESETS[size];
  return (
    <div className="gs-pv-page">
      <div className="gs-pv-bar" role="toolbar" aria-label="Preview controls">
        <a className="gs-btn" href={back}>
          Back to editor
        </a>
        <button
          type="button"
          className="gs-btn"
          onClick={() => {
            setIssues([]);
            handle.current?.restart();
          }}
        >
          Restart
        </button>
        <label>
          <span className="gs-panel-title">Size </span>
          <select className="gs-input" value={size} onChange={(e) => setSize(e.target.value as Size)}>
            <option value="fit">Fit window</option>
            {(Object.keys(VIEWPORT_PRESETS) as (keyof typeof VIEWPORT_PRESETS)[]).map((id) => (
              <option key={id} value={id}>
                {VIEWPORT_PRESETS[id].label} ({VIEWPORT_PRESETS[id].width} x {VIEWPORT_PRESETS[id].height})
              </option>
            ))}
          </select>
        </label>
      </div>
      {empty ? (
        <p className="gs-empty">Nothing to preview yet: no card has elements. Add some in the editor.</p>
      ) : null}
      <div
        className="gs-pv-frame"
        style={preset ? { width: preset.width, height: preset.height } : undefined}
        data-fit={preset ? 'false' : 'true'}
      >
        <div ref={host} className="gs-pv-host" aria-label="Application preview" />
      </div>
      {issues.length > 0 ? (
        <section aria-label="Runtime issues" className="gs-pv-issues">
          <p className="gs-panel-title">Runtime issues ({issues.length})</p>
          <ul>
            {issues.map((m, i) => (
              <li key={i} className="gs-error">
                {m}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
