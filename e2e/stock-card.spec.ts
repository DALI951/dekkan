/* DEKKAN E2E — the stock card (workbook STK-007 / RPT-006).
 * A shopkeeper taps "Card" on a product and sees its whole shelf story:
 * the opening count, every movement with a running balance, and the on-hand
 * number that must match the badge on the Stock page.
 */
'use strict';
const { test, expect } = require('@playwright/test');
const { open, gotoTab, closeReceipt } = require('./helpers');

test.afterEach(async ({ page }) => {
  expect(page.__errors).toEqual([]);
});

test('the stock card tells the shelf story: opening, sale, on-hand', async ({ page }) => {
  await open(page, '#/stock');
  await page.locator('#btnAddProduct').click();
  await page.locator('#pName').fill('Coca');
  await page.locator('#pBuy').fill('0.8');
  await page.locator('#pSell').fill('1.5');
  await page.locator('#pStock').fill('10');
  await page.locator('#btnSaveProduct').click();
  await expect(page.locator('#stockList')).toContainText('Coca');

  // sell 3 (one tap + two "+") so the shelf actually moves
  await gotoTab(page, '#/sell');
  await page.locator('[data-action="sell-add"]').first().click();
  await page.locator('[data-action="basket-plus"]').first().click();
  await page.locator('[data-action="basket-plus"]').first().click();
  await page.locator('#paidCash').fill('4.5');
  await page.locator('#btnSell').click();
  await expect(page.locator('#receipt')).not.toHaveClass(/hidden/);
  await closeReceipt(page);

  // the badge shows 7 on the shelf
  await gotoTab(page, '#/stock');
  await expect(page.locator('#stockList .s-stock')).toContainText('7');

  // tap "Card" -> the panel opens with opening 10, the -3 sale, and on-hand 7
  await page.locator('[data-action="stock-card"]').first().click();
  await expect(page.locator('#metricPanel')).not.toHaveClass(/hidden/);
  await expect(page.locator('#metricTitle')).toContainText('Coca');
  const body = page.locator('#metricBody');
  await expect(body).toContainText('10'); // opening count
  await expect(body).toContainText('-3'); // the sale movement
  await expect(body).toContainText('7');  // running balance / on-hand

  // the panel closes like every other panel
  await page.locator('#btnMetricClose').click();
  await expect(page.locator('#metricPanel')).toHaveClass(/hidden/);
});
