/* DEKKAN E2E — wave 2: the shop's own colours (Settings > Shop look).
 *
 * What a shopkeeper can actually DO, end to end in a real browser:
 *   change a colour and see it on the page · cancel it · keep it · reset it ·
 *   export the theme as JSON, paste it back, and be REFUSED by name when the
 *   JSON (or one colour in it) is nonsense.
 *
 * The engine contract lives in test/theme-custom.test.ts; this file proves the
 * screen is wired to it — and that the choice survives a reload (it is in the
 * STATE, not only in this browser's cache).
 */
'use strict';
const { test, expect } = require('@playwright/test');
const { open, gotoTab } = require('./helpers');

test.afterEach(async ({ page }) => {
  expect(page.__errors).toEqual([]);
});

const cssVar = (page, name) => page.evaluate(
  (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);

const savedTheme = (page) => page.evaluate(() => {
  try { return (JSON.parse(localStorage.getItem('dekkan.v1') || '{}').custom || {}).theme || null; }
  catch (e) { return null; }
});

const tok = (page, name) => page.locator('#themeGroups input[data-tok="' + name + '"]');

// "the tweaks were not kept": a shop that never saved has NOTHING on disk, one
// that saved and stayed on the preset has {id, tokens:{}} — both mean the same.
async function expectNoThemeKept(page) {
  const s = await savedTheme(page);
  if (s !== null) expect(s).toEqual({ id: 'souk', tokens: {} });
}

async function openEditor(page) {
  await open(page, '#/settings');
  await page.locator('#btnThemeEdit').click();
  await expect(page.locator('#themeEditor')).toBeVisible();
}

test('the editor shows every colour the app uses, grouped, one row per token', async ({ page }) => {
  await openEditor(page);
  const rows = page.locator('#themeGroups .themeRow');
  await expect(rows).toHaveCount(42);
  await expect(tok(page, '--acc')).toBeVisible();
  await expect(tok(page, '--shadow')).toBeVisible();       // a whole shadow string, not a colour
  await expect(page.locator('#themeGroups .themeGrp')).toHaveCount(8);
  // "start from" offers every registered theme — the registry, not a hardcoded list
  await expect(page.locator('#themeBase [data-base]')).toHaveCount(3);
});

test('a colour changes on the page while typing, and Cancel puts the preset back', async ({ page }) => {
  await openEditor(page);
  const before = await cssVar(page, '--acc');
  await tok(page, '--acc').fill('#ff0000');
  expect(await cssVar(page, '--acc')).toBe('#ff0000');     // live, unsaved

  await page.locator('#btnThemeCancel').click();
  await expect(page.locator('#themeEditor')).toBeHidden();
  expect(await cssVar(page, '--acc')).toBe(before);        // nothing was kept
  await expectNoThemeKept(page);
});

test('Save keeps the colour in the shop\'s DATA — it survives a reload', async ({ page }) => {
  await openEditor(page);
  await tok(page, '--acc').fill('#ff0000');
  await tok(page, '--bg').fill('#101014');
  await page.locator('#btnThemeSave').click();
  await expect(page.locator('#themeEditor')).toBeHidden();

  const saved = await savedTheme(page);
  expect(saved.id).toBe('souk');
  expect(saved.tokens['--acc']).toBe('#ff0000');
  expect(saved.tokens['--bg']).toBe('#101014');

  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  expect(await cssVar(page, '--acc')).toBe('#ff0000');
  expect(await cssVar(page, '--bg')).toBe('#101014');
});

test('Save stores only what DIFFERS from the preset, so the base can still be fixed later', async ({ page }) => {
  await openEditor(page);
  await tok(page, '--acc').fill('#ff0000');
  await page.locator('#btnThemeSave').click();
  const saved = await savedTheme(page);
  expect(Object.keys(saved.tokens)).toEqual(['--acc']);    // not all 42
});

test('Reset colours gives the preset back (and forgets the tweaks for good)', async ({ page }) => {
  await openEditor(page);
  const original = await cssVar(page, '--acc');
  await tok(page, '--acc').fill('#ff0000');
  await page.locator('#btnThemeSave').click();

  await page.locator('#btnThemeReset').click();
  await expect(page.locator('#toast')).toContainText(/preset/i);
  expect(await cssVar(page, '--acc')).toBe(original);
  expect(await savedTheme(page)).toEqual({ id: 'souk', tokens: {} });
});

test('a colour the app cannot read is REFUSED by name — the shop\'s old colour stays', async ({ page }) => {
  await openEditor(page);
  const before = await cssVar(page, '--acc');
  await tok(page, '--acc').fill('gold-ish');
  await page.locator('#btnThemeSave').click();

  await expect(page.locator('#themeEditor')).toBeVisible();           // not saved, not closed
  await expect(page.locator('#themeMsg')).toContainText('--acc');     // and it names the token
  await expectNoThemeKept(page);
  await page.locator('#btnThemeCancel').click();
  expect(await cssVar(page, '--acc')).toBe(before);
});

test('Export writes a stand-alone theme JSON (the whole token set, with the tweaks)', async ({ page }) => {
  await openEditor(page);
  await tok(page, '--acc').fill('#ff0000');
  await page.locator('#btnThemeSave').click();
  await page.locator('#btnThemeShare').click();
  await page.locator('#btnThemeExport').click();

  const json = JSON.parse(await page.locator('#themeJsonText').inputValue());
  expect(json.id).toBe('souk');
  expect(json.tokens['--acc']).toBe('#ff0000');
  expect(Object.keys(json.tokens)).toHaveLength(42);      // stands alone
});

test('a pasted theme JSON is applied AND kept (a theme is a file you can share)', async ({ page }) => {
  await open(page, '#/settings');
  await page.locator('#btnThemeShare').click();
  await page.locator('#themeJsonText').fill(JSON.stringify({ id: 'royal', tokens: { '--acc': '#00ff00' } }));
  await page.locator('#btnThemeApply').click();

  expect(await cssVar(page, '--acc')).toBe('#00ff00');
  const saved = await savedTheme(page);
  expect(saved.id).toBe('royal');
  expect(saved.tokens['--acc']).toBe('#00ff00');

  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  expect(await cssVar(page, '--acc')).toBe('#00ff00');
});

test('nonsense JSON is refused, with the reason, and changes nothing', async ({ page }) => {
  await open(page, '#/settings');
  const before = await cssVar(page, '--acc');
  await page.locator('#btnThemeShare').click();

  await page.locator('#themeJsonText').fill('{not json');
  await page.locator('#btnThemeApply').click();
  await expect(page.locator('#themeMsg')).toContainText(/json/i);

  await page.locator('#themeJsonText').fill(JSON.stringify({ id: 'no-such-theme', tokens: {} }));
  await page.locator('#btnThemeApply').click();
  await expect(page.locator('#themeMsg')).toContainText(/no-such-theme/);

  await page.locator('#themeJsonText').fill(JSON.stringify({ id: 'souk', tokens: { '--acc': 'gold-ish' } }));
  await page.locator('#btnThemeApply').click();
  await expect(page.locator('#themeMsg')).toContainText('--acc');

  expect(await cssVar(page, '--acc')).toBe(before);
  await expectNoThemeKept(page);
});

test('the theme is the SHOP\'s, not the device\'s: it lands in the backup too', async ({ page }) => {
  await openEditor(page);
  await tok(page, '--acc').fill('#ff0000');
  await page.locator('#btnThemeSave').click();
  await gotoTab(page, '#/settings');
  const raw = await page.evaluate(() => localStorage.getItem('dekkan.v1'));
  expect(JSON.parse(raw).custom.theme.tokens['--acc']).toBe('#ff0000');
});
