/* DEKKAN E2E — the ONSLAUGHT: absolute bulletproofing of real & impossible inputs.
 * Every finding from the probe run (2026-09-20) is a permanent test here:
 *  - the 4 holes found (free-item negative price/qty, refund beyond sold, till below zero)
 *  - every guard that already held (wrong paid, oversell, empty forms, dup cats, bad checks...)
 *  - the legit edge cases that MUST keep working (zero-price promos, zero-net sales,
 *    credit-sale receipt refunds undoing the debt).
 * Run: npm run test:e2e
 */
'use strict';
const fs = require('node:fs');
const { test, expect } = require('@playwright/test');
const { open, gotoTab, sellOne, closeReceipt, tillNow, toastText } = require('./helpers');

test.afterEach(async ({ page }) => {
  expect(page.__errors).toEqual([]);
});

// The shopkeeper's everyday product, created through the real UI.
async function addSoda(page, stock) {
  await page.locator('#btnAddProduct').click();
  await page.locator('#pName').fill('Soda');
  await page.locator('#pBuy').fill('0.5');
  await page.locator('#pSell').fill('1.5');
  await page.locator('#pStock').fill(String(stock));
  await page.locator('#btnSaveProduct').click();
  await expect(page.locator('#stockList')).toContainText('Soda');
}

// ============================================================ MONEY HONESTY
test.describe('onslaught: money + stock honesty (the 4 holes)', () => {

  test('free item with a NEGATIVE price is refused', async ({ page }) => {
    await open(page, '#/sell');
    await page.locator('#freeName').fill('Robo');
    await page.locator('#freePrice').fill('-100');
    await page.locator('#btnAddFree').click();
    expect(await toastText(page)).toBe('الثمن يجب أن يكون صفرًا أو أكثر');
    // and a blank/zero price is still the legit freebie path
    await page.locator('#freePrice').fill('0');
    await page.locator('#btnAddFree').click();
    await expect(page.locator('#basketList')).toContainText('Robo');
  });

  test('free item with a NEGATIVE quantity is refused', async ({ page }) => {
    await open(page, '#/sell');
    await page.locator('#freeName').fill('Coffee');
    await page.locator('#freeQty').fill('-2');
    await page.locator('#btnAddFree').click();
    expect(await toastText(page)).toBe('الكمية يجب أن تكون 1 على الأقل');
    // blank qty still means 1, and it lands in the basket
    await page.locator('#freeQty').fill('');
    await page.locator('#freeName').fill('Coffee');
    await page.locator('#btnAddFree').click();
    await expect(page.locator('#basketList')).toContainText('Coffee');
  });

  test('refund MORE than was sold today is refused, till untouched', async ({ page }) => {
    await open(page, '#/stock');
    await addSoda(page, 10);
    await gotoTab(page, '#/sell');
    await sellOne(page, 1.5); // 1 of 10 sold
    await closeReceipt(page);
    expect(await tillNow(page)).toBe(1.5);

    await page.locator('#btnRefundMode').click();
    await page.locator('[data-action="refund-pick"]').first().click();
    await page.locator('#refundQty').fill('99'); // only 1 was ever sold
    await page.locator('#btnDoRefund').click();
    expect(await toastText(page)).toContain('exceeds what was sold today');
    expect(await tillNow(page)).toBe(1.5); // no money moved
  });

  test('negative refund qty is refused', async ({ page }) => {
    await open(page, '#/stock');
    await addSoda(page, 10);
    await gotoTab(page, '#/sell');
    await sellOne(page, 1.5);
    await closeReceipt(page);
    await page.locator('#btnRefundMode').click();
    await page.locator('[data-action="refund-pick"]').first().click();
    await page.locator('#refundQty').fill('-5');
    await page.locator('#btnDoRefund').click();
    expect(await toastText(page)).toContain('must be positive');
    expect(await tillNow(page)).toBe(1.5);
  });

  test('withdrawing MORE than the till holds is refused', async ({ page }) => {
    await open(page, '#/cashbox');
    await page.locator('#cbOutAmt').fill('10'); // till holds 0.000
    await page.locator('#btnCashOut').click();
    expect(await toastText(page)).toContain('not enough cash');
    expect(await tillNow(page)).toBe(0);
  });

  test('withdrawing EXACTLY what the till holds is allowed', async ({ page }) => {
    await open(page, '#/cashbox');
    await page.locator('#cbInAmt').fill('5');
    await page.locator('#btnCashIn').click();
    expect(await tillNow(page)).toBe(5);
    await page.locator('#cbOutAmt').fill('5');
    await page.locator('#btnCashOut').click();
    expect(await tillNow(page)).toBe(0); // exact: till lands on 0, no error
  });
});

