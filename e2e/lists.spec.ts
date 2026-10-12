/* DEKKAN E2E — wave 4: the shop's own LISTS (units, suppliers, refund reasons).
 *
 * Written BEFORE the code was finished (RED-first). What it pins down:
 *   * the Settings card offers the three lists the shop owns, one row each
 *   * what the shop types becomes a REAL choice in the forms that use it
 *     (the unit picker on the product form, the supplier + reason hints)
 *   * the unit travels with the product and is PRINTED on the ticket ("×1 kg")
 *   * a list the core refuses is refused BY NAME, under that row, and nothing
 *     is written (a duplicate; removing the last unit)
 *   * a list is DATA: it survives a reload, and it is not a screen-only state
 */
'use strict';
const { test, expect } = require('@playwright/test');
const { open, gotoTab, seedPrefs } = require('./helpers');

test.beforeEach(async ({ context }) => {
  await seedPrefs('dekkan.lang', 'ar', context);
});

test.afterEach(async ({ page }) => {
  expect(page.__errors || []).toEqual([]);
});

// --- shortcuts ---------------------------------------------------------------

async function openLists(page) {
  await open(page, '#/settings');
  await expect(page.locator('#listGroups .listGroup')).toHaveCount(3);
}
const group = (page, name) => page.locator('#listGroups .listGroup').filter({ has: page.locator('[data-list="' + name + '"]') });
const chips = (page, name) => group(page, name).locator('.listChips .chip');
const msg = (page, name) => page.locator('#listMsg-' + name);
async function addToList(page, name, value) {
  await page.locator('#listInput-' + name).fill(value);
  await page.locator('#listGroups [data-action="list-add"][data-list="' + name + '"]').click();
}
async function addProduct(page, name, sell, unit) {
  await gotoTab(page, '#/stock');
  await page.locator('#btnAddProduct').click();
  await page.locator('#pName').fill(name);
  await page.locator('#pSell').fill(String(sell));
  await page.locator('#pStock').fill('5');
  if (unit) await page.locator('#pUnit').selectOption(unit);
  await page.locator('#btnSaveProduct').click();
  await expect(page.locator('#stockList')).toContainText(name);
}

// --- the card ----------------------------------------------------------------

test('the Lists card offers the three lists the shop owns, with its default units', async ({ page }) => {
  await openLists(page);
  await expect(chips(page, 'units')).toHaveCount(4);
  await expect(chips(page, 'units').first()).toContainText('piece');
  await expect(group(page, 'suppliers')).toBeVisible();
  await expect(group(page, 'refundReasons')).toBeVisible();
  await expect(chips(page, 'suppliers')).toHaveCount(0);
});

// --- a list the shop edits becomes a real choice -----------------------------

test('a unit the shop adds becomes a choice on the product form', async ({ page }) => {
  await openLists(page);
  await addToList(page, 'units', 'carton');
  await expect(chips(page, 'units')).toHaveCount(5);
  await expect(msg(page, 'units')).toContainText('تزادت');

  await gotoTab(page, '#/stock');
  await page.locator('#btnAddProduct').click();
  await expect(page.locator('#pUnit option[value="carton"]')).toHaveCount(1);
});

test('a supplier and a refund reason become hints on the forms that use them', async ({ page }) => {
  await openLists(page);
  await addToList(page, 'suppliers', 'Grossiste Ali');
  await addToList(page, 'refundReasons', 'مكسور');

  await gotoTab(page, '#/stock');
  await expect(page.locator('#supList option[value="Grossiste Ali"]')).toHaveCount(1);
  await expect(page.locator('#refundReasonList option[value="مكسور"]')).toHaveCount(1);
});

// --- the unit reaches the paper ---------------------------------------------

test('the unit sticks to the product and is printed on the ticket', async ({ page }) => {
  await openLists(page);
  await addToList(page, 'units', 'carton');

  await addProduct(page, 'Sugar', 2, 'kg');
  await expect(page.locator('#stockList')).toContainText('/ kg');

  await gotoTab(page, '#/sell');
  await page.locator('[data-action="sell-add"]').first().click();
  await page.locator('#paidCash').fill('5');
  await page.locator('#btnSell').click();
  await expect(page.locator('#rLines')).toContainText('×1 kg');
});

test('a product with no unit prints exactly what it printed before', async ({ page }) => {
  await open(page, '');
  await addProduct(page, 'Soda', 1.5, '');
  await gotoTab(page, '#/sell');
  await page.locator('[data-action="sell-add"]').first().click();
  await page.locator('#paidCash').fill('5');
  await page.locator('#btnSell').click();
  await expect(page.locator('#rLines')).toContainText('×1 @');
});

// --- the gate ----------------------------------------------------------------

test('a duplicate unit is refused BY NAME and nothing is written', async ({ page }) => {
  await openLists(page);
  await expect(chips(page, 'units')).toHaveCount(4);
  await addToList(page, 'units', 'kg');
  await expect(msg(page, 'units')).toContainText('lists.units');
  await expect(chips(page, 'units')).toHaveCount(4);
  await expect(page.locator('#listInput-units')).toHaveValue('kg', { timeout: 3000 });
});

test('the last unit cannot be removed (a product form with no unit is broken)', async ({ page }) => {
  await openLists(page);
  for (const u of ['kg', 'litre', 'pack']) {
    await page.locator('#listGroups [data-action="list-del"][data-list="units"][data-item="' + u + '"]').click();
  }
  await expect(chips(page, 'units')).toHaveCount(1);
  await page.locator('#listGroups [data-action="list-del"][data-list="units"][data-item="piece"]').click();
  await expect(msg(page, 'units')).toContainText('lists.units');
  await expect(chips(page, 'units')).toHaveCount(1);
});

test('a supplier may be removed, and it leaves the hints too', async ({ page }) => {
  await openLists(page);
  await addToList(page, 'suppliers', 'Grossiste Ali');
  await expect(chips(page, 'suppliers')).toHaveCount(1);
  await page.locator('#listGroups [data-action="list-del"][data-list="suppliers"][data-item="Grossiste Ali"]').click();
  await expect(chips(page, 'suppliers')).toHaveCount(0);
  await gotoTab(page, '#/stock');
  await expect(page.locator('#supList option[value="Grossiste Ali"]')).toHaveCount(0);
});

// --- it is data, not a screen -------------------------------------------------

test('the shop’s lists survive a reload', async ({ page }) => {
  await openLists(page);
  await addToList(page, 'units', 'carton');
  await expect(chips(page, 'units')).toHaveCount(5);

  await page.reload();
  await open(page, '#/settings');
  await expect(chips(page, 'units')).toHaveCount(5);
  await expect(chips(page, 'units').last()).toContainText('carton');
});
