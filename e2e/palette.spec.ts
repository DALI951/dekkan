/* DEKKAN E2E — wave 5: the shop's palette (Settings > Shop look).
 *
 * Wave 2 let a shopkeeper edit all 42 tokens, one by one. Wave 5 asks three
 * questions instead — the colour of his brand, of his money, and of his walls —
 * and derives the whole shop from them, guaranteeing it stays readable.
 *
 * What is proven here, in a real browser:
 *   three pickers and a live preview (no token rows anywhere) ·
 *   one colour repaints the whole shop before it is saved · Cancel keeps nothing ·
 *   Save keeps it in the SHOP's data and it survives a reload ·
 *   a light wall flips the shop to dark text · text is readable whatever he picks ·
 *   the app's own themes are presets he can CHOOSE but never edit ·
 *   and the theme is still a shareable file (export / paste / refuse nonsense by name).
 *
 * The engine contract lives in test/theme-palette.test.ts; this file proves the
 * screen is wired to it.
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

/* the real thing a shopkeeper does: open the OS colour picker (or type a hex) and
   let go. The app listens for `input`, so this is what it hears. */
const pick = (page, which, value) => page.evaluate(([w, v]) => {
  const el = document.querySelector('#themeSeeds input[data-seed="' + w + '"]');
  if (!el) throw new Error('no picker for ' + w);
  el.value = v;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}, [which, value]);

const seedValue = (page, which) => page.evaluate(
  (w) => document.querySelector('#themeSeeds input[data-seed="' + w + '"]').value, which);

/* WCAG contrast of two colours as the BROWSER resolved them — the promise the
   palette engine makes, checked on the real screen rather than in a unit test. */
