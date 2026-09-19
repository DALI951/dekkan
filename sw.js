/* DEKKAN service worker — app shell precache, cache-first, offline-capable.
 * Bump SW_VERSION to force a refresh of the shell after a deploy. */
'use strict';

const SW_VERSION = 'v9';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/themes.js',
  './js/app.js',
  './js/lang.js',
  './core/dekkan-core.js',
  './icon/icon.svg',
  './icon/icon-192.png',
  './icon/icon-512.png'
];
const CACHE = 'dekkan-' + SW_VERSION;

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return c.addAll(SHELL);
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      return hit || fetch(e.request).then(function (res) {
        // cache successful same-origin responses as you go
        if (res.ok && e.request.url.startsWith(self.location.origin)) {
          const copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      });
    })
  );
});