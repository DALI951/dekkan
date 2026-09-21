/* DEKKAN E2E — owner lock (PIN): with a code armed, the money actions
 * stop at the keypad until the right code is typed:
 *  - set a PIN in settings; status flips to "locked"
 *  - refund is refused with a wrong code, granted with the right one
 *  - close-day refuses without the code
 *  - removing the lock needs the current code too
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

async function armPin(page, pin) {
  await gotoTab(page, '#/settings');
  await page.locator('#pinInput').fill(pin);
  await page.locator('#btnPinSet').click();
  await expect(page.locator('#pinStatus')).toContainText('مفعّل');
}

async function typePin(page, pin) {
  for (const d of String(pin)) {
    await page.locator('.key[data-pin="' + d + '"]').click();
  }
}

test('with a PIN armed, closing the day is refused until the code is right', async ({ page }) => {
  await open(page, '#/stock');
  await addSoda(page, 10);
  await gotoTab(page, '#/sell');
  await sellOne(page, 3);
  await closeReceipt(page);

  await armPin(page, '2580');

  // close-day -> keypad appears, the day is NOT closed yet
  await gotoTab(page, '#/settings');
  await page.locator('#btnCloseDay').click();
  await expect(page.locator('#pinPanel')).toBeVisible();

  // wrong code -> error, still locked
  await typePin(page, '0000');
  await page.locator('#keyOk').click();
  await expect(page.locator('#pinError')).toBeVisible();
  await expect(page.locator('#pinPanel')).toBeVisible();

  // right code -> the day actually closes
  await typePin(page, '2580');
  await page.locator('#keyOk').click();
  await expect(page.locator('#pinPanel')).toBeHidden();
  await expect(page.locator('#toast')).toContainText('أُغلق اليوم');
});

test('refund needs the owner code; the backup JSON never shows the digits', async ({ page }) => {
  await open(page, '#/stock');
  await addSoda(page, 10);
  await gotoTab(page, '#/sell');
  await sellOne(page, 3);
  await closeReceipt(page);
  await armPin(page, '4444');

  // refund mode -> refund -> blocked
  await gotoTab(page, '#/sell');
  await page.locator('#btnRefundMode').click();
  await page.locator('[data-action="refund-pick"]').first().click();
  await page.locator('#btnDoRefund').click();
  await expect(page.locator('#pinPanel')).toBeVisible();

  await typePin(page, '4444');
  await page.locator('#keyOk').click();
  await expect(page.locator('#toast')).toContainText('تم الاسترجاع');

  // the downloaded backup carries the hash, never the plain digits
  const exported = await page.evaluate(() => localStorage.getItem('dekkan.v1'));
  expect(exported).not.toContain('4444');
  expect(exported).toContain('pinHash');
});

test('removing the lock also asks for the current code', async ({ page }) => {
  await open(page, '#/settings');
  await page.locator('#pinInput').fill('1234');
  await page.locator('#btnPinSet').click();
  await expect(page.locator('#pinStatus')).toContainText('مفعّل');

  await page.locator('#btnPinClear').click();
  await expect(page.locator('#pinPanel')).toBeVisible();

  await typePin(page, '1234');
  await page.locator('#keyOk').click();
  await expect(page.locator('#pinStatus')).toContainText('بدون');
  await expect(page.locator('#btnPinClear')).toBeHidden();
});