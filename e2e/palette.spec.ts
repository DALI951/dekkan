/* DEKKAN E2E — the shop's PALETTE (Settings > shop look). Re-cut for wave 7.
 *
 * Wave 2 let a shopkeeper edit all 42 tokens, one by one. Wave 5 asked three
 * questions instead — the colour of his brand, of his money, and of his walls.
 * Wave 7 finished the thought (Dali, 2026-10-13: "i want the user to be able to
 * create his own theme using any 3 colors and no one can be able to change the
 * default themes"): his three colours ARE the theme, the 42 tokens are DERIVED
 * at paint time and never stored, and the app's own themes have no writer.
 *
 * What is proven here, in a real browser:
 *   three pickers + a name + a live preview (no token rows anywhere) ·
 *   one colour repaints the whole shop before it is saved · Cancel keeps nothing ·
 *   Save keeps his THREE colours in the SHOP's data, and it survives a reload ·
 *   nothing derived is ever written to the data (a preset stays fixable) ·
 *   "back to the app theme" keeps HIS colours for the next time ·
 *   the app's themes are presets he can CHOOSE but never edit ·
 *   and a theme is still a file: export three colours, paste them back, refuse
 *   nonsense by name (a wave 5-6 token file still converts).
 *
 * The engine contract lives in test/theme-palette.test.ts + test/theme-own.test.ts;
 * this file proves the screen is wired to it.
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

/* a shop that never picked colours of its own: the default preset, no seeds.
   On a brand-new browser the state blob may not have been written yet (nothing
   has changed the shop), so an absent theme counts as "kept nothing". */
async function expectNoThemeKept(page) {
  const s = await savedTheme(page);
  if (s !== null) expect(s).toEqual({ id: 'souk', name: '', seeds: {} });
}

async function openPalette(page) {
  await open(page, '#/settings');
  await page.locator('#btnThemeEdit').click();
  await expect(page.locator('#themeEditor')).toBeVisible();
}

test('the palette screen offers THREE colours, a name, and a live preview of his own shop', async ({ page }) => {
  await openPalette(page);
  await expect(page.locator('#themeSeeds input[data-seed]')).toHaveCount(3);
  await expect(page.locator('#themeSeeds input[data-seed="brand"]')).toBeVisible();
  await expect(page.locator('#themeSeeds input[data-seed="money"]')).toBeVisible();
  await expect(page.locator('#themeSeeds input[data-seed="ground"]')).toBeVisible();
  await expect(page.locator('#themeName')).toBeVisible();       // his theme has HIS name

  await expect(page.locator('#themePreview')).toBeVisible();
  await expect(page.locator('#themePreview .pvCoin')).toBeVisible();
  await expect(page.locator('#themePreview .pvBtn')).toBeVisible();

  await expect(page.locator('[data-tok]')).toHaveCount(0);      // no token editing anywhere
  await expect(page.locator('#themeGroups')).toHaveCount(0);
});

