import { createCard, createStack, err } from '@ghoststack/domain';
import type { Stack } from '@ghoststack/domain';
import { createMemoryStorage } from '@ghoststack/storage';
import type { StoragePort } from '@ghoststack/storage';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../app/App';
import { ServicesProvider } from '../../app/services';
import { createTestServices } from '../../test/fakes';

const BACK = 'Return to Project Library';

function stackWithCards(title: string, cardTitles: string[]): Stack {
  const created = createStack(title || 'x', { clock: () => '2026-01-01T00:00:00.000Z' });
  if (!created.ok) throw new Error('seed failed');
  let stack = { ...created.value, title };
  for (const cardTitle of cardTitles) {
    const card = createCard(cardTitle);
    if (!card.ok) throw new Error('card failed');
    stack = {
      ...stack,
      cards: { ...stack.cards, [card.value.cardId]: card.value },
      cardOrder: [...stack.cardOrder, card.value.cardId],
    };
  }
  return stack;
}

describe('StackWorkspace', () => {
  async function open(storage: StoragePort, stack: Stack) {
    const user = userEvent.setup();
    const view = render(
      <ServicesProvider services={createTestServices({ storage })}>
        <App />
      </ServicesProvider>,
    );
    await user.click(
      await screen.findByRole('button', { name: new RegExp(stack.title || 'Untitled') }),
    );
    return { user, view };
  }

  it('shows the title, the Cards list in cardOrder, Saved status and placeholders', async () => {
    const storage = createMemoryStorage();
    const stack = stackWithCards('Quiz', ['Intro', 'Question', 'Result']);
    await storage.saveProject({ stack, assets: {} });
    await open(storage, stack);
    expect(await screen.findByRole('heading', { name: 'Quiz' })).toBeVisible();
    const nav = screen.getByRole('navigation', { name: 'Cards' });
    expect(
      within(nav)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(stack.cardOrder.map((id) => stack.cards[id]?.title));
    expect(screen.getByRole('status')).toHaveTextContent(/^Saved$/);
    expect(screen.getByRole('region', { name: 'Elements toolbox' })).toBeVisible();
    expect(screen.getByRole('main', { name: 'Card canvas' })).toBeVisible();
    expect(screen.getByRole('complementary', { name: 'Inspector' })).toBeVisible();
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([BACK]);
    expect(screen.queryByRole('button', { name: 'Retry save' })).toBeNull();
  });

  it('shows only the loading indicator while the project loads', async () => {
    const inner = createMemoryStorage();
    const stack = stackWithCards('Quiz', ['Intro']);
    await inner.saveProject({ stack, assets: {} });
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    const storage: StoragePort = {
      ...inner,
      loadProject: async (id) => {
        calls += 1;
        if (calls > 1) await gate;
        return inner.loadProject(id);
      },
    };
    const user = userEvent.setup();
    render(
      <ServicesProvider services={createTestServices({ storage })}>
        <App />
      </ServicesProvider>,
    );
    const row = await screen.findByRole('button', { name: /Quiz/ });
    await user.click(row);
    expect(await screen.findByRole('status')).toHaveTextContent('Loading project');
    expect(screen.queryByRole('heading', { name: 'Quiz' })).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Cards' })).toBeNull();
    expect(screen.queryByText('Saved')).toBeNull();
    release();
    expect(await screen.findByRole('heading', { name: 'Quiz' })).toBeVisible();
  });

  it.each(['storage-unavailable', 'not-found'] as const)(
    'shows the error and a working return action when the load fails with %s',
    async (code) => {
      const inner = createMemoryStorage();
      const stack = stackWithCards('Quiz', []);
      await inner.saveProject({ stack, assets: {} });
      // The Library checks the project once before opening; the workspace load is the second call.
      let calls = 0;
      const storage: StoragePort = {
        ...inner,
        loadProject: (id) => {
          calls += 1;
          return calls === 1
            ? inner.loadProject(id)
            : Promise.resolve(err({ code, message: 'Load refused.' }));
        },
      };
      const { user } = await open(storage, stack);
      expect(await screen.findByText('This project could not be opened')).toBeVisible();
      expect(screen.queryByText('Loading project')).toBeNull();
      await user.click(screen.getByRole('button', { name: BACK }));
      expect(await screen.findByRole('heading', { name: 'Project Library' })).toBeVisible();
    },
  );

  it('shows the placeholder for an empty title without changing stored data', async () => {
    const storage = createMemoryStorage();
    const stack = stackWithCards('', ['Intro']);
    await storage.saveProject({ stack, assets: {} });
    await open(storage, stack);
    expect(await screen.findByRole('heading', { name: 'Untitled stack' })).toBeVisible();
    const stored = await storage.loadProject(stack.stackId);
    expect(stored.ok && stored.value.stack.title).toBe('');
  });

  it('returns to the Library, and a reopen shows the same title and cards', async () => {
    const storage = createMemoryStorage();
    const stack = stackWithCards('Recipes', ['One', 'Two']);
    await storage.saveProject({ stack, assets: {} });
    const { user } = await open(storage, stack);
    await screen.findByRole('heading', { name: 'Recipes' });
    await user.click(screen.getByRole('button', { name: BACK }));
    await user.click(await screen.findByRole('button', { name: /Recipes/ }));
    expect(await screen.findByRole('heading', { name: 'Recipes' })).toBeVisible();
    const items = within(screen.getByRole('navigation', { name: 'Cards' })).getAllByRole(
      'listitem',
    );
    expect(items.map((li) => li.textContent)).toEqual(['Card 1', 'One', 'Two']);
  });
});
