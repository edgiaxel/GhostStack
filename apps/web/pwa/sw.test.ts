// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { renderServiceWorker } from './precacheServiceWorkerPlugin';

const template = readFileSync(new URL('./sw.js', import.meta.url), 'utf8');

const ORIGIN = 'https://app.test';
const SCOPE = `${ORIGIN}/`;
const PRECACHE = ['index.html', 'favicon.svg', 'assets/app-1.js', 'assets/inter-400.woff2'];

type Handler = (event: FakeEvent) => void;
interface FakeEvent {
  request?: { method: string; url: string; mode: string };
  waitUntil?: (promise: Promise<unknown>) => void;
  respondWith?: (promise: Promise<Response>) => void;
}

// In-memory stand-in for CacheStorage. The worker file under test is the real one.
function createCaches(network: Map<string, string>) {
  const stores = new Map<string, Map<string, Response>>();
  const open = (name: string) => {
    const store = stores.get(name) ?? new Map<string, Response>();
    stores.set(name, store);
    return Promise.resolve({
      addAll: (requests: Request[]) =>
        new Promise<void>((resolve, reject) => {
          const staged = new Map<string, Response>();
          for (const request of requests) {
            const body = network.get(request.url);
            if (body === undefined) {
              reject(new TypeError(`404 ${request.url}`));
              return;
            }
            expect(request.cache).toBe('reload');
            staged.set(request.url, new Response(body));
          }
          for (const [url, response] of staged) store.set(url, response);
          resolve();
        }),
      match: (url: string) => Promise.resolve(store.get(url)?.clone()),
    });
  };
  return {
    stores,
    caches: {
      open,
      keys: () => Promise.resolve([...stores.keys()]),
      delete: (name: string) => Promise.resolve(stores.delete(name)),
    },
  };
}

function loadWorker(build: string, caches: ReturnType<typeof createCaches>['caches']) {
  const handlers = new Map<string, Handler>();
  const skipWaiting = vi.fn(() => Promise.resolve());
  const networkFetch = vi.fn((request: { url: string }) =>
    Promise.resolve(new Response(`network:${request.url}`)),
  );
  const self = {
    addEventListener: (type: string, handler: Handler) => handlers.set(type, handler),
    registration: { scope: SCOPE },
    location: { origin: ORIGIN },
    skipWaiting,
  };
  runInNewContext(renderServiceWorker(template, build, PRECACHE), {
    self,
    caches,
    URL,
    Request,
    Response,
    Promise,
    Set,
    fetch: networkFetch,
  });
  const lifecycle = async (type: 'install' | 'activate') => {
    let pending: Promise<unknown> = Promise.resolve();
    handlers.get(type)?.({
      waitUntil: (promise) => {
        pending = promise;
      },
    });
    await pending;
  };
  const dispatchFetch = (request: { method?: string; url: string; mode?: string }) => {
    let response: Promise<Response> | undefined;
    handlers.get('fetch')?.({
      request: { method: 'GET', mode: 'no-cors', ...request },
      respondWith: (promise) => {
        response = promise;
      },
    });
    return response;
  };
  return { lifecycle, dispatchFetch, skipWaiting, networkFetch };
}

function networkFor(prefix: string) {
  return new Map(PRECACHE.map((path) => [`${SCOPE}${path}`, `${prefix}:${path}`]));
}

describe('service worker install', () => {
  it('precaches every listed file into a cache named by the build id, then skips waiting', async () => {
    const { caches, stores } = createCaches(networkFor('v1'));
    const worker = loadWorker('build-1', caches);
    await worker.lifecycle('install');
    expect([...stores.keys()]).toEqual(['ghoststack-shell-build-1']);
    expect([...(stores.get('ghoststack-shell-build-1')?.keys() ?? [])].sort()).toEqual(
      PRECACHE.map((path) => `${SCOPE}${path}`).sort(),
    );
    expect(worker.skipWaiting).toHaveBeenCalledOnce();
  });

  it('fails install and does not activate when one file is missing', async () => {
    const network = networkFor('v1');
    network.delete(`${SCOPE}assets/app-1.js`);
    const { caches, stores } = createCaches(network);
    const worker = loadWorker('build-1', caches);
    await expect(worker.lifecycle('install')).rejects.toThrow(TypeError);
    expect(worker.skipWaiting).not.toHaveBeenCalled();
    expect(stores.get('ghoststack-shell-build-1')?.size ?? 0).toBe(0);
  });
});

