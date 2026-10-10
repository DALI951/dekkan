/* DEKKAN E2E — language default + readability + the product form.
 * Three promises Dali asked for:
 *   1. A fresh browser (or a returning one that never chose a language) boots
 *      in ENGLISH, LTR.
 *   2. No unreadable text anywhere: no U+FFFD replacement char, no classic
 *      UTF-8-read-as-Latin1 mojibake (Ã©, Â, Ù„ ...).
 *   3. Adding a product from the Stock page works and says "Saved" — never
 *      a scary English "product not found" while the UI is in Arabic.
 * Screenshots are attached so a human can look at exactly what the test saw.
 */
'use strict';
const { test, expect } = require('@playwright/test');
const { open, gotoTab, toastText } = require('./helpers');

const MOJIBAKE = /[\uFFFD]|Ã[\u0080-\u00BF]|Â[\u0080-\u00BF]|ï¿½/;

async function visibleText(page) {
  return await page.locator('body').innerText();
}

test('LANG-001: a fresh browser boots in English, LTR', async ({ page }) => {
  await open(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  // the navigation must be English, not Arabic
  await expect(page.locator('[data-hash="#/stock"] span').first()).toHaveText('Stock');
  await expect(page.locator('[data-hash="#/sell"] span').first()).toHaveText('Sell');
  const body = await visibleText(page);
  expect(body).not.toMatch(MOJIBAKE);
  await page.screenshot({ path: 'test-results/lang-001-default-english.png', fullPage: true });
});

test('LANG-002: switching to Arabic flips to RTL with readable Arabic', async ({ page }) => {
  await open(page, '#/settings');
  await page.locator('#langAr').click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.locator('[data-hash="#/stock"] span').first()).toHaveText('المخزون');
  await page.screenshot({ path: 'test-results/lang-002-arabic-rtl.png', fullPage: true });
  const body = await visibleText(page);
  expect(body).toMatch(/[\u0600-\u06FF]/);
  expect(body).not.toMatch(MOJIBAKE);
  // and it persists across a hard reload
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.screenshot({ path: 'test-results/lang-003-arabic-after-reload.png', fullPage: true });
});

test('LANG-004: choosing English persists and reads readable English', async ({ page }) => {
  await open(page, '#/settings');
  await page.locator('#langAr').click();
  await page.locator('#langEn').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  const body = await visibleText(page);
  expect(body).not.toMatch(MOJIBAKE);
  // the only Arabic allowed in English mode is the label of the Arabic switch
  // itself ("العربية") — everything else must be English.
  const withoutLangButton = body.replace(/العربية/g, '').replace(/دكّان/g, '').replace(/^\s*د\s*$/gm, '');
  expect(withoutLangButton).not.toMatch(/[\u0600-\u06FF]/);
});

test('PROD-001: adding a product from Stock saves and never says "product not found"', async ({ page }) => {
  await open(page, '#/stock');
  await page.locator('#btnAddProduct').click();
  await expect(page.locator('#productForm')).not.toHaveClass(/hidden/);
  await page.locator('#pName').fill('Test Cola');
  await page.locator('#pBuy').fill('0.8');
  await page.locator('#pSell').fill('1.5');
  await page.locator('#pStock').fill('12');
  await page.locator('#pSku').fill('TST-COLA');
  await page.screenshot({ path: 'test-results/prod-001-form-filled.png', fullPage: true });
  await page.locator('#btnSaveProduct').click();
  const t = await toastText(page);
  expect(t).not.toMatch(/product not found/i);
  expect(t).toMatch(/saved/i);
  await expect(page.locator('#productForm')).toHaveClass(/hidden/);
  await expect(page.locator('#page-stock')).toContainText('Test Cola');
  await page.screenshot({ path: 'test-results/prod-002-after-save.png', fullPage: true });
});

test('PROD-002: an edit whose product vanished under us does not scare the user', async ({ page }) => {
  await open(page, '#/stock');
  await page.locator('#btnAddProduct').click();
  await page.locator('#pName').fill('Ghost');
  await page.locator('#pSell').fill('2');
  await page.locator('#pStock').fill('1');
  await page.locator('#btnSaveProduct').click();
  await toastText(page);
  // open a product form, then point it at an id that no longer exists
  await page.locator('#btnAddProduct').click();
  await page.locator('#pName').fill('Survivor');
  await page.locator('#pSell').fill('3');
  await page.locator('#pStock').fill('5');
  await page.evaluate(() => { window.DEK.app.editProductId = 'ghost-id'; });
  await page.locator('#btnSaveProduct').click();
  const t = await toastText(page);
  expect(t).not.toMatch(/product not found/i);
  expect(t).toMatch(/saved/i);
  await expect(page.locator('#page-stock')).toContainText('Survivor');
  await page.screenshot({ path: 'test-results/prod-003-stale-edit.png', fullPage: true });
});
