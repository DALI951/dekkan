/* DEKKAN service worker — app shell precache, network-first (online = always
 * newest code, offline = last cached shell), offline-capable.
 * Bump SW_VERSION to force a refresh of the shell after a deploy. */
'use strict';

const SW_VERSION = 'v33';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/themes.js',
  './js/fmt.js',
  './js/pages.js',
  './js/actions.js',
  './js/app.js',
  './js/lang.js',
  './core/dekkan-core.js',
  './core/core.js',
  './core/products.js',
  './core/debts.js',
  './core/sales.js',
  './core/refunds.js',
  './core/employees.js',
  './core/cashbox.js',
  './core/report.js',
  './core/shop.js',
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
  // network-first for everything same-origin: online => always the newest code
  // (no more getting stuck on a stale cached shell), offline => last cached copy.
  e.respondWith(
    fetch(e.request).then(function (res) {
      if (res.ok && e.request.url.startsWith(self.location.origin)) {
        const copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(e.request).then(function (hit) {
        return hit || caches.match('./');
      });
    })
  );
});
