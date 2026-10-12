/* DEKKAN E2E — regressions that real-browser bugs produced before.
 * Each test replays the exact situation Dali hit, with the browser's real
 * refresh cycle. A stored preference is seeded the way a returning user's
 * browser would already hold it (before ANY dekkan script loads).
 */
'use strict';
const { test, expect } = require('@playwright/test');
const { open, seedPrefs } = require('./helpers');

/* a test that skipped itself (wrong viewport) never opened the app at all */
test.afterEach(async ({ page }) => {
  expect(page.__errors || []).toEqual([]);
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

test('birth direction: a fresh visitor gets English LTR (the new default)', async ({ page }) => {
  await open(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('#page-sell h2')).toHaveText('Sell');
});

test('the chosen theme applies from the first paint and survives a reload', async ({ page, context }) => {
  seedPrefs('dekkan.theme', 'mint', context); // internal id: mint = Midnight Mint
  await open(page, '#/settings');

  const bg = () =>
    page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
  expect(await bg()).toBe('#06140f'); // Midnight Mint background, no flash of Gold Souk

  await page.reload();
  expect(await bg()).toBe('#06140f');
  await expect(page.locator('#themeGrid')).toContainText('Midnight Mint'); // …and it's marked in the UI

  const saved = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('dekkan.v1') || '{}').custom.theme; } catch (e) { return null; }
  });
  expect(saved.id).toBe('mint');
});

test('a stale device cache cannot overrule what the SHOP declared', async ({ page }) => {
  await open(page, '#/settings');
  await page.locator('#btnThemeEdit').click();
  await page.locator('#themeBase [data-base="royal"]').click();
  await page.locator('#btnThemeSave').click();
  await page.evaluate(() => localStorage.setItem('dekkan.theme', 'mint'));

  await page.reload();
  const bg = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
  expect(bg).toBe('#0a0e1c');                                            // the shop's Indigo Night
  await expect(page.locator('#themeGrid .theme-sw.active')).toContainText('Indigo Night');
});

test('default theme is Gold Souk on a truly fresh profile', async ({ page }) => {
  await open(page);
  const bg = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
  expect(bg).toBe('#0e0c0a'); // Gold Souk is the default look
});

/* ============================================================ LAYOUT REGRESSIONS
 * Two layout bugs that no functional test could see, both found by measuring the
 * real DOM (2026-10-11 UI/UX sweep):
 *   1. the mobile bar was never actually hidden on desktop — a later unscoped
 *      `.topbar{display:flex}` beat the ≥900px hide, so the phone bar rendered on
 *      top of the sidebar brand and pushed every page down;
 *   2. the phone bar and the tab strip were two independent stickies at top:0, so
 *      the moment the page scrolled the tab strip rode up OVER the bar and hid the
 *      shop name behind a translucent strip.
 */
test('desktop shows the sidebar and NEVER the phone bar / tab strip', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'PC', 'desktop-only assertion');
  await open(page, '#/sell');
  const shown = (sel) => page.locator(sel).evaluate((el) => getComputedStyle(el).display !== 'none');
  expect(await shown('.sidebar'), 'the sidebar rail is the desktop nav').toBe(true);
  expect(await shown('.topbar'), 'the mobile bar must not paint on desktop').toBe(false);
  expect(await shown('.topnav'), 'the mobile tab strip must not paint on desktop').toBe(false);
  const top = await page.locator('#view .page.show').evaluate((el) => el.getBoundingClientRect().top);
  expect(top).toBeLessThan(60);
});

test('phone: the tab strip docks UNDER the bar when the page is scrolled', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'Phone', 'phone-only assertion');
  await open(page, '#/stock');
  await page.evaluate(() => {
    const d = document.createElement('div');
    d.style.cssText = 'height:2000px';
    document.body.appendChild(d);
  });
  await page.evaluate(() => window.scrollTo(0, 300));
  await page.waitForTimeout(200);

  const box = await page.evaluate(() => {
    const b = document.querySelector('.topbar').getBoundingClientRect();
    const n = document.querySelector('.topnav').getBoundingClientRect();
    return { y: Math.round(window.scrollY), barTop: Math.round(b.top), barBottom: Math.round(b.bottom), navTop: Math.round(n.top) };
  });
  expect(box.y, 'the page must really have scrolled, or this test proves nothing').toBeGreaterThan(100);
  expect(box.barTop, 'the bar stays stuck to the top').toBe(0);
  expect(box.navTop, 'the tab strip must sit BELOW the bar, not over it').toBeGreaterThanOrEqual(box.barBottom - 1);
});

test('phone: a stock row fits inside its card (name readable, no button hanging off)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'Phone', 'phone-only assertion');
  await open(page, '#/stock');
  await page.locator('#btnAddProduct').click();
  await page.locator('#pName').fill('Couscous extra long name');
  await page.locator('#pBuy').fill('3');
  await page.locator('#pSell').fill('4.5');
  await page.locator('#pStock').fill('8');
  await page.locator('#btnSaveProduct').click();
  await expect(page.locator('#stockList')).toContainText('Couscous');

  const bad = await page.evaluate(() => {
    const out = [];
    /* the product name is the reason the row exists — it must stay readable */
    document.querySelectorAll('#stockList .stock-card').forEach((card) => {
      const c = card.getBoundingClientRect();
      if (card.scrollWidth > card.clientWidth + 1) out.push('row overflows its card');
      card.querySelectorAll('button').forEach((b) => {
        const r = b.getBoundingClientRect();
        if (r.left < c.left - 0.5 || r.right > c.right + 0.5) out.push('button ' + b.textContent + ' hangs outside the card');
      });
      const name = card.querySelector('.s-name');
      if (name && name.getBoundingClientRect().width < 60) out.push('name crushed to ' + Math.round(name.getBoundingClientRect().width) + 'px');
    });
    return out;
  });
  expect(bad).toEqual([]);
});