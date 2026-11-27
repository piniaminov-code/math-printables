/* Service worker: offline copy of the app shell only.
 * - Caches just the files the site ships (index.html, manifest, icons). Nothing else is ever stored:
 *   the app has no API, accounts or forms, and progress/settings stay in localStorage, never in Cache Storage.
 * - HTML (navigations): network first, so an online visit always gets the newest version; the cached
 *   copy is used only when offline.
 * - Icons/manifest: cache first. They are versioned by CACHE: bump VERSION when they change.
 * - New versions take over immediately (skipWaiting + clients.claim) and old caches are deleted.
 */
const VERSION = 'v1';
const CACHE = `math-printables-shell-${VERSION}`;
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png'];
const SHELL_URLS = new Set(SHELL.map((p) => new URL(p, self.registration.scope).href));

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('math-printables-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('./index.html', copy)); }
          return res;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./'))),
    );
    return;
  }
  url.search = '';
  if (SHELL_URLS.has(url.href)) event.respondWith(caches.match(req, { ignoreSearch: true }).then((r) => r || fetch(req)));
  // everything else: straight to the network, never cached
});
