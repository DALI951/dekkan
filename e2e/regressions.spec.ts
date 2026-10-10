/* DEKKAN E2E — regressions that real-browser bugs produced before.
 * Each test replays the exact situation Dali hit, with the browser's real
 * refresh cycle. A stored preference is seeded the way a returning user's
 * browser would already hold it (before ANY dekkan script loads).
 */
'use strict';
const { test, expect } = require('@playwright/test');
const { open, seedPrefs } = require('./helpers');

test.afterEach(async ({ page }) => {
  expect(page.__errors).toEqual([]);
});

test('v0.8.3 regression: English saved + hard refresh keeps LTR English layout', async ({ page, context }) => {
  seedPrefs('dekkan.lang', 'en', context);
  await open(page, '#/sell');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('#page-sell h2')).toHaveText('Sell');

  await page.reload(); // the hard refresh that used to repaint an RTL shell
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('#page-sell h2')).toHaveText('Sell');
});

test('birth direction: a fresh visitor gets Arabic RTL (never English LTR)', async ({ page }) => {
  await open(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('#page-sell h2')).toHaveText('البيع');
});

test('the chosen theme applies from the first paint and survives a reload', async ({ page, context }) => {
  seedPrefs('dekkan.theme', 'mint', context); // internal id: mint = Midnight Mint
  await open(page, '#/settings');

  const bg = () =>
    page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
  expect(await bg()).toBe('#06140f'); // Midnight Mint background, no flash of Gold Souk

  await page.reload();
  expect(await bg()).toBe('#06140f');
  await expect(page.locator('#themeGrid')).toContainText('الزمرد'); // …and it's marked in the UI
});

test('default theme is Gold Souk on a truly fresh profile', async ({ page }) => {
  await open(page);
  const bg = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
  expect(bg).toBe('#0e0c0a'); // Gold Souk is the default look
});