test('one colour repaints the WHOLE shop live, and Cancel keeps nothing', async ({ page }) => {
  await openPalette(page);
  const beforeAcc = await cssVar(page, '--acc');
  const beforeBg = await cssVar(page, '--bg');

  await pick(page, 'brand', '#ff0000');
  expect(await cssVar(page, '--acc')).toBe('#ff0000');          // live, unsaved
  const derived = await cssVar(page, '--acc2');
  expect(derived).not.toBe('#ff0000');                          // the family was derived, not copied
  expect(await cssVar(page, '--bg')).toBe(beforeBg);            // the wall he did not touch did not move

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
  expect(txt).not.toBe('#f2ead9');                              // dark ink, not the dark theme's cream
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

test('Save keeps his THREE colours in the shop\'s DATA — they survive a reload and come back on the pickers', async ({ page }) => {
  await openPalette(page);
  await page.locator('#themeName').fill('Dekkan Nour');
  await pick(page, 'brand', '#ff0000');
  await page.locator('#btnThemeSave').click();
  await expect(page.locator('#themeEditor')).toBeHidden();

  const saved = await savedTheme(page);
  expect(saved.id).toBe('own');                                 // HIS theme, not a preset
  expect(saved.name).toBe('Dekkan Nour');
  expect(saved.seeds.brand).toBe('#ff0000');
  expect(Object.keys(saved.seeds).sort()).toEqual(['brand', 'ground', 'money']);

  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  expect(await cssVar(page, '--acc')).toBe('#ff0000');

  await gotoTab(page, '#/settings');
  await page.locator('#btnThemeEdit').click();
  expect(await seedValue(page, 'brand')).toBe('#ff0000');       // he sees his own colour again
  await expect(page.locator('#themeName')).toHaveValue('Dekkan Nour');
  await page.locator('#btnThemeCancel').click();
});

test('NOTHING derived is saved: the 42 tokens stay the engine\'s business, so a preset stays fixable', async ({ page }) => {
  await openPalette(page);
  const onScreen = await cssVar(page, '--acc2');                // a DERIVED accent tone
  await pick(page, 'brand', '#ff0000');
  await page.locator('#btnThemeSave').click();

  const saved = await savedTheme(page);
  expect(saved.tokens).toBeUndefined();                         // a derived value in a file is a lie waiting to drift
  expect(Object.keys(saved)).toHaveLength(3);                   // id, name, seeds — nothing else
  expect(Object.keys(saved.seeds)).toHaveLength(3);             // three colours, not forty-two
  expect(Object.values(saved.seeds)).not.toContain(onScreen);
  expect(await cssVar(page, '--acc2')).not.toBe('#ff0000');     // and the derivation still happened on screen
});

test('"back to the app theme" gives the preset back AND keeps his colours for next time', async ({ page }) => {
  await openPalette(page);
  const presetAcc = await cssVar(page, '--acc');
  await pick(page, 'brand', '#ff0000');
  await page.locator('#btnThemeSave').click();
  expect(await cssVar(page, '--acc')).toBe('#ff0000');

  await page.locator('#btnThemeReset').click();
  await expect(page.locator('#toast')).toContainText(/preset/i);
  expect(await cssVar(page, '--acc')).toBe(presetAcc);          // the app's theme is back

  const saved = await savedTheme(page);
  expect(saved.id).toBe('souk');                                // he CHOSE the app's theme for now
  expect(saved.seeds.brand).toBe('#ff0000');                    // and his own colours are still his

  await page.locator('#btnThemeEdit').click();
  expect(await seedValue(page, 'brand')).toBe('#ff0000');       // one tap on "my theme" brings his shop back
  await page.locator('#btnThemeCancel').click();
});

test('the app\'s own themes are presets: he can CHOOSE one, never edit one — and choosing keeps his colours', async ({ page }) => {
  await open(page, '#/settings');
  await page.locator('#themeGrid [data-theme="mint"]').click();

  const bg = await cssVar(page, '--bg');
  expect(bg).toBe('#06140f');                                   // Midnight Mint, live
  await expect(page.locator('#themeGrid .theme-sw.active')).toContainText('Midnight Mint');

  const saved = await savedTheme(page);
  expect(saved.id).toBe('mint');                                // choosing it DECLARED it
  expect(saved.tokens).toBeUndefined();                         // and wrote nothing into a preset

  await page.locator('#btnThemeEdit').click();
  await expect(page.locator('[data-tok]')).toHaveCount(0);      // still nothing to edit
  await page.locator('#btnThemeCancel').click();

  /* his own colours, then a preset on top: the preset is what the shop wears,
     but his three colours must be waiting when he comes back to them */
  await page.locator('#btnThemeEdit').click();
  await pick(page, 'brand', '#ff0000');
  await page.locator('#btnThemeSave').click();
  await page.locator('#themeGrid [data-theme="mint"]').click();
  expect(await cssVar(page, '--acc')).toBe('#2fce8a');           // mint's accent is not his red
  await page.locator('#btnThemeEdit').click();
  expect(await seedValue(page, 'brand')).toBe('#ff0000');       // his colours survived
  await page.locator('#btnThemeCancel').click();
});

test('Export writes a stand-alone palette file: his name and THREE colours, never the tokens', async ({ page }) => {
  await openPalette(page);
  await page.locator('#themeName').fill('Dekkan Nour');
  await pick(page, 'brand', '#ff0000');
  await page.locator('#btnThemeSave').click();
  await page.locator('#btnThemeShare').click();
  await page.locator('#btnThemeExport').click();

  const json = JSON.parse(await page.locator('#themeJsonText').inputValue());
  expect(json.name).toBe('Dekkan Nour');
  expect(Object.keys(json.seeds).sort()).toEqual(['brand', 'ground', 'money']);
  expect(json.seeds.brand).toBe('#ff0000');
  expect(json.tokens).toBeUndefined();                          // a shared theme is 3 colours and a name
});

test('a pasted theme becomes HIS theme — both the new 3-colour file and a wave 5-6 token file', async ({ page }) => {
  await open(page, '#/settings');
  await page.locator('#btnThemeShare').click();
  await page.locator('#themeJsonText').fill(JSON.stringify({
    name: 'Dekkan Nour', seeds: { brand: '#00ff00', money: '#ffcc00', ground: '#101010' }
  }));
  await page.locator('#btnThemeApply').click();

  expect(await cssVar(page, '--acc')).toBe('#00ff00');
  expect(await cssVar(page, '--bg')).toBe('#101010');
  const saved = await savedTheme(page);
  expect(saved.id).toBe('own');
  expect(saved.name).toBe('Dekkan Nour');
  expect(saved.tokens).toBeUndefined();                         // a shared preset can never be overwritten

  await page.locator('#btnThemeEdit').click();
  expect(await seedValue(page, 'brand')).toBe('#00ff00');       // the pickers tell the truth about it
  await page.locator('#btnThemeCancel').click();

  /* an old token-era file (wave 5-6) is converted, not refused: the same three
     colours come out of the tokens it used to drive */
  await page.locator('#btnThemeShare').click();                 // opening the editor closed this panel
  await page.locator('#themeJsonText').fill(JSON.stringify({ id: 'royal', tokens: { '--acc': '#cc9a3f' } }));
  await page.locator('#btnThemeApply').click();
  expect(await cssVar(page, '--acc')).toBe('#cc9a3f');
  const converted = await savedTheme(page);
  expect(converted.id).toBe('own');
  expect(converted.seeds.brand).toBe('#cc9a3f');

  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  expect(await cssVar(page, '--acc')).toBe('#cc9a3f');
});

test('nonsense JSON is refused, with the reason, and changes nothing', async ({ page }) => {
  await open(page, '#/settings');
  const before = await cssVar(page, '--acc');
  await page.locator('#btnThemeShare').click();

  await page.locator('#themeJsonText').fill('{not json');
  await page.locator('#btnThemeApply').click();
  await expect(page.locator('#themeMsg')).toContainText(/json/i);

  await page.locator('#themeJsonText').fill(JSON.stringify({ name: 'Nothing to wear' }));
  await page.locator('#btnThemeApply').click();
  await expect(page.locator('#themeMsg')).toContainText(/seeds are required/);

  await page.locator('#themeJsonText').fill(JSON.stringify({
    seeds: { brand: 'gold-ish', money: '#00ff00', ground: '#000000', party: '#ffffff' }
  }));
  await page.locator('#btnThemeApply').click();
  await expect(page.locator('#themeMsg')).toContainText('brand');

  expect(await cssVar(page, '--acc')).toBe(before);
  await expectNoThemeKept(page);
});

test('the palette is the SHOP\'s, not the device\'s: it lands in the shop\'s data', async ({ page }) => {
  await openPalette(page);
  await pick(page, 'money', '#00d0ff');
  await page.locator('#btnThemeSave').click();
  await gotoTab(page, '#/settings');
  const raw = await page.evaluate(() => localStorage.getItem('dekkan.v1'));
  expect(JSON.parse(raw).custom.theme.seeds.money).toBe('#00d0ff');
});
