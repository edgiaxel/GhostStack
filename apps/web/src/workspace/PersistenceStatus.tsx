import type { Persistence } from './useProjectSession';

export function PersistenceStatus({
  persistence,
  detail,
  onRetry,
}: {
  persistence: Persistence;
  detail: string | null;
  onRetry: () => void;
}) {
  const failed = persistence === 'save-failed';
  return (
    <div className="gs-persistence" data-state={persistence}>
      <p role="status" aria-live="polite" className="gs-persistence-label">
        {failed ? 'Save failed' : 'Saved'}
      </p>
      {failed && (
        <>
          <p role="alert" className="gs-persistence-alert">
            The project was not saved
            {detail === null || detail === '' ? '.' : `. ${detail}`}
          </p>
          <button type="button" className="gs-btn" onClick={onRetry}>
            Retry save
          </button>
        </>
      )}
    </div>
  );
}
