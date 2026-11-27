import type { ReactNode } from 'react';
import type { ProviderState } from './store';
export const CONNECTION_LABEL: Record<ProviderState['connection'], string> = {
  'not-configured': 'not configured',
  untested: 'not tested',
  testing: 'testing',
  ready: 'ready',
  error: 'error',
};
const TONE: Record<ProviderState['connection'], string> = {
  'not-configured': 'idle',
  untested: 'idle',
  testing: 'busy',
  ready: 'ok',
  error: 'error',
};
/** Provider name, local or remote badge and connection state. Shared by the panel and the status-bar chip. */
export function ProviderBadge({ state }: { state: ProviderState }): ReactNode {
  const d = state.description;
  if (!state.settings) return <span>not configured</span>;
  return (
    <>
      <span>{d ? d.label : 'Invalid settings'}</span>
      {d ? (
        <span className="gs-ai-badge" data-tone={d.locality}>
          {d.locality === 'local' ? 'Local' : 'Remote'}
        </span>
      ) : null}
      <span className="gs-ai-badge" data-tone={TONE[state.connection]}>
        {CONNECTION_LABEL[state.connection]}
      </span>
    </>
  );
}
