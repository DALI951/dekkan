/* DEKKAN E2E — team, monthly review, cashbox and debts.
 * All interactions are UI-driven (hire, sell, deposit, borrow, repay) —
 * the browser is just a normal user doing normal shop work.
 */
'use strict';
const { test, expect } = require('@playwright/test');
const { open, gotoTab, sellOne, closeReceipt, tillNow } = require('./helpers');

test.afterEach(async ({ page }) => {
  expect(page.__errors).toEqual([]);
});

test('hire a cashier and see them in the team with their salary', async ({ page }) => {
  await open(page, '#/employees');
  await page.locator('#btnAddEmployee').click();
  await page.locator('#empName').fill('Sami');
  await page.locator('#empType').fill('Cashier');
  await page.locator('#empSalary').fill('400');
  await page.locator('#btnSaveEmployee').click();

  await expect(page.locator('#staffList')).toContainText('Sami');
  await expect(page.locator('#staffList')).toContainText(/400/);
});

test('monthly review counts wins, losses and the salaries inside', async ({ page }) => {
  // hire + a real sale — the review reads the same ledger the till reads
  await open(page, '#/employees');
  await page.locator('#btnAddEmployee').click();
  await page.locator('#empName').fill('Sami');
  await page.locator('#empType').fill('Cashier');
  await page.locator('#empSalary').fill('400');
  await page.locator('#btnSaveEmployee').click();

  await gotoTab(page, '#/stock');
  await page.locator('#btnAddProduct').click();
  await page.locator('#pName').fill('قرويط');
  await page.locator('#pBuy').fill('0.5');
  await page.locator('#pSell').fill('1.5');
  await page.locator('#pStock').fill('10');
  await page.locator('#btnSaveProduct').click();
  await gotoTab(page, '#/sell');
  await sellOne(page, 1.5);
  await expect(page.locator('#receipt')).not.toHaveClass(/hidden/);
  await closeReceipt(page);

  await gotoTab(page, '#/monthly');
  await expect(page.locator('#monthWins')).toHaveText(/1\.500/);
  await expect(page.locator('#monthLosses')).toHaveText(/400\.000/); // the salary
  await expect(page.locator('#monthProfit')).toHaveText(/398\.500/);
});

test('cashbox: deposit and withdraw move the till', async ({ page }) => {
  await open(page, '#/cashbox');
  await page.locator('#cbInAmt').fill('100');
  await page.locator('#cbInSrc').fill('holiday sale');
  const inCat = await page.locator('#cbInCat option').count();
  if (inCat > 0) await page.locator('#cbInCat').selectOption({ index: 0 });
  await page.locator('#btnCashIn').click();
  await expect(page.locator('#cashNow')).toHaveText(/100\.000/);

  await page.locator('#cbOutAmt').fill('25');
  await page.locator('#cbOutPurpose').fill('electricity');
  const outCat = await page.locator('#cbOutCat option').count();
  if (outCat > 0) await page.locator('#cbOutCat').selectOption({ index: 0 });
  await page.locator('#btnCashOut').click();
  await expect(page.locator('#cashNow')).toHaveText(/75\.000/);
});

test('sell on credit, then the customer pays and the debt settles', async ({ page }) => {
  await open(page, '#/stock');
  await page.locator('#btnAddProduct').click();
  await page.locator('#pName').fill('Coca');
  await page.locator('#pBuy').fill('0.8');
  await page.locator('#pSell').fill('1.5');
  await page.locator('#pStock').fill('10');
  await page.locator('#btnSaveProduct').click();
  await gotoTab(page, '#/sell');

  // full credit, name typed
  await sellOne(page, undefined, 'Ali');
  await expect(page.locator('#receipt')).not.toHaveClass(/hidden/);
  await expect(page.locator('#rClient')).toContainText('Ali'); // 'Ali #1' — numbered client
  expect(await tillNow(page)).toBe(0); // credit: no cash physically received yet
  await closeReceipt(page);

  // debts page: Ali owes 1.500 while the till still doesn't
  await gotoTab(page, '#/debts');
  await expect(page.locator('#debtList')).toContainText('Ali');
  await expect(page.locator('#debtList')).toContainText(/1\.500/);

  // pay it back in full
  await page.locator('[data-action="debt-pay"]').first().click();
  await page.locator('#payAmount').fill('1.5');
  await page.locator('#btnDoPay').click();

  // settled: no open-debt pay buttons left…
  await expect(page.locator('[data-action="debt-pay"]')).toHaveCount(0);
  // …and NOW the 1.500 is physically in the till
  await expect(page.locator('#cashNow')).toHaveText(/1\.500/);
});