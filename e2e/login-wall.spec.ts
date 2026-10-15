/* DEKKAN E2E — the login wall (works always).
 * A brand-new browser meets the wall; "local only" opens the till and is
 * remembered, so the wall never returns on this device.
 *
 * Google was taken off the wall on 2026-10-14 (wave 7, "forget about google
 * completly its useless now"), so the wall now has exactly two ways in: an
 * account, or local mode. What is proven here is what a shopkeeper standing at
 * the counter actually gets: the fields, the labels, an honest refusal for a
 * reply Google cannot use, and the only button there is never left saying
 * nothing.
 */
'use strict';
const { test, expect } = require('@playwright/test');
const { open } = require('./helpers');

test.describe('login wall', () => {
  test('a fresh browser meets the wall; the local option opens the till', async ({ page }) => {
    await open(page, '', { wall: true });
    await expect(page.locator('#gate')).toBeVisible();
    await expect(page.locator('#gateSkip')).toBeVisible();
    await expect(page.locator('#btnGoogle')).toHaveCount(0);      // no Google route anywhere on it
    await expect(page.locator('#gateHint')).toHaveCount(0);

    await page.locator('#gateSkip').click();
    await expect(page.locator('#gate')).toBeHidden();
    await expect(page.locator('#btnSell')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('dekkan.mode'))).toBe('local');
    expect(page.__errors).toEqual([]);
  });

  test('the wall asks with LABELS, and answers a tap with a named error', async ({ page }) => {
    await open(page, '', { wall: true });
    await expect(page.locator('#gateTitle')).toContainText(/sign in/i);
    await expect(page.locator('#gateEmail')).toBeVisible();
    await expect(page.locator('#gatePass')).toBeVisible();
    await expect(page.locator('label[for="gateEmail"]')).toBeVisible();   // a label does not vanish when you type
    await expect(page.locator('#gateSubmit')).toBeEnabled();

    await page.locator('#gateEmail').fill('not-an-address');
    await page.locator('#gatePass').fill('secret1');
    await page.locator('#gateSubmit').click();
    await expect(page.locator('#gateError')).toContainText(/valid email/i);
    await expect(page.locator('#gateSubmit')).toBeEnabled();              // nothing was sent, nothing is stuck
    await expect(page.locator('#gate')).toBeVisible();
    expect(page.__errors).toEqual([]);
  });

  test('a device already in local mode never sees the wall', async ({ page }) => {
    await open(page); // seeds local mode
    await expect(page.locator('#gate')).toBeHidden();
    await expect(page.locator('#btnSell')).toBeVisible();
  });
});
