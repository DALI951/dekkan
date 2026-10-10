/* DEKKAN E2E — the login wall (works always).
 * A brand-new browser meets the wall; "local only" opens the till and is
 * remembered, so the wall never returns on this device.
 */
'use strict';
const { test, expect } = require('@playwright/test');
const { open } = require('./helpers');

test.describe('login wall', () => {
  test('a fresh browser meets the wall; the local option opens the till', async ({ page }) => {
    await open(page, '', { wall: true });
    await expect(page.locator('#gate')).toBeVisible();
    await expect(page.locator('#btnGoogle')).toBeVisible();
    await expect(page.locator('#gateSkip')).toBeVisible();

    await page.locator('#gateSkip').click();
    await expect(page.locator('#gate')).toBeHidden();
    await expect(page.locator('#btnSell')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('dekkan.mode'))).toBe('local');
    expect(page.__errors).toEqual([]);
  });

  test('a device already in local mode never sees the wall', async ({ page }) => {
    await open(page); // seeds local mode
    await expect(page.locator('#gate')).toBeHidden();
    await expect(page.locator('#btnSell')).toBeVisible();
  });
});
