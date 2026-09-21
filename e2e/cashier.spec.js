/* DEKKAN E2E — per-cashier attribution via the real UI:
 *  - type a cashier name, sell, the report shows who rang what
 *  - the name is remembered for the next time the till opens
 *  - but typing over the default keeps YOUR name
 */
'use strict';
const { test, expect } = require('@playwright/test');
const { open, gotoTab, sellOne, closeReceipt } = require('./helpers');

test.afterEach(async ({ page }) => {
  expect(page.__errors).toEqual([]);
});

async function addSoda(page, stock) {
  await page.locator('#btnAddProduct').click();
  await page.locator('#pName').fill('Soda');
  await page.locator('#pBuy').fill('0.5');
  await page.locator('#pSell').fill('1.5');
  await page.locator('#pStock').fill(String(stock));
  await page.locator('#btnSaveProduct').click();
  await expect(page.locator('#stockList')).toContainText('Soda');
}

test('cashier name tags the sale; the report splits per cashier', async ({ page }) => {
  await open(page, '#/stock');
  await addSoda(page, 10);

  // Samir rings one
  await gotoTab(page, '#/sell');
  await page.locator('#cashierName').fill('Samir');
  await sellOne(page, 3); // 2 colas, paid 3
  await closeReceipt(page);

  // Amine rings another
  await page.locator('#cashierName').fill('Amine');
  await sellOne(page, 2);
  await closeReceipt(page);

  // the report shows both, with their totals
  await gotoTab(page, '#/report');
  await expect(page.locator('#byCashier')).toContainText('Samir');
  await expect(page.locator('#byCashier')).toContainText('Amine');
});

test('the last cashier is offered as the default on the sell page', async ({ page }) => {
  await open(page, '#/stock');
  await addSoda(page, 10);
  await gotoTab(page, '#/sell');
  await page.locator('#cashierName').fill('Amine');
  await sellOne(page, 3);
  await closeReceipt(page);

  // reload the page: the till remembers the cashier
  await page.reload();
  await expect(page.locator('#cashierName')).toHaveValue('Amine');

  // and typing a fresh name takes over for the next sale
  await page.locator('#cashierName').fill('Samir');
  await sellOne(page, 2);
  await closeReceipt(page);
  await expect(page.locator('#cashierName')).toHaveValue('Samir');
});

test('sales without a cashier still work and show the empty hint', async ({ page }) => {
  await open(page, '#/stock');
  await addSoda(page, 10);
  await gotoTab(page, '#/sell');
  await sellOne(page, 3);
  await closeReceipt(page);
  await gotoTab(page, '#/report');
  await expect(page.locator('#byCashier')).toContainText('لا يوجد بائعون بعد');
});

test('search filters the tiles by name and clears back to all', async ({ page }) => {
  await open(page, '#/stock');
  await page.locator('#btnAddProduct').click();
  await page.locator('#pName').fill('Cola');
  await page.locator('#pBuy').fill('0.5');
  await page.locator('#pSell').fill('1.5');
  await page.locator('#pStock').fill('10');
  await page.locator('#btnSaveProduct').click();
  await expect(page.locator('#stockList')).toContainText('Cola');

  await page.locator('#btnAddProduct').click();
  await page.locator('#pName').fill('Bread');
  await page.locator('#pBuy').fill('0.2');
  await page.locator('#pSell').fill('0.5');
  await page.locator('#pStock').fill('10');
  await page.locator('#btnSaveProduct').click();
  await expect(page.locator('#stockList')).toContainText('Bread');

  await gotoTab(page, '#/sell');
  await expect(page.locator('#sellGrid .sell-tile')).toHaveCount(2);

  // typing narrows the tiles
  await page.locator('#sellSearch').fill('Cola');
  await expect(page.locator('#sellGrid .sell-tile')).toHaveCount(1);
  await expect(page.locator('#sellGrid')).toContainText('Cola');
  await expect(page.locator('#sellGrid')).not.toContainText('Bread');

  // clearing restores the full grid
  await page.locator('#sellSearch').fill('');
  await expect(page.locator('#sellGrid .sell-tile')).toHaveCount(2);
});

test('search with no match shows the empty state, not a crash', async ({ page }) => {
  await open(page, '#/stock');
  await addSoda(page, 10);
  await gotoTab(page, '#/sell');
  await page.locator('#sellSearch').fill('zzz-not-a-product');
  await expect(page.locator('#sellGrid .sell-tile')).toHaveCount(0);
  await expect(page.locator('#sellGrid .empty')).toBeVisible();
});