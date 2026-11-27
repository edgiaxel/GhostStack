import type { ReactNode } from 'react';
import type { EditorSlotProps } from '../../app/editorContext';

/**
 * Entry points of the AI feature (docs/UI_CONTRACT.md section 9). The orchestrator wires them in
 * `features/workspace/AIDock.tsx`. Placeholder bodies until slice M3.3 replaces this file.
 */
export type AIPanelProps = EditorSlotProps & { onClose(): void };
export type AIStatusChipProps = EditorSlotProps & { onOpen(): void };

export function AIPanel({ onClose }: AIPanelProps): ReactNode {
  return (
    <div className="gs-ai-panel">
      <p className="gs-empty">The AI assistant is not available in this build.</p>
      <button type="button" className="gs-btn" onClick={onClose}>
        Close
      </button>
    </div>
  );
}

export function AIStatusChip({ onOpen }: AIStatusChipProps): ReactNode {
  return (
    <button type="button" className="gs-btn gs-ws-statusbtn" onClick={onOpen}>
      AI: not configured
    </button>
  );
}
