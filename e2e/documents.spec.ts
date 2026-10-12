/* DEKKAN E2E — wave 3: the shop's own PAPER (brand + documents).
 *
 * Written BEFORE the screen existed (RED-first). What it pins down:
 *   * every choice the shop can make about its money, its dates, its brand and its
 *     printed ticket is on ONE screen, one control per choice
 *   * the sample line shows what the paper will look like, live, while typing
 *   * Save writes it into the shop's DATA (survives a reload, travels in the backup)
 *   * the till and the receipt actually CHANGE (a symbol is not a decoration)
 *   * a value the app cannot honour is REFUSED by name and changes nothing
 *   * the printed language can differ from the screen's (Arabic screen, French paper)
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

async function openDocuments(page) {
  await open(page, '#/settings');
  await page.locator('#btnDocEdit').click();
  await expect(page.locator('#docEditor')).not.toHaveClass(/hidden/);
}
const field = (page, key) => page.locator('#docGroups [data-doc="' + key + '"]');
const switchTrack = (page, key) => page.locator('#docGroups .docRow:has([data-doc="' + key + '"]) span');
async function saveDocuments(page) {
  await page.locator('#btnDocSave').click();
}

// the shopkeeper's everyday product, created through the real UI
async function addSoda(page, stock) {
  await page.locator('#btnAddProduct').click();
  await page.locator('#pName').fill('Soda');
  await page.locator('#pBuy').fill('0.5');
  await page.locator('#pSell').fill('1.5');
  await page.locator('#pStock').fill(String(stock));
  await page.locator('#btnSaveProduct').click();
  await expect(page.locator('#stockList')).toContainText('Soda');
}
// one paid sale of 1.5, leaving the receipt on screen
async function sellOneReceipt(page) {
  await gotoTab(page, '#/stock');
  await addSoda(page, 5);
  await gotoTab(page, '#/sell');
  await page.locator('[data-action="sell-add"]').first().click();
  await page.locator('#paidCash').fill('5');
  await page.locator('#btnSell').click();
  await expect(page.locator('#receipt')).not.toHaveClass(/hidden/);
}

// --- the screen -------------------------------------------------------------

/* a few of each kind, so the screen cannot silently lose a whole group */
test('the Documents screen offers every choice the shop has, one control each', async ({ page }) => {
  await openDocuments(page);
  const controls = page.locator('#docGroups [data-doc]');
  await expect(controls).toHaveCount(19);
  await expect(field(page, 'brand.tagline')).toBeVisible();
  await expect(field(page, 'brand.address')).toBeVisible();
  await expect(field(page, 'brand.phone')).toBeVisible();
  await expect(field(page, 'brand.taxId')).toBeVisible();
  await expect(field(page, 'money.symbol')).toBeVisible();
  await expect(field(page, 'money.decimals')).toBeVisible();
  await expect(field(page, 'money.thousands')).toBeVisible();
  await expect(field(page, 'date.format')).toBeVisible();
  await expect(field(page, 'print.size')).toBeVisible();
  await expect(switchTrack(page, 'print.autoPrint')).toBeVisible();
  await expect(field(page, 'receipt.header')).toBeVisible();
  await expect(field(page, 'receipt.footer')).toBeVisible();
  await expect(field(page, 'docLanguage')).toBeVisible();
});

test('the sample line shows the paper while typing (that is how a shopkeeper checks it)', async ({ page }) => {
  await openDocuments(page);
  const sample = page.locator('#docSample');
  await expect(sample).toContainText('1500.500');         // the default, unmistakeable
  await field(page, 'money.symbol').fill('DT');
  await expect(sample).toContainText('DT');
  await field(page, 'money.thousands').selectOption({ index: 1 });   // the space separator
  await field(page, 'money.decimals').selectOption('2');
  await expect(sample).toContainText('1 500.50 DT');
  await expect(page.locator('#docMsg')).toContainText(/لم تحفظ|غير محفوظ/); // unsaved warning
});

test('Save keeps the shop\'s paper in its DATA — it survives a reload', async ({ page }) => {
  await openDocuments(page);
  await field(page, 'money.symbol').fill('DT');
  await field(page, 'money.position').selectOption('before');
  await saveDocuments(page);
  await expect(page.locator('#docMsg')).toContainText(/حُفظ|محفوظ/);

  await page.reload();
  await openDocuments(page);
  await expect(field(page, 'money.symbol')).toHaveValue('DT');
  await expect(field(page, 'money.position')).toHaveValue('before');
});

