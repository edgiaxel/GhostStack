// GhostStack app-shell service worker, served as /sw.js by the production build.
// The build step prepends `const GS_BUILD` and `const GS_PRECACHE` (see precacheServiceWorkerPlugin.ts).
// It caches only that file list and never stores responses at runtime, so project data stays in IndexedDB.

const CACHE_PREFIX = 'ghoststack-shell-';
const CACHE_NAME = CACHE_PREFIX + GS_BUILD;
const SHELL_PATH = 'index.html';

// Entries are relative to the registration scope so a non-root Vite base keeps working.
const precacheUrls = GS_PRECACHE.map((path) => new URL(path, self.registration.scope).href);
const precacheSet = new Set(precacheUrls);
const shellUrl = new URL(SHELL_PATH, self.registration.scope).href;

function isSameOrigin(url) {
  return new URL(url).origin === self.location.origin;
}

// Decides what a request should get. 'shell' and 'asset' are answered from the cache; 'network' is left alone.
function classifyRequest(request) {
  if (request.method !== 'GET' || !isSameOrigin(request.url)) return 'network';
  if (request.mode === 'navigate') return 'shell';
  return precacheSet.has(request.url) ? 'asset' : 'network';
}

async function precache() {
  const cache = await caches.open(CACHE_NAME);
  // 'reload' skips the HTTP cache so a new build is never mixed with stale files.
  await cache.addAll(precacheUrls.map((url) => new Request(url, { cache: 'reload' })));
}

async function deleteOldCaches() {
  const names = await caches.keys();
  await Promise.all(
    names
      .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map((name) => caches.delete(name)),
  );
}

async function respond(request, kind) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(kind === 'shell' ? shellUrl : request.url);
  // Only reached when the cache was evicted; the browser fetch is the plain network fallback.
  return cached ?? fetch(request);
}

self.addEventListener('install', (event) => {
  // The new worker activates as soon as it is installed, in the background. Open pages are not reloaded,
  // and the new build is served on the next page load.
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(deleteOldCaches());
});

self.addEventListener('fetch', (event) => {
  const kind = classifyRequest(event.request);
  if (kind === 'network') return;
  event.respondWith(respond(event.request, kind));
});
