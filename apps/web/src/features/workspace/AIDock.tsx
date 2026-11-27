import { Component, Suspense, lazy, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { EditorSlotProps } from '../../app/editorContext';

const AIPanel = lazy(() => import('../ai').then((m) => ({ default: m.AIPanel })));
const AIStatusChip = lazy(() => import('../ai').then((m) => ({ default: m.AIStatusChip })));

interface BoundaryState {
  failed: boolean;
}

/** Keeps a crash in the AI feature away from the editor (docs/UI_CONTRACT.md section 9). */
class AIBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, BoundaryState> {
  override state: BoundaryState = { failed: false };
  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }
  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Right-side dock for the AI assistant. Closing it returns focus to the control that opened it. */
export function AIDock({
  open,
  onClose,
  ...slot
}: EditorSlotProps & { open: boolean; onClose: () => void }): ReactNode {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);
  if (!open) return null;
  return (
    <aside
      ref={ref}
      tabIndex={-1}
      className="gs-panel gs-ws-aidock"
      aria-label="AI assistant"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div className="gs-ws-panehead">
        <h2 className="gs-panel-title">AI assistant</h2>
      </div>
      <AIBoundary
        fallback={
          <p className="gs-error" role="alert">
            The AI assistant stopped working. Editing is not affected. Close this panel and open it again.
          </p>
        }
      >
        <Suspense fallback={<p className="gs-empty">Loading the AI assistant.</p>}>
          <AIPanel {...slot} onClose={onClose} />
        </Suspense>
      </AIBoundary>
    </aside>
  );
}

/** Status-bar chip: provider name, local or remote badge, connection state. */
export function AIChip({ onOpen, ...slot }: EditorSlotProps & { onOpen: () => void }): ReactNode {
  return (
    <AIBoundary fallback={<span className="gs-error">AI: error</span>}>
      <Suspense fallback={<span>AI: loading</span>}>
        <AIStatusChip {...slot} onOpen={onOpen} />
      </Suspense>
    </AIBoundary>
  );
}
