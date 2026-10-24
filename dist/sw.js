// Artisan Kitchen service worker: app-shell + image cache (stale-while-revalidate).
const SHELL = 'ak-shell-v1';
const IMG = 'ak-img-v1';
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => ![SHELL, IMG].includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/')) return; // never cache API
  if (url.pathname.startsWith('/img/')) {
    e.respondWith(caches.open(IMG).then(async (c) => {
      const hit = await c.match(e.request);
      const net = fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  // App shell: network first, fall back to cache (so the menu opens offline).
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok && (url.pathname.startsWith('/assets/') || e.request.mode === 'navigate')) caches.open(SHELL).then((c) => c.put(e.request.mode === 'navigate' ? '/index.html' : e.request, r.clone()));
    return r;
  }).catch(async () => (await caches.match(e.request.mode === 'navigate' ? '/index.html' : e.request)) || Response.error()));
});
