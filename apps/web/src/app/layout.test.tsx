// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { WorkspaceLayout } from './AppShell';

afterEach(cleanup);

it('renders every workspace slot, including the toolbar (jsdom + Testing Library wired)', () => {
  render(
    <WorkspaceLayout
      navigator={<p>nav</p>}
      toolbar={<button type="button">Undo</button>}
      canvas={<p>canvas</p>}
      inspector={<p>inspector</p>}
      drawer={<p>drawer</p>}
    />,
  );
  expect(screen.getByRole('toolbar', { name: 'Stack actions' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
  for (const text of ['nav', 'canvas', 'inspector', 'drawer']) expect(screen.getByText(text)).toBeTruthy();
});
