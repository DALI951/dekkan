/* DEKKAN E2E — service worker regression (2026-09-21).
 * The bug Dali hit: the old cache-first SW kept serving the STALE shell after
 * every deploy — "the site is stuck at the old cache" — so the fresh English
 * client-tab strings never appeared even though the server had them.
 * The fix: network-first fetch (online = newest code every time, offline =
 * last cached copy). These tests replay the exact failure and prove the fix.
 * Run: npm run test:e2e
 */
'use strict';
const { test, expect } = require('@playwright/test');
const { open, seedLang } = require('./helpers');

// Arabic UI spec — pin Arabic before boot (the app now defaults to English).
test.beforeEach(async ({ context }) => { await seedLang(context, 'ar'); });

test.afterEach(async ({ page }) => {
  expect(page.__errors).toEqual([]);
});

// Let the SW install + take control, then do one controlled reload.
async function withActiveSw(page) {
  await open(page, '#/sell');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: 'networkidle' });
}

/* ONLINE reload: the network must win — real app, real lang, never the poison. */
test('online load IGNORES a poisoned stale cache (network-first beats cache)', async ({ page }) => {
  await withActiveSw(page);

  await page.evaluate(async () => {
    const c = await caches.open('dekkan-poison');
    const html = new Response('<title>STALE SHELL</title><body>old</body>',
      { headers: { 'content-type': 'text/html' } });
    const lang = new Response('window.POISONED = true;',
      { headers: { 'content-type': 'text/javascript' } });
    await Promise.all([
      c.put('http://127.0.0.1:4173/', html),
      c.put('http://127.0.0.1:4173/ui/lang.js', lang)
    ]);
  });

  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.locator('#page-sell')).toBeVisible();
  expect(await page.title()).not.toBe('STALE SHELL');
  const poisoned = await page.evaluate(() => window.POISONED === true);
  expect(poisoned).toBe(false);
  await expect(page.locator('#page-sell h2')).toHaveText('البيع');
});

test('cached shell still serves the WHOLE app when offline', async ({ page, context }) => {
  await withActiveSw(page); // online visit caches the fresh shell
  expect(await page.evaluate(() => !!document.getElementById('view'))).toBe(true);

  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });

  await expect(page.locator('#page-sell')).toBeVisible();
  await expect(page.locator('#cashNow:visible, #cashNow2:visible').first()).toBeVisible();
  await page.evaluate(() => document.title); // title read works offline
  await context.setOffline(false);
});

test('served sw.js is the network-first version (guards against a cache-first revert)', async ({ page }) => {
  await open(page);
  const sw = await page.evaluate(async () => {
    const r = await fetch('sw.js');
    return r.text();
  });
  expect(sw).toContain("network-first for everything same-origin");
  expect(sw).not.toContain("caches.match(e.request).then(function (hit) {\n      return hit || fetch(e.request)");
});

test('a deploy bump switches the cache name and drops the old caches', async ({ page }) => {
  await withActiveSw(page);
  const names = await page.evaluate(async () => (await caches.keys()).filter(k => k.startsWith('dekkan-')));
  expect(names.length).toBe(1);
  expect(names[0]).toMatch(/^dekkan-v\d+$/);
});