describe('service worker activate', () => {
  it('deletes older shell caches and keeps the current one and unrelated caches', async () => {
    const { caches, stores } = createCaches(networkFor('v2'));
    stores.set('ghoststack-shell-build-1', new Map());
    stores.set('other-app-cache', new Map());
    const worker = loadWorker('build-2', caches);
    await worker.lifecycle('install');
    await worker.lifecycle('activate');
    expect([...stores.keys()].sort()).toEqual(['ghoststack-shell-build-2', 'other-app-cache']);
  });
});

describe('service worker fetch', () => {
  async function installed() {
    const { caches } = createCaches(networkFor('v1'));
    const worker = loadWorker('build-1', caches);
    await worker.lifecycle('install');
    return worker;
  }

  it('answers any same-origin navigation with the cached index.html, ignoring path and query', async () => {
    const worker = await installed();
    for (const url of [
      `${SCOPE}`,
      `${SCOPE}?stack=1`,
      `${SCOPE}#/stack/abc`,
      `${SCOPE}unknown/path`,
    ]) {
      const response = await worker.dispatchFetch({ url, mode: 'navigate' });
      await expect(response?.text()).resolves.toBe('v1:index.html');
    }
    expect(worker.networkFetch).not.toHaveBeenCalled();
  });

  it('answers a precached asset from the cache', async () => {
    const worker = await installed();
    const response = await worker.dispatchFetch({ url: `${SCOPE}assets/inter-400.woff2` });
    await expect(response?.text()).resolves.toBe('v1:assets/inter-400.woff2');
  });

  it('does not intercept cross-origin, non-GET or unlisted requests', async () => {
    const worker = await installed();
    expect(worker.dispatchFetch({ url: 'https://fonts.example/x.woff2' })).toBeUndefined();
    expect(worker.dispatchFetch({ url: 'https://other.test/', mode: 'navigate' })).toBeUndefined();
    expect(
      worker.dispatchFetch({ url: `${SCOPE}assets/app-1.js`, method: 'POST' }),
    ).toBeUndefined();
    expect(worker.dispatchFetch({ url: `${SCOPE}api/projects` })).toBeUndefined();
    expect(worker.dispatchFetch({ url: `${SCOPE}assets/app-1.js?v=2` })).toBeUndefined();
  });

  it('falls back to the network only when the cache entry is gone', async () => {
    const { caches, stores } = createCaches(networkFor('v1'));
    const worker = loadWorker('build-1', caches);
    await worker.lifecycle('install');
    stores.get('ghoststack-shell-build-1')?.clear();
    const response = await worker.dispatchFetch({ url: `${SCOPE}`, mode: 'navigate' });
    await expect(response?.text()).resolves.toBe(`network:${SCOPE}`);
    expect(worker.networkFetch).toHaveBeenCalledOnce();
  });

  it('never writes to the cache while serving requests', async () => {
    const { caches, stores } = createCaches(networkFor('v1'));
    const worker = loadWorker('build-1', caches);
    await worker.lifecycle('install');
    const before = [...(stores.get('ghoststack-shell-build-1')?.keys() ?? [])];
    expect(worker.dispatchFetch({ url: `${SCOPE}api/projects` })).toBeUndefined();
    await worker.dispatchFetch({ url: `${SCOPE}`, mode: 'navigate' });
    expect([...(stores.get('ghoststack-shell-build-1')?.keys() ?? [])]).toEqual(before);
  });
});

// The app code ban on fetch (src/boundaries.test.ts) is unchanged. This file sits outside src/, so that scan
// never sees it. Its single fetch call is the cache-miss fallback; nothing else may reach the network.
describe('service worker source boundaries', () => {
  const code = template.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('has no eval, dynamic code, importScripts, XMLHttpRequest or hard-coded URL', () => {
    expect(code).not.toMatch(/\beval\s*\(|\bnew\s+Function\b|\bimportScripts\b|\bXMLHttpRequest\b/);
    expect(code).not.toMatch(/https?:\/\//);
  });

  it('calls fetch exactly once, with the intercepted request', () => {
    expect(code.match(/\bfetch\s*\(/g)).toHaveLength(1);
    expect(code).toContain('fetch(request)');
  });

  it('stores nothing at runtime: no cache put or add outside precaching', () => {
    expect(code).not.toMatch(/\.put\s*\(/);
    expect(code.match(/\.addAll\s*\(/g)).toHaveLength(1);
  });
});
