import { Component } from 'react';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onReload?: () => void;
}

interface State {
  failed: boolean;
}

// The fallback shows fixed text only: error messages and stacks can contain project data.
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    const reload = this.props.onReload ?? (() => window.location.reload());
    return (
      <main className="gs-editor">
        <h1>GhostStack</h1>
        <div role="alert">
          <p>GhostStack hit an unexpected error and could not show this screen.</p>
          <p>Reloading opens the Project Library again. Saved projects are not changed.</p>
        </div>
        <button type="button" onClick={reload}>
          Reload GhostStack
        </button>
      </main>
    );
  }
}
