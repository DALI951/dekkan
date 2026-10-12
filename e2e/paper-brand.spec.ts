/* DEKKAN E2E — wave 4.5: the paper the shop chose is the paper that comes out.
 *
 * The bug this guards (reported from the shop): the engine wrote
 * `@page{size:80mm auto}`, which is not valid CSS (the grammar is
 * `auto | <length>{1,2} | <page-size>`), so Chromium threw the rule away and
 * every ticket printed on the browser's default sheet — Letter, on this box.
 *
 * A screenshot cannot prove a paper size, so these tests print a REAL pdf with
 * `preferCSSPageSize: true` and read the sheet the layout engine produced out of
 * the pdf's own /MediaBox (in points; 1mm = 72/25.4pt). That is the same
 * measurement a print shop would make with a ruler.
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

const PT_PER_MM = 72 / 25.4;

async function setPaper(page, value) {
  await open(page, '#/settings');
  await page.locator('#btnDocEdit').click();
  await page.locator('#docGroups [data-doc="print.size"]').selectOption(value);
  await page.locator('#btnDocSave').click();
}

// a shop with one product and one paid sale, leaving the ticket on screen
async function sellOneTicket(page) {
  await gotoTab(page, '#/stock');
  await page.locator('#btnAddProduct').click();
  await page.locator('#pName').fill('Soda');
  await page.locator('#pBuy').fill('0.5');
  await page.locator('#pSell').fill('1.5');
  await page.locator('#pStock').fill('5');
  await page.locator('#btnSaveProduct').click();
  await expect(page.locator('#stockList')).toContainText('Soda');
  await gotoTab(page, '#/sell');
  await page.locator('[data-action="sell-add"]').first().click();
  await page.locator('#paidCash').fill('5');
  await page.locator('#btnSell').click();
  await expect(page.locator('#receipt')).not.toHaveClass(/hidden/);
}

// the shopkeeper presses Print on the ticket: the app measures the ticket, puts
// the shop's paper size on the sheet, and only then hands it to the browser.
async function pressPrint(page) {
  await page.locator('#btnReceiptPrint').click();
}

// the sheet the browser's own print engine produced, in points
async function sheet(page) {
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  const m = pdf.toString('latin1').match(/MediaBox\s*\[([^\]]+)\]/);
  expect(m, 'the pdf must carry a /MediaBox').toBeTruthy();
  const n = m[1].trim().split(/\s+/).slice(2).map(Number);
  return { w: n[0], h: n[1] };
}

// ---------- the style the app writes ----------

test('the paper style is two explicit lengths — never `auto` (that is the bug that printed A4)', async ({ page }) => {
  await setPaper(page, '80mm');
  const css = await page.locator('#paperStyle').textContent();
  expect(css).toMatch(/@page\{size:80mm \d+mm;margin:3mm\}/);
  expect(css).not.toMatch(/auto/);
});

test('the shop\'s paper choice survives a reload into the printed style', async ({ page }) => {
  await setPaper(page, '58mm');
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  const css = await page.locator('#paperStyle').textContent();
  expect(css).toMatch(/@page\{size:58mm \d+mm;margin:2mm\}/);
});

// ---------- the sheet that actually comes out ----------

test('80mm really prints on an 80mm sheet, as tall as the ticket needs (not one A4)', async ({ page }) => {
  await setPaper(page, '80mm');
  await sellOneTicket(page);
  await pressPrint(page);
  const s = await sheet(page);
  expect(Math.abs(s.w - 80 * PT_PER_MM)).toBeLessThan(2);
  expect(s.h).toBeGreaterThan(60);
  expect(s.h).toBeLessThan(297 * PT_PER_MM - 5);   // measured to the ticket, not a whole roll
  expect(s.h).toBeLessThan(841.89 - 5);            // and never one A4
});

test('58mm really prints on a 58mm sheet', async ({ page }) => {
  await setPaper(page, '58mm');
  await sellOneTicket(page);
  await pressPrint(page);
  const s = await sheet(page);
  expect(Math.abs(s.w - 58 * PT_PER_MM)).toBeLessThan(2);
  expect(s.h).toBeLessThan(297 * PT_PER_MM - 5);
});

test('A4 really prints on A4 (the invoice shop gets a full page)', async ({ page }) => {
  await setPaper(page, 'A4');
  await sellOneTicket(page);
  await pressPrint(page);
  const s = await sheet(page);
  expect(Math.abs(s.w - 595.28)).toBeLessThan(2);
  expect(Math.abs(s.h - 841.89)).toBeLessThan(2);
});

test('a longer ticket makes a taller sheet — the roll is measured, not guessed', async ({ page }) => {
  await setPaper(page, '80mm');
  await sellOneTicket(page);
  await pressPrint(page);
  const short = await sheet(page);

  // a SECOND product, so the ticket really has more lines (selling more of the
  // same product is one line with a quantity - that is not a longer ticket)
  await page.locator('#btnReceiptClose2').click();
  await gotoTab(page, '#/stock');
  await page.locator('#btnAddProduct').click();
  await page.locator('#pName').fill('Bread');
  await page.locator('#pBuy').fill('0.3');
  await page.locator('#pSell').fill('0.8');
  await page.locator('#pStock').fill('5');
  await page.locator('#btnSaveProduct').click();
  await gotoTab(page, '#/sell');
  await page.locator('[data-action="sell-add"]').nth(0).click();
  await page.locator('[data-action="sell-add"]').nth(1).click();
  await page.locator('#paidCash').fill('10');
  await page.locator('#btnSell').click();
  await expect(page.locator('#rLines')).toContainText('Bread');
  await pressPrint(page);
  const tall = await sheet(page);
  expect(tall.h).toBeGreaterThan(short.h);
});

// ---------- the shop's own name, where the app's name used to be ----------

test('the shop names itself: the title and the symbol follow the shop, the style stays', async ({ page }) => {
  await open(page, '#/settings');
  const typeOf = () => page.locator('#sideTitle').evaluate((el) => {
    const s = getComputedStyle(el);
    return [s.fontFamily, s.fontSize, s.fontWeight, s.letterSpacing, s.color].join('|');
  });
  const before = await typeOf();

  await page.locator('#cfgShopName').fill('مخبزة النور');
  await page.locator('#btnSaveCfg').click();

  await expect(page.locator('#sideTitle')).toHaveText('مخبزة النور');
  await expect(page.locator('#sideLogo')).toHaveText('م');
  await expect(page.locator('#shopName')).toHaveText('مخبزة النور');

  // "only the character changes": the type treatment is IDENTICAL to the app's own title
  const after = await typeOf();
  expect(after).toBe(before);
  const weight = Number((await typeOf()).split('|')[2]);
  expect(weight).toBeGreaterThanOrEqual(700);
  expect(parseFloat((await typeOf()).split('|')[1])).toBeGreaterThan(15);
});

test('a shop with no name yet still gets the app\'s name and symbol (nothing is blank)', async ({ page }) => {
  await open(page, '#/settings');
  await page.locator('#cfgShopName').fill('  ');
  await page.locator('#btnSaveCfg').click();
  await expect(page.locator('#sideTitle')).not.toBeEmpty();
  await expect(page.locator('#sideLogo')).not.toBeEmpty();
});
