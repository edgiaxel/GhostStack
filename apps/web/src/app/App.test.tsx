import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createPreferencesStore } from '../preferences/preferences';
import { createFakeKeyValueStorage, createTestServices } from '../test/fakes';
import { App } from './App';
import { ServicesProvider } from './services';

const STACK_ID = 'stk_11111111-1111-4111-8111-111111111111';

function renderApp(services = createTestServices()) {
  return render(
    <ServicesProvider services={services}>
      <App />
    </ServicesProvider>,
  );
}

describe('App', () => {
  it('renders the GhostStack heading and the Project Library', () => {
    renderApp();
    expect(screen.getByRole('heading', { name: 'GhostStack' })).toBeVisible();
    expect(screen.getByText('Project Library')).toBeVisible();
  });

  it('shows the Project Library at startup even when lastProjectId is set', () => {
    const preferences = createPreferencesStore(
      createFakeKeyValueStorage({ 'ghoststack.pref.lastProjectId': STACK_ID }),
    );
    expect(preferences.get('lastProjectId')).toBe(STACK_ID);
    renderApp(createTestServices({ preferences }));
    expect(screen.getByText('Project Library')).toBeVisible();
    expect(screen.queryByRole('button', { name: /return/i })).toBeNull();
  });

  it('applies stored panel sizes and visibility on the first render', () => {
    const preferences = createPreferencesStore(
      createFakeKeyValueStorage({
        'ghoststack.pref.panelSizes': JSON.stringify({ navigator: 200, inspector: 400 }),
        'ghoststack.pref.panelVisibility': JSON.stringify({
          navigator: false,
          toolbox: true,
          inspector: false,
        }),
      }),
    );
    const { container } = renderApp(createTestServices({ preferences }));
    const root = container.querySelector<HTMLElement>('.gs-editor');
    expect(root?.style.getPropertyValue('--gs-nav-width')).toBe('200px');
    expect(root?.style.getPropertyValue('--gs-inspector-width')).toBe('400px');
    expect(root).toHaveAttribute('data-gs-theme', 'spectral-workstation');
    expect(root).toHaveAttribute('data-gs-navigator', 'hidden');
    expect(root).toHaveAttribute('data-gs-toolbox', 'visible');
    expect(root).toHaveAttribute('data-gs-inspector', 'hidden');
  });

  it('falls back to default panel values when preferences are malformed', () => {
    const preferences = createPreferencesStore(
      createFakeKeyValueStorage({ 'ghoststack.pref.panelSizes': '{"navigator":"wide"}' }),
    );
    const { container } = renderApp(createTestServices({ preferences }));
    const root = container.querySelector<HTMLElement>('.gs-editor');
    expect(root?.style.getPropertyValue('--gs-nav-width')).toBe('240px');
    expect(root?.style.getPropertyValue('--gs-inspector-width')).toBe('320px');
  });

  it('throws a clear error when rendered without ServicesProvider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      expect(() => render(<App />)).toThrow('useServices must be used inside ServicesProvider.');
    } finally {
      consoleError.mockRestore();
    }
  });
});
