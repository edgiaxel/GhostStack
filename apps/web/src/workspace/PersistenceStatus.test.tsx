import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PersistenceStatus } from './PersistenceStatus';

describe('PersistenceStatus', () => {
  it('shows exactly Saved with no alert and no retry button', () => {
    render(<PersistenceStatus persistence="saved" detail={null} onRetry={() => undefined} />);
    expect(screen.getByRole('status')).toHaveTextContent(/^Saved$/);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows Save failed, the alert and a Retry save button that calls back', async () => {
    const onRetry = vi.fn();
    render(
      <PersistenceStatus persistence="save-failed" detail="Disk is full." onRetry={onRetry} />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(/^Save failed$/);
    expect(screen.getByRole('alert')).toHaveTextContent('The project was not saved. Disk is full.');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry save' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