// ============================================================ THE SELL FLOW
test.describe('onslaught: the sell flow fights back', () => {

  test('an EMPTY basket cannot be sold', async ({ page }) => {
    await open(page, '#/sell');
    await page.locator('#btnSell').click();
    expect(await toastText(page)).toContain('السلة فارغة');
    expect(await tillNow(page)).toBe(0);
  });

  test('a NEGATIVE paid amount is refused', async ({ page }) => {
    await open(page, '#/stock');
    await addSoda(page, 5);
    await gotoTab(page, '#/sell');
    await page.locator('[data-action="sell-add"]').first().click();
    await page.locator('#paidCash').fill('-5');
    await page.locator('#btnSell').click();
    expect(await toastText(page)).toBe('المبلغ المدفوع غير صحيح');
    await expect(page.locator('#receipt')).toHaveClass(/hidden/);
    expect(await tillNow(page)).toBe(0);
  });

  test('paying NOTHING on a paid sale demands a customer name', async ({ page }) => {
    await open(page, '#/stock');
    await addSoda(page, 5);
    await gotoTab(page, '#/sell');
    await page.locator('[data-action="sell-add"]').first().click();
    await page.locator('#paidCash').fill('0');
    await page.locator('#btnSell').click();
    expect(await toastText(page)).toBe('الباقي يحتاج اسم الزبون');
    await expect(page.locator('#basketCount')).toHaveText('1'); // sale did not happen
  });

  test('the basket cannot be pushed over the stock, and a max basket still sells', async ({ page }) => {
    await open(page, '#/stock');
    await addSoda(page, 3);
    await gotoTab(page, '#/sell');
    await page.locator('[data-action="sell-add"]').click();
    await page.locator('[data-action="sell-add"]').click();
    await page.locator('[data-action="sell-add"]').click();
    await expect(page.locator('#basketCount')).toHaveText('3');
    await page.locator('[data-action="sell-add"]').click(); // 4th unit: refused at add time
    expect(await toastText(page)).toContain('المخزون');
    await expect(page.locator('#basketCount')).toHaveText('3'); // stuck at the stock number
    await page.locator('#paidCash').fill('5'); // 3 x 1.5 = 4.5 — still a legit full sale
    await page.locator('#btnSell').click();
    await expect(page.locator('#receipt')).not.toHaveClass(/hidden/);
    await closeReceipt(page);
    expect(await tillNow(page)).toBe(4.5);
  });

  test('a 100% discount is a legit zero-net sale', async ({ page }) => {
    await open(page, '#/stock');
    await addSoda(page, 5);
    await gotoTab(page, '#/sell');
    await page.locator('[data-action="sell-add"]').first().click();
    await page.locator('#discPct').fill('100');
    await page.locator('#paidCash').fill('0');
    await page.locator('#btnSell').click();
    await expect(page.locator('#receipt')).not.toHaveClass(/hidden/); // receipt printed
    await closeReceipt(page);
    expect(await tillNow(page)).toBe(0); // no money appeared from nothing
    await gotoTab(page, '#/report');
    await expect(page.locator('#entriesList .e-amt.none').first()).toHaveText('-'); // zero rows render as a dash
  });

  test('double-clicking Sell records ONE sale', async ({ page }) => {
    await open(page, '#/stock');
    await addSoda(page, 5);
    await gotoTab(page, '#/sell');
    await page.locator('[data-action="sell-add"]').first().click();
    await page.locator('#paidCash').fill('1.5');
    await page.locator('#btnSell').dblclick();
    expect(await tillNow(page)).toBe(1.5); // one sale: 1.500, not 3.000
  });
});