const ratio = (page, a, b) => page.evaluate(([x, y]) => {
  const chan = (h) => {
    let m = String(h).trim().replace('#', '');
    if (m.length === 3) m = m.split('').map((c) => c + c).join('');
    const n = parseInt(m, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const lum = (h) => { const p = chan(h).map(lin); return 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]; };
  const l1 = lum(x); const l2 = lum(y);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}, [a, b]);

async function expectNoThemeKept(page) {
  const s = await savedTheme(page);
  if (s !== null) expect(s).toEqual({ id: 'souk', tokens: {} });
}

async function openPalette(page) {
  await open(page, '#/settings');
  await page.locator('#btnThemeEdit').click();
  await expect(page.locator('#themeEditor')).toBeVisible();
}

test('the palette screen offers THREE colours and a live preview of his own shop', async ({ page }) => {
  await openPalette(page);
  await expect(page.locator('#themeSeeds input[data-seed]')).toHaveCount(3);
  await expect(page.locator('#themeSeeds input[data-seed="brand"]')).toBeVisible();
  await expect(page.locator('#themeSeeds input[data-seed="money"]')).toBeVisible();
  await expect(page.locator('#themeSeeds input[data-seed="ground"]')).toBeVisible();

  await expect(page.locator('#themePreview')).toBeVisible();
  await expect(page.locator('#themePreview .pvCoin')).toBeVisible();
  await expect(page.locator('#themePreview .pvBtn')).toBeVisible();

  await expect(page.locator('[data-tok]')).toHaveCount(0);      // no token editing anywhere
  await expect(page.locator('#themeGroups')).toHaveCount(0);
  await expect(page.locator('#themeBase')).toHaveCount(0);
});

test('one colour repaints the WHOLE shop live, and Cancel keeps nothing', async ({ page }) => {
  await openPalette(page);
  const beforeAcc = await cssVar(page, '--acc');
  const beforeBg = await cssVar(page, '--bg');

  await pick(page, 'brand', '#ff0000');
  expect(await cssVar(page, '--acc')).toBe('#ff0000');          // live, unsaved
  const derived = await cssVar(page, '--acc2');
  expect(derived).not.toBe('#ff0000');                          // the family was derived, not copied
  expect(await cssVar(page, '--bg')).toBe(beforeBg);            // and only what he touched moved

  const preview = await page.locator('#themePreview .pvBtn').evaluate(
    (el) => getComputedStyle(el).backgroundColor);
  expect(preview).toBe('rgb(255, 0, 0)');                       // the preview answers back

  await page.locator('#btnThemeCancel').click();
  await expect(page.locator('#themeEditor')).toBeHidden();
  expect(await cssVar(page, '--acc')).toBe(beforeAcc);
  await expectNoThemeKept(page);
});

test('a light wall flips the shop to dark ink — the engine decides, not the shopkeeper', async ({ page }) => {
  await openPalette(page);
  await pick(page, 'ground', '#f4ecdd');
  const bg = await cssVar(page, '--bg');
  const txt = await cssVar(page, '--txt');
  expect(bg).toBe('#f4ecdd');
  const r = await ratio(page, txt, bg);
  expect(r).toBeGreaterThanOrEqual(7);                          // a wall this light gets AA+ text
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--acc').trim()))
    .not.toBe('');
});

test('whatever three colours he picks, the shop stays readable', async ({ page }) => {
  await openPalette(page);
  const triples = [
    ['#fd71ff', '#4102e0', '#23f320'],      // loud, on purpose
    ['#839f36', '#a0d7e9', '#e400a3'],      // a wall the engine cannot give 7:1 on
    ['#b58b5a', '#393cba', '#da1878'],
    ['#ffffff', '#ffffff', '#000000']
  ];
  for (const [brand, money, ground] of triples) {
    await pick(page, 'brand', brand);
    await pick(page, 'money', money);
    await pick(page, 'ground', ground);
    const bg = await cssVar(page, '--bg');
    expect(bg).toBe(ground);                                    // his wall, exactly what he picked
    expect(await ratio(page, await cssVar(page, '--txt'), bg)).toBeGreaterThanOrEqual(4.5);
    expect(await ratio(page, await cssVar(page, '--mut'), bg)).toBeGreaterThanOrEqual(4.5);
    expect(await ratio(page, await cssVar(page, '--acc'), bg)).toBeGreaterThanOrEqual(3);
    const ink = await cssVar(page, '--ink');
    expect(await ratio(page, ink, await cssVar(page, '--acc'))).toBeGreaterThanOrEqual(4.5);
  }
  await page.locator('#btnThemeCancel').click();
});

test('Save keeps the shop\'s palette in its DATA — it survives a reload and comes back on the pickers', async ({ page }) => {
  await openPalette(page);
  await pick(page, 'brand', '#ff0000');
  await page.locator('#btnThemeSave').click();
  await expect(page.locator('#themeEditor')).toBeHidden();

  const saved = await savedTheme(page);
  expect(saved.id).toBe('souk');
  expect(saved.tokens['--acc']).toBe('#ff0000');

  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  expect(await cssVar(page, '--acc')).toBe('#ff0000');

  await gotoTab(page, '#/settings');
  await page.locator('#btnThemeEdit').click();
  expect(await seedValue(page, 'brand')).toBe('#ff0000');       // he sees his own colour again
  await page.locator('#btnThemeCancel').click();
});

test('Save stores only what DIFFERS from the preset, so the preset can still be fixed later', async ({ page }) => {
  await openPalette(page);
  const presetAcc2 = await cssVar(page, '--acc2');
  await pick(page, 'brand', '#ff0000');
  await page.locator('#btnThemeSave').click();
  const saved = await savedTheme(page);
  expect(saved.tokens['--acc']).toBe('#ff0000');
  expect(Object.keys(saved.tokens).length).toBeLessThan(42);    // a diff, not a frozen copy
  expect(saved.tokens['--acc2']).not.toBe(presetAcc2);
});

test('Reset colours gives the preset back (and forgets the palette for good)', async ({ page }) => {
  await openPalette(page);
  const original = await cssVar(page, '--acc');
  await pick(page, 'brand', '#ff0000');
  await page.locator('#btnThemeSave').click();

  await page.locator('#btnThemeReset').click();
  await expect(page.locator('#toast')).toContainText(/preset/i);
  expect(await cssVar(page, '--acc')).toBe(original);
  expect(await savedTheme(page)).toEqual({ id: 'souk', tokens: {} });
});

test('the app\'s own themes are presets: he can CHOOSE one, never edit one', async ({ page }) => {
  await open(page, '#/settings');
  await page.locator('#themeGrid [data-theme="mint"]').click();

  const bg = await cssVar(page, '--bg');
  expect(bg).toBe('#06140f');                                   // Midnight Mint, live
  await expect(page.locator('#themeGrid .theme-sw.active')).toContainText('Midnight Mint');

  const saved = await savedTheme(page);
  expect(saved.id).toBe('mint');                                // choosing it DECLARED it

  await page.locator('#btnThemeEdit').click();
  await expect(page.locator('[data-tok]')).toHaveCount(0);      // still nothing to edit
  await page.locator('#btnThemeCancel').click();
});

test('Export writes a stand-alone palette JSON (the whole derived token set)', async ({ page }) => {
  await openPalette(page);
  await pick(page, 'brand', '#ff0000');
  await page.locator('#btnThemeSave').click();
  await page.locator('#btnThemeShare').click();
  await page.locator('#btnThemeExport').click();

  const json = JSON.parse(await page.locator('#themeJsonText').inputValue());
  expect(json.id).toBe('souk');
  expect(json.tokens['--acc']).toBe('#ff0000');
  expect(Object.keys(json.tokens)).toHaveLength(42);            // stands alone
});

test('a pasted palette JSON is applied AND kept (a theme is a file you can share)', async ({ page }) => {
  await open(page, '#/settings');
  await page.locator('#btnThemeShare').click();
  await page.locator('#themeJsonText').fill(JSON.stringify({ id: 'royal', tokens: { '--acc': '#00ff00' } }));
  await page.locator('#btnThemeApply').click();

  expect(await cssVar(page, '--acc')).toBe('#00ff00');
  const saved = await savedTheme(page);
  expect(saved.id).toBe('royal');
  expect(saved.tokens['--acc']).toBe('#00ff00');

  await page.locator('#btnThemeEdit').click();
  expect(await seedValue(page, 'brand')).toBe('#00ff00');       // the pickers tell the truth about it
  await page.locator('#btnThemeCancel').click();

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

test('the palette is the SHOP\'s, not the device\'s: it lands in the shop\'s data', async ({ page }) => {
  await openPalette(page);
  await pick(page, 'money', '#00d0ff');
  await page.locator('#btnThemeSave').click();
  await gotoTab(page, '#/settings');
  const raw = await page.evaluate(() => localStorage.getItem('dekkan.v1'));
  expect(JSON.parse(raw).custom.theme.tokens['--coin2']).toBe('#00d0ff');
});
