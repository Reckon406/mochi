// Mochi's World service worker: app shell offline, but state.json / art / music always try the network first
const V = 'mochi-v3'; // bump when tex/, models/ or hdri/ files change (they are cache-first)
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
const netFirst = async (req) => { try { const r = await fetch(req); if (r && r.ok && req.method === 'GET') { const c = await caches.open(V); c.put(req, r.clone()); } return r; } catch (e) { const hit = await caches.match(req, { ignoreSearch: true }); if (hit) return hit; throw e; } };
const cacheFirst = async (req) => { const hit = await caches.match(req); if (hit) return hit; const r = await fetch(req); if (r && r.ok) { const c = await caches.open(V); c.put(req, r.clone()); } return r; };
self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return; const url = new URL(req.url); if (url.origin !== location.origin) return;
  const p = url.pathname;
  if (/\/assets\/|\/fonts\/|\/tex\/|\/models\/|\/hdri\//.test(p)) { e.respondWith(cacheFirst(req)); return; } // hashed build files + fonts never change
  e.respondWith(netFirst(req)); // state.json, art, music, html: fresh when online, cached when not
});
