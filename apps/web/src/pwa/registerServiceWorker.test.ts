import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerServiceWorker, registerServiceWorkerAfterLoad } from './registerServiceWorker';
import type { ServiceWorkerEnvironment } from './registerServiceWorker';

const update = vi.fn(() => Promise.resolve());
const registration = () => ({ update }) as unknown as ServiceWorkerRegistration;

function environment(overrides: Partial<ServiceWorkerEnvironment> = {}): ServiceWorkerEnvironment {
  return {
    production: true,
    isSecureContext: true,
    container: { register: vi.fn(() => Promise.resolve(registration())) },
    scriptUrl: '/sw.js',
    ...overrides,
  };
}

describe('registerServiceWorker', () => {
  beforeEach(() => {
    update.mockClear();
  });

  it('registers the worker script in a secure production context', async () => {
    const env = environment();
    await expect(registerServiceWorker(env)).resolves.toBe('registered');
    expect(env.container?.register).toHaveBeenCalledExactlyOnceWith('/sw.js');
  });

  it('asks the registration for an update check after registering', async () => {
    await registerServiceWorker(environment());
    expect(update).toHaveBeenCalledOnce();
  });

  it('still reports registered when the update check rejects or throws', async () => {
    update.mockImplementationOnce(() => Promise.reject(new Error('offline')));
    await expect(registerServiceWorker(environment())).resolves.toBe('registered');
    update.mockImplementationOnce(() => {
      throw new Error('InvalidStateError');
    });
    await expect(registerServiceWorker(environment())).resolves.toBe('registered');
  });

  it('skips registration outside production builds', async () => {
    const env = environment({ production: false });
    await expect(registerServiceWorker(env)).resolves.toBe('skipped-dev');
    expect(env.container?.register).not.toHaveBeenCalled();
  });

  it('reports unsupported when the browser has no service worker container', async () => {
    await expect(registerServiceWorker(environment({ container: undefined }))).resolves.toBe(
      'unsupported',
    );
  });

  it('reports unsupported in an insecure context without calling register', async () => {
    const env = environment({ isSecureContext: false });
    await expect(registerServiceWorker(env)).resolves.toBe('unsupported');
    expect(env.container?.register).not.toHaveBeenCalled();
  });

  it('resolves to failed when registration rejects', async () => {
    const container = { register: vi.fn(() => Promise.reject(new Error('blocked'))) };
    await expect(registerServiceWorker(environment({ container }))).resolves.toBe('failed');
  });

  it('resolves to failed when register throws synchronously', async () => {
    const container = {
      register: vi.fn((): Promise<ServiceWorkerRegistration> => {
        throw new Error('SecurityError');
      }),
    };
    await expect(registerServiceWorker(environment({ container }))).resolves.toBe('failed');
  });
});

describe('registerServiceWorkerAfterLoad', () => {
  it('does not throw in the test environment, which is not a production build', () => {
    expect(() => {
      registerServiceWorkerAfterLoad();
    }).not.toThrow();
  });
});