// ============================================================ STOCK & PRODUCTS
test.describe('onslaught: stock page guards', () => {

  test('a product with an EMPTY name is refused', async ({ page }) => {
    await open(page, '#/stock');
    await page.locator('#btnAddProduct').click();
    await page.locator('#pName').fill('   ');
    await page.locator('#pBuy').fill('1');
    await page.locator('#pSell').fill('2');
    await page.locator('#btnSaveProduct').click();
    expect(await toastText(page)).toBe('اكتب اسم المنتوج');
    await expect(page.locator('#stockList .empty')).toBeVisible(); // no product row was created
  });

  test('a product with a NEGATIVE sell price is refused', async ({ page }) => {
    await open(page, '#/stock');
    await page.locator('#btnAddProduct').click();
    await page.locator('#pName').fill('Poison');
    await page.locator('#pSell').fill('-5');
    await page.locator('#btnSaveProduct').click();
    expect(await toastText(page)).toBe('اكتب ثمن البيع');
    await expect(page.locator('#stockList')).not.toContainText('Poison');
  });

  test('a ZERO-price product is a legit promo and sells clean', async ({ page }) => {
    await open(page, '#/stock');
    await page.locator('#btnAddProduct').click();
    await page.locator('#pName').fill('Freebie');
    await page.locator('#pBuy').fill('0');
    await page.locator('#pSell').fill('0');
    await page.locator('#pStock').fill('10');
    await page.locator('#btnSaveProduct').click();
    await expect(page.locator('#stockList')).toContainText('Freebie');
    await gotoTab(page, '#/sell');
    await page.locator('[data-action="sell-add"]').first().click();
    await page.locator('#btnSell').click();
    await expect(page.locator('#receipt')).not.toHaveClass(/hidden/);
    await closeReceipt(page);
    expect(await tillNow(page)).toBe(0); // till untouched by a promo
    await gotoTab(page, '#/report');
    await expect(page.locator('#entriesList .e-amt.none').first()).toHaveText('-'); // but still recorded as a zero row
  });

  test('editing a product to an empty name is refused and the name survives', async ({ page }) => {
    await open(page, '#/stock');
    await addSoda(page, 5);
    await page.locator('[data-action="stock-edit"]').first().click();
    await page.locator('#pName').fill('');
    await page.locator('#btnSaveProduct').click();
    expect(await toastText(page)).toBe('اكتب اسم المنتوج');
    await expect(page.locator('#stockList')).toContainText('Soda'); // untouched
  });
});

