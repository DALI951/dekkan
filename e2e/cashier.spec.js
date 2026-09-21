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