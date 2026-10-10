// @ts-nocheck
// JS -> TS migration (first pass): this file is the dynamic DOM / service-worker /
// vm-harness layer (loose globals + event targets). Types get tightened incrementally.
/* DEKKAN service worker — app shell precache, network-first (online = always
 * newest code, offline = last cached shell), offline-capable.
 * Bump SW_VERSION to force a refresh of the shell after a deploy. */
'use strict';

const SW_VERSION = 'v42';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './ui/themes.js',
  './ui/fmt.js',
  './ui/pages.js',
  './ui/actions.js',
  './ui/config.js',
  './ui/auth.js',
  './ui/app.js',
  './ui/lang.js',
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
  './core/pin.js',
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
        if (hit) return hit;
        // Never hand our HTML shell to a CROSS-ORIGIN request: the Firebase SDK
        // loads an auth iframe from *.firebaseapp.com, and returning index.html
        // there makes the browser parse HTML as JS ("Unexpected token '<'").
        // A network error is the honest answer. Same-origin navigations still
        // fall back to the cached shell so the app opens offline.
        var sameOrigin = e.request.url.indexOf(self.location.origin) === 0;
        if (sameOrigin && e.request.mode === 'navigate') return caches.match('./');
        return Response.error();
      });
    })
  );
});
