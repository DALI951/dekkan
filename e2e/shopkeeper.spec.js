/* DEKKAN E2E — the shopkeeper's day on a FRESH install.
 * No seeds: a brand-new browser gets a brand-new shop, exactly like a real
 * first launch. Everything below is driven through the visible UI.
 */
'use strict';
const { test, expect } = require('@playwright/test');
const { open, gotoTab, sellOne, closeReceipt, tillNow, toastText } = require('./helpers');

// every opened page must be exception-free
test.afterEach(async ({ page }) => {
  expect(page.__errors).toEqual([]);
});

test('first launch: Arabic RTL shell, empty till, ready till', async ({ page }) => {
  await open(page);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('#cashNow')).toHaveText(/0\.000/);
  await expect(page.locator('#page-sell h2')).toHaveText('البيع');
  await expect(page.locator('#sellGrid .empty')).toBeVisible();
});

test('add a product, sell one, get a receipt, see it in the report', async ({ page }) => {
  await open(page, '#/stock');
  await page.locator('#btnAddProduct').click();
  await page.locator('#pName').fill('Coca');
  await page.locator('#pBuy').fill('0.8');
  await page.locator('#pSell').fill('1.5');
  await page.locator('#pStock').fill('10');
  await page.locator('#btnSaveProduct').click();
  await expect(page.locator('#stockList')).toContainText('Coca');

  await gotoTab(page, '#/sell');
  await page.locator('[data-action="sell-add"]').first().click();
  await expect(page.locator('#basketTotal')).toHaveText(/1\.500/);
  await page.locator('#paidCash').fill('1.5');
  await page.locator('#btnSell').click();

  await expect(page.locator('#receipt')).not.toHaveClass(/hidden/);
  await expect(page.locator('#rLines')).toContainText('Coca');
  await closeReceipt(page);

  await gotoTab(page, '#/report');
  await expect(page.locator('#entriesList')).toContainText(/1\.5\d*/);
  await expect(page.locator('#cashNow')).toHaveText(/1\.500/);
});

test('credit sale without a customer name is refused', async ({ page }) => {
  await open(page, '#/stock');
  await page.locator('#btnAddProduct').click();
  await page.locator('#pName').fill('Coca');
  await page.locator('#pBuy').fill('0.8');
  await page.locator('#pSell').fill('1.5');
  await page.locator('#pStock').fill('10');
  await page.locator('#btnSaveProduct').click();
  await gotoTab(page, '#/sell');

  await page.locator('[data-action="sell-add"]').first().click();
  await page.locator('#btnSell').click(); // no money, no name = full credit

  await expect(page.locator('#toast')).not.toHaveClass(/hidden/);
  await expect(page.locator('#receipt')).toHaveClass(/hidden/);
  await expect(page.locator('#basketCount')).toHaveText('1'); // sale did not happen
});

test('closing the day keeps the cash and opens a fresh till', async ({ page }) => {
  // do setup + a real sale via UI
  await open(page, '#/stock');
  await page.locator('#btnAddProduct').click();
  await page.locator('#pName').fill('ست سمين');
  await page.locator('#pBuy').fill('1');
  await page.locator('#pSell').fill('2.5');
  await page.locator('#pStock').fill('5');
  await page.locator('#btnSaveProduct').click();
  await gotoTab(page, '#/sell');
  await sellOne(page, 2.5, undefined);
  await expect(page.locator('#receipt')).not.toHaveClass(/hidden/);
  await closeReceipt(page);
  await expect(page.locator('#cashNow')).toHaveText(/2\.500/);

  await gotoTab(page, '#/settings');
  await page.locator('#btnCloseDay').click();

  // end-cash became the next day's start-cash, till does not vanish
  await expect(page.locator('#cashNow')).toHaveText(/2\.500/);
  await gotoTab(page, '#/report');
  await expect(page.locator('#entriesList .empty')).toBeVisible(); // fresh day, no moves
});