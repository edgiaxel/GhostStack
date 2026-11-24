import { PersistenceStatus } from './PersistenceStatus';
import { useProjectSession } from './useProjectSession';
import './stackWorkspace.css';

const BACK = 'Return to Project Library';

function cardLabel(title: string | undefined): string {
  return title === undefined || title === '' ? 'Untitled card' : title;
}

export function StackWorkspace({ stackId, onClose }: { stackId: string; onClose: () => void }) {
  const session = useProjectSession(stackId);

  if (session.phase === 'loading') {
    return (
      <main className="gs-ws-loading">
        <p role="status">Loading project</p>
      </main>
    );
  }

  if (session.phase === 'error') {
    return (
      <main className="gs-ws-error" aria-labelledby="gs-ws-error-heading">
        <h2 id="gs-ws-error-heading">This project could not be opened</h2>
        <p role="alert">{session.message}</p>
        <button type="button" className="gs-btn" onClick={onClose}>
          {BACK}
        </button>
      </main>
    );
  }

  const { stack } = session;
  const untitled = stack.title === '';
  return (
    <div className="gs-workspace">
      <header className="gs-ws-header">
        <button type="button" className="gs-btn" onClick={onClose}>
          {BACK}
        </button>
        <h2 className={untitled ? 'gs-ws-title gs-ws-untitled' : 'gs-ws-title'}>
          {untitled ? 'Untitled stack' : stack.title}
        </h2>
        <PersistenceStatus
          persistence={session.persistence}
          detail={session.saveError}
          onRetry={() => void session.retrySave()}
        />
      </header>
      <nav className="gs-ws-navigator" aria-label="Cards">
        <h3>Cards</h3>
        <ol>
          {stack.cardOrder.map((cardId) => (
            <li key={cardId}>{cardLabel(stack.cards[cardId]?.title)}</li>
          ))}
        </ol>
      </nav>
      <section className="gs-ws-toolbox" aria-label="Elements toolbox">
        <h3>Elements toolbox</h3>
        <p className="gs-ws-placeholder">Placeholder. Element tools arrive in a later milestone.</p>
      </section>
      <main className="gs-ws-canvas" aria-label="Card canvas">
        <h3>Card canvas</h3>
        <p className="gs-ws-placeholder">Placeholder. Card editing arrives in a later milestone.</p>
      </main>
      <aside className="gs-ws-inspector" aria-label="Inspector">
        <h3>Inspector</h3>
        <p className="gs-ws-placeholder">Placeholder. Properties arrive in a later milestone.</p>
      </aside>
    </div>
  );
}
