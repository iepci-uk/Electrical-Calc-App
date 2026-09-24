// Service worker: lets the app work offline once installed.
// IMPORTANT: change CACHE_VERSION every time you release, so phones get the new files.
const CACHE_VERSION = 'iepci-calc-v2';
const FILES = [
  './', './index.html', './css/style.css', './manifest.webmanifest',
  './js/app.js', './js/config.js', './js/store.js',
  './js/core/constants.js', './js/core/iecQuick.js', './js/core/impedance.js', './js/core/tools.js',
  './js/ui/dom.js', './js/ui/quickView.js', './js/ui/networkView.js', './js/ui/toolsView.js',
  './js/ui/projectsView.js', './js/ui/report.js',
  './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_VERSION).then((c) => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))));
  self.clients.claim();
});

// Network first, fall back to cache when offline.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => { const copy = res.clone(); caches.open(CACHE_VERSION).then((c) => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request))
  );
});