test('the till and the receipt actually change (a format is not a decoration)', async ({ page }) => {
  await openDocuments(page);
  await field(page, 'money.symbol').fill('DT');
  await field(page, 'money.decimals').selectOption('2');
  await saveDocuments(page);
  await gotoTab(page, '#/sell');
  await expect(page.locator('#cashNow')).toContainText('DT');   // the header cash line
  await expect(page.locator('#cashNow')).toContainText(/\d+\.\d\d/); // two decimals now

  await sellOneReceipt(page);
  await expect(page.locator('#rTotals')).toContainText('DT');
  await expect(page.locator('#rTotals')).not.toContainText('د.ت');
});

test('the brand and the ticket wording reach the paper', async ({ page }) => {
  await openDocuments(page);
  await field(page, 'brand.tagline').fill('Epicerie du coin');
  await field(page, 'brand.address').fill('12 rue de la Liberte, Tunis');
  await field(page, 'brand.phone').fill('71 000 000');
  await field(page, 'brand.taxId').fill('1234567/A/M/000');
  await field(page, 'receipt.header').fill('Merci pour votre visite');
  await field(page, 'receipt.footer').fill('Pas de retour apres 7 jours');
  await switchTrack(page, 'receipt.showTaxId').click();
  await field(page, 'money.symbol').fill('DT');
  await saveDocuments(page);

  await sellOneReceipt(page);
  const rec = page.locator('#receipt');
  await expect(rec).toContainText('Epicerie du coin');
  await expect(rec).toContainText('12 rue de la Liberte, Tunis');
  await expect(rec).toContainText('71 000 000');
  await expect(rec).toContainText('1234567/A/M/000');   // showTaxId is on
  await expect(rec).toContainText('Merci pour votre visite');
  await expect(rec).toContainText('Pas de retour apres 7 jours');
});

test('the tax id stays OFF the paper until the shop asks for it', async ({ page }) => {
  await openDocuments(page);
  await field(page, 'brand.taxId').fill('1234567/A/M/000');
  await field(page, 'money.symbol').fill('DT');
  await saveDocuments(page);        // showTaxId left unchecked
  await sellOneReceipt(page);
  await expect(page.locator('#receipt')).not.toContainText('1234567/A/M/000');
});

test('the date the paper shows is the shop\'s own format', async ({ page }) => {
  await openDocuments(page);
  await field(page, 'date.format').selectOption('DD/MM/YYYY');
  await saveDocuments(page);
  await sellOneReceipt(page);
  await expect(page.locator('#rWhen')).toContainText(/^\d{2}\/\d{2}\/\d{4}/);
});

test('the printed language can differ from the screen\'s (Arabic till, French paper)', async ({ page }) => {
  await openDocuments(page);
  await field(page, 'docLanguage').selectOption('en');
  await field(page, 'money.symbol').fill('');
  await saveDocuments(page);
  await sellOneReceipt(page);
  const rec = page.locator('#receipt');
  await expect(rec).toContainText('Total');           // the paper speaks English
  await expect(rec).toContainText('TND');             // with the English money word
  await expect(rec).not.toContainText('المجموع');      // while the screen stays Arabic
  await expect(page.locator('#page-sell h2')).toHaveText('البيع');
});

test('a value the app cannot honour is REFUSED by name, and changes nothing', async ({ page }) => {
  await openDocuments(page);
  await field(page, 'money.symbol').fill('TOOLONGSYMBOL');
  await saveDocuments(page);
  await expect(page.locator('#docMsg')).toContainText('money.symbol');   // names the culprit
  await expect(page.locator('#docEditor')).not.toHaveClass(/hidden/);    // stays open to fix it
  await expect(page.locator('#cashNow')).not.toContainText('TOOLONGSYMBOL');

  await page.reload();
  await openDocuments(page);
  await expect(field(page, 'money.symbol')).toHaveValue('');             // nothing was written
});

test('Cancel leaves the shop exactly as it was', async ({ page }) => {
  await openDocuments(page);
  await field(page, 'money.symbol').fill('DT');
  await field(page, 'brand.tagline').fill('should not stick');
  await page.locator('#btnDocCancel').click();
  await expect(page.locator('#docEditor')).toHaveClass(/hidden/);
  await expect(page.locator('#cashNow')).not.toContainText('DT');

  await page.reload();
  await openDocuments(page);
  await expect(field(page, 'money.symbol')).toHaveValue('');
  await expect(field(page, 'brand.tagline')).toHaveValue('');
});