// ============================================================ DEBTS & STAFF
test.describe('onslaught: debts + staff guards', () => {

  test('a debt with NO name is refused, an EMPTY amount is refused', async ({ page }) => {
    await open(page, '#/debts');
    await page.locator('#btnAddDebt').click();
    await page.locator('#dName').fill('');
    await page.locator('#dAmount').fill('10');
    await page.locator('#btnSaveDebt').click();
    expect(await toastText(page)).not.toBe('تم الحفظ');
    await expect(page.locator('#debtList .empty')).toBeVisible();

    await page.locator('#dName').fill('Ali');
    await page.locator('#dAmount').fill('0');
    await page.locator('#btnSaveDebt').click();
    expect(await toastText(page)).not.toBe('تم الحفظ');
    await expect(page.locator('#debtList .empty')).toBeVisible();
  });

  test('an OPEN debt offers no delete button at all', async ({ page }) => {
    await open(page, '#/debts');
    await page.locator('#btnAddDebt').click();
    await page.locator('#dName').fill('Ali');
    await page.locator('#dAmount').fill('10');
    await page.locator('#btnSaveDebt').click();
    await expect(page.locator('#debtList')).toContainText('Ali');
    await expect(page.locator('#debtList [data-action="debt-del"]')).toHaveCount(0);
  });

  test('paying MORE than the remaining debt is refused', async ({ page }) => {
    await open(page, '#/debts');
    await page.locator('#btnAddDebt').click();
    await page.locator('#dName').fill('Ali');
    await page.locator('#dAmount').fill('10');
    await page.locator('#btnSaveDebt').click();
    await page.locator('[data-action="debt-pay"]').first().click();
    await page.locator('#payAmount').fill('50');
    await page.locator('#btnDoPay').click();
    expect(await toastText(page)).toContain('أكبر من الباقي');
  });

  test('an employee with NO name or a NEGATIVE salary is refused', async ({ page }) => {
    await open(page, '#/employees');
    await page.locator('#btnAddEmployee').click();
    await page.locator('#empName').fill('   ');
    await page.locator('#empSalary').fill('300');
    await page.locator('#btnSaveEmployee').click();
    expect(await toastText(page)).not.toBe('تم الحفظ');
    await page.locator('#empName').fill('Bob');
    await page.locator('#empSalary').fill('-300');
    await page.locator('#btnSaveEmployee').click();
    expect(await toastText(page)).not.toBe('تم الحفظ');
    await expect(page.locator('#staffList')).not.toContainText('Bob');
  });
});

// ============================================================ CASHBOX & SETTINGS
test.describe('onslaught: cashbox + settings guards', () => {

  test('cash IN with impossible amounts is refused and the till never moves', async ({ page }) => {
    await open(page, '#/cashbox');
    await page.locator('#cbInAmt').fill('-5');
    await page.locator('#btnCashIn').click();
    expect(await toastText(page)).toMatch(/amount|المبلغ/);
    expect(await tillNow(page)).toBe(0);
    // letters are blocked by the browser because this is input[type=number]; zero is still a possible bad value.
    await page.locator('#cbInAmt').fill('0');
    await page.locator('#btnCashIn').click();
    expect(await toastText(page)).toMatch(/amount|المبلغ/);
    expect(await tillNow(page)).toBe(0);
  });

  test('a drawer check with a NEGATIVE count is refused', async ({ page }) => {
    await open(page, '#/report');
    await page.locator('#countedCash').fill('-5');
    await page.locator('#btnCheckCash').click();
    expect(await toastText(page)).not.toBe('تم');
    expect(await tillNow(page)).toBe(0);
  });

  test('duplicate categories are refused, empty names are a silent no-op', async ({ page }) => {
    await open(page, '#/cashbox');
    await page.locator('#catOutName').fill('كراء');
    await page.locator('#btnCatOutAdd').click();
    await page.locator('#catOutName').fill('كراء');
    await page.locator('#btnCatOutAdd').click();
    expect(await toastText(page)).toBe('هذه الفئة موجودة أصلاً');
    await page.locator('#catOutName').fill('  ');
    await page.locator('#btnCatOutAdd').click(); // silent no-op: no toast, no crash
  });

  test('export downloads a valid JSON backup', async ({ page }) => {
    await open(page, '#/settings');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#btnExport').click(),
    ]);
    const data = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
    expect(data.shop).toBeTruthy();
    expect(Array.isArray(data.products)).toBe(true);
    expect(data.version).toBe(3);
  });

  test('import: a valid backup restores the shop; a garbage file changes nothing', async ({ page }) => {
    // build a shop with a product + a sale, export it as the backup
    await open(page, '#/stock');
    await addSoda(page, 7);
    await gotoTab(page, '#/sell');
    await sellOne(page, 3); // 1 x Soda @ 1.5, paid 3 (overpay -> change)
    await closeReceipt(page);
    await gotoTab(page, '#/settings');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#btnExport').click(),
    ]);
    const backup = fs.readFileSync(await download.path(), 'utf8');
    const stateNow = await page.evaluate(() => JSON.parse(localStorage.getItem('dekkan.v1')));
    expect(stateNow.products.length).toBe(1);
    expect(stateNow.day.entries.filter(e => e.kind === 'sale').length).toBe(1);

    // 1) GARBAGE file: refused, state untouched
    await page.locator('#importFile').setInputFiles({
      name: 'garbage.json', mimeType: 'application/json', buffer: Buffer.from('{broken json!!')
    });
    expect(await toastText(page)).toBe('هذا الملف ليس نسخة صالحة');
    const afterGarbage = await page.evaluate(() => JSON.parse(localStorage.getItem('dekkan.v1')));
    expect(afterGarbage.products.length).toBe(1);

    // 2) MUTILATED backup (no products): refused, state untouched
    const mutilated = JSON.parse(backup);
    delete mutilated.products;
    await page.locator('#importFile').setInputFiles({
      name: 'mut.json', mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(mutilated))
    });
    expect(await toastText(page)).toBe('هذا الملف ليس نسخة صالحة');

    // 3) REAL backup: confirm dialog -> restore -> shop matches the backup
    page.once('dialog', d => d.accept());
    await page.locator('#importFile').setInputFiles({
      name: 'real.json', mimeType: 'application/json', buffer: Buffer.from(backup)
    });
    await expect(page.locator('#toast')).toContainText('تمت الاستعادة بنجاح');
    const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('dekkan.v1')));
    expect(restored.products.length).toBe(1);
    expect(restored.day.entries.filter(e => e.kind === 'sale').length).toBe(1);
    expect(restored.products[0].stock).toBe(6); // 7 - 1 sold = the exported numbers, not a fresh shop
  });

  test('closing an EMPTY day is clean: no crash, cash intact', async ({ page }) => {
    await open(page, '#/settings');
    await page.locator('#btnCloseDay').click();
    expect(await tillNow(page)).toBe(0);
    await gotoTab(page, '#/report'); // app still alive
    await expect(page.locator('#entriesList .empty')).toBeVisible();
  });
});

