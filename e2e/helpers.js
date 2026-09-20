/* DEKKAN E2E shared helpers — survival kit for the spec files. */
'use strict';

const { expect } = require('@playwright/test');

// Open the app like a real user: fresh context (clean browser, clean storage).
// Captures uncaught page errors — an exception on the page is ALWAYS a bug.
async function open(page, hash) {
  page.__errors = [];
  page.on('pageerror', e => page.__errors.push(String(e)));
  await page.goto('/' + (hash || ''));
  await page.waitForLoadState('domcontentloaded');
  return page;
}

// Navigate like a user: tap the nav tab that is actually ON SCREEN
// (sidebar bookmarks on desktop, top tabs on a phone).
async function gotoTab(page, hash) {
  await page.locator('nav button[data-hash="' + hash + '"]:visible').first().click();
}

// Persisted-preferences seeding: exactly what a returning shopkeeper's
// browser holds. Sets localStorage BEFORE any dekkan script runs (same
// moment real saved prefs exist at boot).
function seedPrefs(key, value, context) {
  return context.addInitScript(
    ([k, v]) => { try { localStorage.setItem(k, v); } catch (e) {} },
    [key, value]
  );
}

// The till as a NUMBER, whatever layout is on screen.
async function tillNow(page) {
  const txt = await page.locator('#cashNow').textContent();
  const n = txt.replace(/\D/g, '');
  return parseFloat(n) / 1000; // '1.500' -> 1.5
}

// Toast helper: waits until a toast appears and returns its text.
async function toastText(page) {
  const t = page.locator('#toast');
  await expect(t).not.toHaveClass(/hidden/);
  return (await t.textContent()).trim();
}

// Sell ONE product straight from the till (UI-driven, like a human).
async function sellOne(page, paid, name) {
  await page.locator('[data-action="sell-add"]').first().click();
  if (name !== undefined) await page.locator('#creditName').fill(name);
  if (paid !== undefined) await page.locator('#paidCash').fill(String(paid));
  await page.locator('#btnSell').click();
}

// Close the receipt dialog after a sale.
async function closeReceipt(page) {
  await page.locator('#btnReceiptClose2').click();
  await expect(page.locator('#receipt')).toHaveClass(/hidden/);
}

module.exports = { open, gotoTab, seedPrefs, tillNow, toastText, sellOne, closeReceipt, expect };