/* DEKKAN E2E — the customer name on the till (Dali, 2026-10-12):
 *
 *   "i cant type costumer name and its not required anymore when typing less
 *    than needed in pay so fix that"
 *
 * Two separate promises, both proven here with REAL keystrokes (the other specs
 * `.fill()` the field, which silently sets a value even when a human cannot
 * type into the box at all):
 *   1. a cashier can type a customer's name, and what he typed stays typed;
 *   2. whoever leaves money unpaid MUST have a name — the sale is refused, with
 *      a reason, until he gives one; nobody else is forced to name anything.
 */
'use strict';
const { test, expect } = require('@playwright/test');
const { open, gotoTab, toastText, closeReceipt } = require('./helpers');

test.afterEach(async ({ page }) => {
  expect(page.__errors).toEqual([]);
});

async function stockUp(page) {
  await open(page, '#/stock');
  await page.locator('#btnAddProduct').click();
  await page.locator('#pName').fill('Soda');
  await page.locator('#pBuy').fill('0.5');
  await page.locator('#pSell').fill('1.5');
  await page.locator('#pStock').fill('10');
  await page.locator('#btnSaveProduct').click();
  await expect(page.locator('#stockList')).toContainText('Soda');
  await gotoTab(page, '#/sell');
}

async function putOneInTheBasket(page) {
  await page.locator('[data-action="sell-add"]').first().click();
  await expect(page.locator('#basketCount')).not.toHaveText('0');
}

async function typeName(page, text) {
  const nm = page.locator('#creditName');
  await nm.click();
  await nm.pressSequentially(text, { delay: 20 });
}

const entries = (page) => page.evaluate(
  () => (JSON.parse(localStorage.getItem('dekkan.v1') || '{}').day || {}).entries || []);

test('a cashier can TYPE a customer name (and it survives the live re-render)', async ({ page }) => {
  await stockUp(page);
  await putOneInTheBasket(page);

  const nm = page.locator('#creditName');
  await expect(nm).toBeEditable();
  await expect(nm).toBeVisible();

  await typeName(page, 'Samir');
  await expect(nm).toHaveValue('Samir');

  /* the field is not wiped by the next render either */
  await page.locator('#paidCash').click();
  await page.locator('#paidCash').pressSequentially('1', { delay: 20 });
  await expect(nm).toHaveValue('Samir');

  /* and the live till line answers with the name he typed */
  await expect(page.locator('#changeLine')).toContainText('Samir');
});

test('paying LESS than the total refuses the sale until a name is given', async ({ page }) => {
  await stockUp(page);
  await putOneInTheBasket(page);

  await page.locator('#paidCash').fill('0.5');           // less than the price
  await page.locator('#btnSell').click();

  await expect(page.locator('#receipt')).toHaveClass(/hidden/);   // no sale was recorded
  expect(await entries(page)).toHaveLength(0);
  await expect(page.locator('#creditName')).toBeFocused();        // the cursor lands where the fix is
  expect(await toastText(page)).toMatch(/name/i);

  await typeName(page, 'Samir');
  await page.locator('#btnSell').click();
  await expect(page.locator('#receipt')).not.toHaveClass(/hidden/);   // now it goes through
  const es = await entries(page);
  expect(es).toHaveLength(1);
  expect(es[0].note).toBe('Samir');                      // the name travels with the sale
  await closeReceipt(page);
});

test('paying NOTHING at all is a debt too — it needs a name', async ({ page }) => {
  await stockUp(page);
  await putOneInTheBasket(page);

  await page.locator('#btnSell').click();                // empty money field = full credit
  await expect(page.locator('#receipt')).toHaveClass(/hidden/);
  expect(await entries(page)).toHaveLength(0);
  expect(await toastText(page)).toMatch(/name/i);
  await expect(page.locator('#creditName')).toBeFocused();
});

test('paying in FULL needs no name at all (nobody is forced to name a paid customer)', async ({ page }) => {
  await stockUp(page);
  await putOneInTheBasket(page);

  await page.locator('#paidCash').fill('100');
  await page.locator('#btnSell').click();
  await expect(page.locator('#receipt')).not.toHaveClass(/hidden/);
  const es = await entries(page);
  expect(es).toHaveLength(1);
  expect(es[0].customer || '').toBe('');
  await closeReceipt(page);
});

test('the name he typed is the name on the debt', async ({ page }) => {
  await stockUp(page);
  await putOneInTheBasket(page);
  await typeName(page, 'Ayoub');
  await page.locator('#paidCash').fill('0.5');
  await page.locator('#btnSell').click();
  await expect(page.locator('#receipt')).not.toHaveClass(/hidden/);
  await closeReceipt(page);

  const debts = await page.evaluate(
    () => (JSON.parse(localStorage.getItem('dekkan.v1') || '{}').debts || []));
  expect(debts.some((d) => d.name === 'Ayoub')).toBe(true);
});

test('the debt form needs a customer name too — and its field can be typed', async ({ page }) => {
  await open(page, '#/debts');
  await page.locator('#btnAddDebt').click();

  const nm = page.locator('#dName');
  await expect(nm).toBeEditable();
  await nm.click();
  await nm.pressSequentially('Samir', { delay: 20 });
  await expect(nm).toHaveValue('Samir');

  /* an amount without a name is refused: a debt IS somebody's name */
  await nm.fill('');
  await page.locator('#dAmount').fill('5');
  await page.locator('#btnSaveDebt').click();
  expect(await toastText(page)).toMatch(/name/i);
  const debts = await page.evaluate(
    () => (JSON.parse(localStorage.getItem('dekkan.v1') || '{}').debts || []));
  expect(debts).toHaveLength(0);

  await nm.click();
  await nm.pressSequentially('Samir', { delay: 20 });
  await page.locator('#btnSaveDebt').click();
  const after = await page.evaluate(
    () => (JSON.parse(localStorage.getItem('dekkan.v1') || '{}').debts || []));
  expect(after.some((d) => d.name === 'Samir')).toBe(true);
});