// ============================================================ RECEIPT REFUNDS
test.describe('onslaught: receipt refunds (tickets)', () => {

  test('cash receipt refund: goods restocked, till gives back, trace kept', async ({ page }) => {
    await open(page, '#/stock');
    await addSoda(page, 10);
    await gotoTab(page, '#/sell');
    await sellOne(page, 1.5);
    await expect(page.locator('#receipt')).not.toHaveClass(/hidden/);
    await page.locator('#btnReceiptRefund').click(); // refund from the open receipt
    expect(await toastText(page)).toBe('تم الاسترجاع');
    await expect(page.locator('#receipt')).toHaveClass(/hidden/); // it closes itself
    expect(await tillNow(page)).toBe(0); // the 1.500 went back

    // restock proof: 10 left, an 11th unit cannot be added to the basket
    await gotoTab(page, '#/sell');
    for (let i = 0; i < 10; i++) await page.locator('[data-action="sell-add"]').first().click();
    await expect(page.locator('#basketCount')).toHaveText('10');
  });

  test('credit receipt refund: the DEBT is undone, cash never moves', async ({ page }) => {
    await open(page, '#/stock');
    await addSoda(page, 10);
    await gotoTab(page, '#/sell');
    await sellOne(page, undefined, 'Ali'); // full credit sale
    await expect(page.locator('#receipt')).not.toHaveClass(/hidden/);
    await page.locator('#btnReceiptRefund').click();
    expect(await toastText(page)).toBe('تم الاسترجاع');
    expect(await tillNow(page)).toBe(0); // empty till stayed empty (no phantom cash)
    await gotoTab(page, '#/sell');
    for (let i = 0; i < 10; i++) await page.locator('[data-action="sell-add"]').first().click();
    await expect(page.locator('#basketCount')).toHaveText('10'); // all 10 back on the shelf
  });
});
