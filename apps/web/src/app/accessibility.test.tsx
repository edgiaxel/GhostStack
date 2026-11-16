import { createCard, createStack } from '@ghoststack/domain';
import { createMemoryStorage } from '@ghoststack/storage';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createTestServices } from '../test/fakes';
import { App } from './App';
import { ServicesProvider } from './services';

const FOCUSABLE =
  'button:not(:disabled), input:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])';

async function renderWithProject() {
  const storage = createMemoryStorage();
  const created = createStack('Quiz', { clock: () => '2026-01-01T00:00:00.000Z' });
  if (!created.ok) throw new Error('seed failed');
  const card = createCard('Intro');
  if (!card.ok) throw new Error('card failed');
  const stack = {
    ...created.value,
    cards: { ...created.value.cards, [card.value.cardId]: card.value },
    cardOrder: [...created.value.cardOrder, card.value.cardId],
  };
  await storage.saveProject({ stack, assets: {} });
  const user = userEvent.setup();
  render(
    <ServicesProvider services={createTestServices({ storage })}>
      <App />
    </ServicesProvider>,
  );
  await screen.findByRole('button', { name: /Quiz/ });
  return user;
}

function expectNamedControls() {
  for (const control of [...screen.queryAllByRole('button'), ...screen.queryAllByRole('textbox')]) {
    expect(control).toHaveAccessibleName();
  }
}

// Presses Tab through the page and returns the focused elements in the order reached.
async function tabThrough(user: ReturnType<typeof userEvent.setup>, count: number) {
  const reached: Element[] = [];
  for (let i = 0; i < count; i += 1) {
    await user.tab();
    if (document.activeElement !== null) reached.push(document.activeElement);
  }
  return reached;
}

describe('accessibility: Project Library', () => {
  it('gives every button and textbox an accessible name', async () => {
    await renderWithProject();
    expect(screen.getAllByRole('button').length).toBeGreaterThan(1);
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expectNamedControls();
  });

  it('reaches enabled controls with Tab in DOM order', async () => {
    const user = await renderWithProject();
    const expected = [...document.querySelectorAll(FOCUSABLE)];
    expect(expected.length).toBeGreaterThanOrEqual(3);
    expect(await tabThrough(user, expected.length)).toEqual(expected);
  });

  it('exposes a main landmark', async () => {
    await renderWithProject();
    expect(screen.getByRole('main')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Project Library' })).toBeVisible();
  });
});

describe('accessibility: Stack Workspace', () => {
  async function openWorkspace() {
    const user = await renderWithProject();
    await user.click(screen.getByRole('button', { name: /Quiz/ }));
    await screen.findByRole('navigation', { name: 'Cards' });
    return user;
  }

  it('exposes header, Cards nav, main, inspector and toolbox landmarks with names', async () => {
    await openWorkspace();
    expect(screen.getByRole('banner')).toBeVisible();
    expect(screen.getByRole('navigation', { name: 'Cards' })).toBeVisible();
    expect(screen.getByRole('main', { name: 'Card canvas' })).toBeVisible();
    expect(screen.getByRole('complementary', { name: 'Inspector' })).toBeVisible();
    expect(screen.getByRole('region', { name: 'Elements toolbox' })).toBeVisible();
  });

  it('gives every button an accessible name', async () => {
    await openWorkspace();
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
    expectNamedControls();
  });

  it('reaches enabled controls with Tab in DOM order', async () => {
    const user = await openWorkspace();
    const expected = [...document.querySelectorAll(FOCUSABLE)];
    expect(expected.length).toBeGreaterThanOrEqual(1);
    expect(await tabThrough(user, expected.length)).toEqual(expected);
  });
});
