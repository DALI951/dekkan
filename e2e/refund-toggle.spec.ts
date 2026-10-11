/* DEKKAN E2E — Settings > "Refunds allowed" is a real switch: turning it off
 * takes the refund buttons OFF THE SCREEN (sell page + ticket).
 *
 * Reported by Dali 2026-10-11: "when i check off returning i still can click it
 * like it does nothing but the button is still there". The core refused the
 * refund (a raw English message) while the button kept looking alive — a dead
 * button is worse than no button. English UI here (the born default), so the
 * assertions read like the report.
 */
'use strict';
const { test, expect } = require('@playwright/test');
const { open, gotoTab, sellOne, closeReceipt } = require('./helpers');

// every opened page must be exception-free
test.afterEach(async ({ page }) => {
  expect(page.__errors).toEqual([]);
});

// the visible half of a `.switch` row: the input is an invisible 0x0 box, the
// shopkeeper taps the track — and the label forwards it to the checkbox.
const switchTrack = (page, id) => page.locator('label.switch:has(#' + id + ') span');

test('refunds OFF: the sell button and the ticket button both leave the screen', async ({ page }) => {
  await open(page, '#/stock');
  await page.locator('#btnAddProduct').click();
  await page.locator('#pName').fill('Coca');
  await page.locator('#pBuy').fill('0.8');
  await page.locator('#pSell').fill('1.5');
  await page.locator('#pStock').fill('10');
  await page.locator('#btnSaveProduct').click();

  // refunds are ON by default — the button is on screen
  await gotoTab(page, '#/sell');
  await expect(page.locator('#btnRefundMode')).toBeVisible();

  // ...the shopkeeper turns them off
  await gotoTab(page, '#/settings');
  await switchTrack(page, 'cfgRefund').click();
  await expect(page.locator('#cfgRefund')).not.toBeChecked();

  // the button is GONE (not a dead button), the panel can never open
  await gotoTab(page, '#/sell');
  await expect(page.locator('#btnRefundMode')).toBeHidden();
  await expect(page.locator('#refundPanel')).toBeHidden();

  // selling still works...
  await sellOne(page, 1.5, undefined);
  await expect(page.locator('#receipt')).not.toHaveClass(/hidden/);
  await expect(page.locator('#cashNow')).toHaveText(/1\.500/);
  // ...and the ticket carries no refund button either
  await expect(page.locator('#btnReceiptRefund')).toBeHidden();
  await closeReceipt(page);

  // flipping it back ON brings the refund feature back
  await gotoTab(page, '#/settings');
  await switchTrack(page, 'cfgRefund').click();
  await expect(page.locator('#cfgRefund')).toBeChecked();
  await gotoTab(page, '#/sell');
  await expect(page.locator('#btnRefundMode')).toBeVisible();
});
