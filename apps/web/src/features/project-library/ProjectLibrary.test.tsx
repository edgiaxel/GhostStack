import { createStack, err, generateId } from '@ghoststack/domain';
import { createFaultController, createMemoryStorage } from '@ghoststack/storage';
import type { StorageError, StoragePort } from '@ghoststack/storage';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../app/App';
import { ServicesProvider } from '../../app/services';
import type { Services } from '../../app/services';
import { createPreferencesStore } from '../../preferences/preferences';
import { createFakeKeyValueStorage, createTestServices } from '../../test/fakes';

function makeServices(overrides: Partial<Services> = {}): Services {
  return createTestServices({ newId: generateId, ...overrides });
}

function renderApp(services: Services) {
  return render(
    <ServicesProvider services={services}>
      <App />
    </ServicesProvider>,
  );
}

async function seed(storage: StoragePort, title: string, updatedAt: string) {
  const created = createStack(title, { clock: () => updatedAt });
  if (!created.ok) throw new Error('seed failed');
  await storage.saveProject({ stack: created.value, assets: {} });
  return created.value;
}

const failure = (code: StorageError['code'], message: string) => err({ code, message });

describe('ProjectLibrary', () => {
  it('shows the create form and no list when nothing is stored', async () => {
    renderApp(makeServices());
    expect(await screen.findByText(/No projects yet/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Create Project' })).toBeEnabled();
    expect(screen.queryByRole('list', { name: 'Projects' })).toBeNull();
    expect(screen.queryByText(/sign in|account/i)).toBeNull();
  });

  it('shows a loading status before the listing arrives', () => {
    renderApp(makeServices());
    expect(screen.getByRole('status')).toHaveTextContent('Loading projects');
  });

  it('creates a project with the trimmed title, saves it and opens the workspace', async () => {
    const services = makeServices();
    const user = userEvent.setup();
    renderApp(services);
    await user.type(await screen.findByLabelText('Stack title'), '  Quiz  ');
    await user.click(screen.getByRole('button', { name: 'Create Project' }));
    expect(await screen.findByRole('button', { name: 'Return to Project Library' })).toBeVisible();
    const listed = await services.storage.listProjects();
    expect(listed.ok && listed.value.summaries.map((s) => s.title)).toEqual(['Quiz']);
    const id = listed.ok ? listed.value.summaries[0]?.stackId : undefined;
    expect(services.preferences.get('lastProjectId')).toBe(id);
  });

  it.each([
    ['empty', '', /1 to 100 characters/],
    ['whitespace-only', '   ', /1 to 100 characters/],
    ['101 characters', 'x'.repeat(101), /100 characters or fewer/],
  ])('rejects a %s title, keeps the text and saves nothing', async (_name, text, message) => {
    const services = makeServices();
    const user = userEvent.setup();
    renderApp(services);
    const input = await screen.findByLabelText('Stack title');
    if (text !== '') await user.click(input);
    if (text !== '') await user.paste(text);
    await user.click(screen.getByRole('button', { name: 'Create Project' }));
    const error = await screen.findByText(message);
    expect(input).toHaveAttribute('aria-describedby', error.id);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveValue(text);
    const listed = await services.storage.listProjects();
    expect(listed.ok && listed.value.summaries).toEqual([]);
    expect(screen.queryByRole('button', { name: 'Return to Project Library' })).toBeNull();
  });

  it('reports a failed save, keeps the title, stays on the library and lists nothing', async () => {
    const faults = createFaultController();
    const services = makeServices({ storage: createMemoryStorage({ faults }) });
    const user = userEvent.setup();
    renderApp(services);
    await user.type(await screen.findByLabelText('Stack title'), 'Doomed');
    faults.failNextWrite('write-failed');
    await user.click(screen.getByRole('button', { name: 'Create Project' }));
    expect(await screen.findByText(/The stack was not saved/)).toBeVisible();
    expect(screen.getByLabelText('Stack title')).toHaveValue('Doomed');
    expect(screen.queryByRole('button', { name: 'Return to Project Library' })).toBeNull();
    expect(screen.queryByRole('list', { name: 'Projects' })).toBeNull();
    expect(services.preferences.get('lastProjectId')).toBeNull();
    // Retry works once the fault is gone.
    await user.click(screen.getByRole('button', { name: 'Create Project' }));
    expect(await screen.findByRole('button', { name: 'Return to Project Library' })).toBeVisible();
  });

  it('lists projects newest first and shows them again after a reload', async () => {
    const storage = createMemoryStorage();
    await seed(storage, 'Older', '2026-01-01T00:00:00.000Z');
    await seed(storage, 'Newer', '2026-02-01T00:00:00.000Z');
    const first = renderApp(makeServices({ storage }));
    const titles = async () =>
      (await screen.findAllByRole('listitem')).map((item) => item.textContent ?? '');
    const rows = await titles();
    expect(rows[0]).toContain('Newer');
    expect(rows[1]).toContain('Older');
    first.unmount();
    renderApp(makeServices({ storage }));
    expect((await titles())[0]).toContain('Newer');
    expect(document.querySelector('time')).toHaveAttribute('datetime', '2026-02-01T00:00:00.000Z');
  });

  it('opens a selected project and remembers it', async () => {
    const storage = createMemoryStorage();
    const stack = await seed(storage, 'Recipes', '2026-01-01T00:00:00.000Z');
    const services = makeServices({ storage });
    const user = userEvent.setup();
    renderApp(services);
    await user.click(await screen.findByRole('button', { name: /Recipes/ }));
    expect(await screen.findByRole('button', { name: 'Return to Project Library' })).toBeVisible();
    expect(services.preferences.get('lastProjectId')).toBe(stack.stackId);
  });

  it('marks a project as unavailable when it fails to load and keeps the others selectable', async () => {
    const memory = createMemoryStorage();
    const bad = await seed(memory, 'Broken', '2026-02-01T00:00:00.000Z');
    await seed(memory, 'Fine', '2026-01-01T00:00:00.000Z');
    const storage: StoragePort = {
      ...memory,
      loadProject: (id) =>
        id === bad.stackId
          ? Promise.resolve(failure('validation-failed', 'bad'))
          : memory.loadProject(id),
    };
    const user = userEvent.setup();
    renderApp(makeServices({ storage }));
    await user.click(await screen.findByRole('button', { name: /Broken/ }));
    expect(await screen.findByText(/Unavailable: this project could not be loaded/)).toBeVisible();
    expect(screen.getByRole('button', { name: /Broken/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Fine/ })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Return to Project Library' })).toBeNull();
    expect((await memory.loadProject(bad.stackId)).ok).toBe(true);
  });

  it('shows unreadable records as disabled rows next to selectable projects', async () => {
    const memory = createMemoryStorage();
    await seed(memory, 'Fine', '2026-01-01T00:00:00.000Z');
    const storage: StoragePort = {
      ...memory,
      listProjects: async () => {
        const listed = await memory.listProjects();
        if (!listed.ok) return listed;
        return {
          ok: true,
          value: {
            ...listed.value,
            unreadable: [{ stackId: 'stk_broken-record', message: 'corrupt' }],
          },
        };
      },
    };
    renderApp(makeServices({ storage }));
    const row = await screen.findByRole('button', { name: /Unreadable project/ });
    expect(row).toBeDisabled();
    expect(row).toHaveTextContent('Unavailable: this project could not be loaded');
    expect(screen.getByRole('button', { name: /Fine/ })).toBeEnabled();
  });

  it('shows an alert and no success message when storage is unavailable', async () => {
    const memory = createMemoryStorage();
    const storage: StoragePort = {
      ...memory,
      listProjects: () => Promise.resolve(failure('storage-unavailable', 'no idb')),
      saveProject: () => Promise.resolve(failure('storage-unavailable', 'no idb')),
    };
    const user = userEvent.setup();
    renderApp(makeServices({ storage }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Projects cannot be saved in this browser session.',
    );
    await user.type(screen.getByLabelText('Stack title'), 'Nope');
    await user.click(screen.getByRole('button', { name: 'Create Project' }));
    expect(await screen.findByText(/The stack was not saved/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Return to Project Library' })).toBeNull();
  });

  it('offers a retry when listing fails for another reason', async () => {
    const memory = createMemoryStorage();
    let calls = 0;
    const storage: StoragePort = {
      ...memory,
      listProjects: () =>
        ++calls === 1 ? Promise.resolve(failure('write-failed', 'flaky')) : memory.listProjects(),
    };
    const user = userEvent.setup();
    renderApp(makeServices({ storage }));
    await user.click(await screen.findByRole('button', { name: 'Retry listing projects' }));
    expect(await screen.findByText(/No projects yet/)).toBeVisible();
  });

  it('renders import, rename, export and delete as disabled with a visible label', async () => {
    renderApp(makeServices());
    await screen.findByText(/No projects yet/);
    for (const name of [/Import \.gsp/, /Rename/, /Export/, /Delete/]) {
      const button = screen.getByRole('button', { name });
      expect(button).toBeDisabled();
      expect(button).toHaveTextContent('not available in this slice');
    }
  });

  it('resets a stale lastProjectId and marks an existing one as last opened', async () => {
    const memory = createMemoryStorage();
    const stack = await seed(memory, 'Kept', '2026-01-01T00:00:00.000Z');
    const stale = createPreferencesStore(
      createFakeKeyValueStorage({
        'ghoststack.pref.lastProjectId': 'stk_11111111-1111-4111-8111-111111111111',
      }),
    );
    renderApp(makeServices({ storage: memory, preferences: stale }));
    await waitFor(() => {
      expect(stale.get('lastProjectId')).toBeNull();
    });
    const fresh = createPreferencesStore(createFakeKeyValueStorage());
    fresh.set('lastProjectId', stack.stackId);
    renderApp(makeServices({ storage: memory, preferences: fresh }));
    expect(await screen.findByText('Last opened')).toBeVisible();
    expect(fresh.get('lastProjectId')).toBe(stack.stackId);
  });

  it('can be driven by keyboard: Enter in the title field submits the form', async () => {
    const user = userEvent.setup();
    renderApp(makeServices());
    await user.type(await screen.findByLabelText('Stack title'), 'Keys{Enter}');
    expect(await screen.findByRole('button', { name: 'Return to Project Library' })).toBeVisible();
  });
});
