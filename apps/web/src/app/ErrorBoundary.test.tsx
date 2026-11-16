import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { createMemoryStorage } from '@ghoststack/storage';
import type { StoragePort } from '@ghoststack/storage';
import { createTestServices } from '../test/fakes';
import { ErrorBoundary } from './ErrorBoundary';
import { ServicesProvider } from './services';

const SECRET = 'SECRET-PROJECT-TITLE';

function Bomb(): never {
  throw new Error(`failed while rendering ${SECRET}`);
}

function spyOnStorage(storage: StoragePort) {
  return (Object.keys(storage) as (keyof StoragePort)[]).map((method) => vi.spyOn(storage, method));
}

describe('ErrorBoundary', () => {
  let consoleError: MockInstance;

  beforeEach(() => {
    // React logs caught render errors; keep the test output clean.
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>fine</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('fine')).toBeVisible();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows a fixed message without the error text or a stack trace', () => {
    const { container } = render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('unexpected error');
    expect(container.textContent).not.toContain(SECRET);
    expect(container.textContent).not.toMatch(/\bat\s+\S+\s*\(|\.tsx?:\d+/);
  });

  it('reload button calls onReload', async () => {
    const onReload = vi.fn();
    render(
      <ErrorBoundary onReload={onReload}>
        <Bomb />
      </ErrorBoundary>,
    );
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reload GhostStack' }));
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it('does not touch storage', () => {
    const storage = createMemoryStorage();
    const spies = spyOnStorage(storage);
    render(
      <ServicesProvider services={createTestServices({ storage })}>
        <ErrorBoundary>
          <Bomb />
        </ErrorBoundary>
      </ServicesProvider>,
    );
    expect(spies.length).toBeGreaterThan(0);
    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled();
    }
  });
});
