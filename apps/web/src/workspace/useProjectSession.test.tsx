import { createStack } from '@ghoststack/domain';
import type { Stack } from '@ghoststack/domain';
import { createMemoryStorage } from '@ghoststack/storage';
import type { StoragePort } from '@ghoststack/storage';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { ServicesProvider } from '../app/services';
import { createTestServices } from '../test/fakes';
import { useProjectSession } from './useProjectSession';

function makeStack(title = 'Quiz'): Stack {
  const created = createStack(title, { clock: () => '2026-01-01T00:00:00.000Z' });
  if (!created.ok) throw new Error('seed failed');
  return created.value;
}

/** Wraps a storage so saves fail while `failing.value` is true. */
function flaky(inner: StoragePort, failing: { value: boolean }): StoragePort {
  return {
    ...inner,
    saveProject: (bundle) =>
      failing.value
        ? Promise.resolve({
            ok: false as const,
            error: { code: 'write-failed' as const, message: 'Disk refused the write.' },
          })
        : inner.saveProject(bundle),
  };
}

function setup(storage: StoragePort, stackId: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ServicesProvider services={createTestServices({ storage })}>{children}</ServicesProvider>
  );
  return renderHook(() => useProjectSession(stackId), { wrapper });
}

describe('useProjectSession', () => {
  it('starts loading, then is ready and Saved with the stored stack', async () => {
    const storage = createMemoryStorage();
    const stack = makeStack();
    await storage.saveProject({ stack, assets: {} });
    const { result } = setup(storage, stack.stackId);
    expect(result.current.phase).toBe('loading');
    await waitFor(() => {
      expect(result.current.phase).toBe('ready');
    });
    const ready = result.current;
    if (ready.phase !== 'ready') throw new Error('not ready');
    expect(ready.stack).toEqual(stack);
    expect(ready.persistence).toBe('saved');
  });

  it('reports an error when the project is not found', async () => {
    const { result } = setup(createMemoryStorage(), 'stk_missing');
    await waitFor(() => {
      expect(result.current.phase).toBe('error');
    });
  });

  it('keeps the in-memory stack and flags Save failed, then retry recovers', async () => {
    const inner = createMemoryStorage();
    const stack = makeStack();
    await inner.saveProject({ stack, assets: {} });
    const failing = { value: true };
    const { result } = setup(flaky(inner, failing), stack.stackId);
    await waitFor(() => {
      expect(result.current.phase).toBe('ready');
    });
    const next = { ...stack, title: 'Renamed' };
    await act(async () => {
      if (result.current.phase === 'ready') await result.current.save(next);
    });
    let current = result.current;
    if (current.phase !== 'ready') throw new Error('not ready');
    expect(current.persistence).toBe('save-failed');
    expect(current.saveError).toBe('Disk refused the write.');
    expect(current.stack.title).toBe('Quiz');

    failing.value = false;
    await act(async () => {
      if (result.current.phase === 'ready') await result.current.retrySave();
    });
    current = result.current;
    if (current.phase !== 'ready') throw new Error('not ready');
    expect(current.persistence).toBe('saved');
    expect(current.stack.title).toBe('Renamed');
    const stored = await inner.loadProject(stack.stackId);
    expect(stored.ok && stored.value.stack.title).toBe('Renamed');
  });
});
