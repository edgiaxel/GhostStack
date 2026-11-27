import type { ReactNode } from 'react';
import type { EditorSlotProps } from '../../app/editorContext';
import { AIPanel } from './AIPanel';
import { ProviderBadge } from './ProviderBadge';
import { providerStore, useProviderState } from './store';
import './ai.css';
/**
 * Entry points of the AI feature (docs/UI_CONTRACT.md section 9). The workspace lazy-loads them in
 * `features/workspace/AIDock.tsx` behind an error boundary.
 */
export type { AIPanelProps } from './AIPanel';
export { AIPanel };
export type AIStatusChipProps = EditorSlotProps & { onOpen(): void };
/** Status-bar chip: provider name, local or remote badge and connection state. */
export function AIStatusChip({ onOpen }: AIStatusChipProps): ReactNode {
  const state = useProviderState(providerStore);
  return (
    <button type="button" className="gs-btn gs-kit-btn gs-kit-btn--ghost gs-ws-statusbtn" onClick={onOpen}>
      <span className="gs-ai-chip">
        <span>AI:</span>
        <ProviderBadge state={state} />
      </span>
    </button>
  );
}
