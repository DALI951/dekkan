// @ts-nocheck
// JS -> TS migration (first pass): a vm sandbox with loose globals.
/* DEKKAN themes, wave 2 — the theme REGISTRY contract. Wave 2's token editor is DEAD.
 *
 * History, so nobody "fixes" this file the wrong way: wave 2 let a shopkeeper edit
 * all 42 tokens one by one and stored them as OVERRIDES on one of the app's own
 * themes (`{id, tokens}`). Wave 5 asked three colours instead. Wave 7 (2026-10-13)
 * REVERSED the override model outright — Dali's words: "i want the user to be able
 * to create his own theme using any 3 colors and as i said no one can be able to
 * change the default themes". So:
 *
 *   * a preset is READ-ONLY (a token handed to the engine is ignored, and named),
 *   * the shop's own theme is `{id:'own', name, seeds}` — three colours, derived out,
 *   * a save from the token era is MIGRATED into that own theme, never re-edited.
 *
 * The contract for all of that lives in test/theme-own.test.ts. What is left HERE is
 * what never changed: the engine validates every theme OBJECT at runtime (a theme
 * that arrives as JSON from a shopkeeper's clipboard is untrusted), and core owns the
 * shape of the shop's theme BLOCK as data.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripTypeScriptTypes } = require('module');

const ROOT = path.join(__dirname, '..');

// themes.ts is a plain UMD file: it loads in a browser and in a vm sandbox with a
// document + localStorage, which is how the engine gets exercised without a browser.
function boot(store) {
  store = store || {};
  const applied = {};
  const doc = {
    documentElement: { style: { setProperty: (k, v) => { applied[k] = v; } } },
    dispatchEvent() {}
  };
  const sandbox = {
    console,
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; }
    },
    document: doc,
    CustomEvent: function (t, o) { this.type = t; this.detail = o && o.detail; }
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(stripTypeScriptTypes(fs.readFileSync(path.join(ROOT, 'ui', 'themes.ts'), 'utf8')), sandbox, { filename: 'ui/themes.ts' });
  const T = sandbox.DEK.Themes;
  return { Themes: T, THEMES: sandbox.DEK.THEMES, BASE: sandbox.DEK.BASE, applied, store };
}

const FULL = (over) => {
  const { BASE } = boot();
  const t = {};
  BASE.forEach((k) => { t[k] = /shadow$/.test(k) ? '0 12px 32px rgba(0,0,0,.45)' : '#123456'; });
  return Object.assign(t, over || {});
};

const CORE = require('../core/dekkan-core.ts');

// ---------- the theme contract, enforced at runtime ----------

test('every registered theme still passes the engine\'s own validation', () => {
  const { Themes } = boot();
  Themes.all().forEach((t) => {
    assert.ok(Themes.problems(t).length === 0, t.id + ' must be valid: ' + JSON.stringify(Themes.problems(t)));
  });
});

test('problems() names what is wrong with a theme (missing, extra, bad color, no name, no preview)', () => {
  const { Themes, BASE } = boot();
  const good = { id: 'xe', nameKey: 'theme.x', preview: ['#000000', '#111111', '#222222'], tokens: FULL() };
  assert.strictEqual(Themes.problems(good).length, 0, 'a complete theme is valid');

  const miss = { id: 'xe', nameKey: 'theme.x', preview: good.preview, tokens: FULL() };
  delete miss.tokens['--acc'];
  assert.ok(Themes.problems(miss).some((p) => /missing/.test(p)), 'a missing token must be named');

  const extra = { id: 'xe', nameKey: 'theme.x', preview: good.preview, tokens: FULL({ '--nope': '#ffffff' }) };
  assert.ok(Themes.problems(extra).some((p) => /unknown token/.test(p)), 'an extra token must be named');

  const badColor = { id: 'xe', nameKey: 'theme.x', preview: good.preview, tokens: FULL({ '--acc': 'gold-ish' }) };
  assert.ok(Themes.problems(badColor).some((p) => /--acc/.test(p)), 'a bad color must be named');

  const noName = { id: 'xe', preview: good.preview, tokens: FULL() };
  assert.ok(Themes.problems(noName).length > 0, 'a theme needs a name (nameKey)');

  const noPreview = { id: 'xe', nameKey: 'theme.x', tokens: FULL() };
  assert.ok(Themes.problems(noPreview).length > 0, 'a theme needs a 3-colour preview');

  assert.ok(Themes.problems(null).length > 0, 'null is not a theme');
  assert.ok(Themes.problems('souk').length > 0, 'a string is not a theme');
  assert.strictEqual(BASE.length, 42, 'the base token list is the full token set (42 — the plan doc\'s "41" was off by one)');
});

test('add(): one theme = one object, and a bad or duplicate one is refused loudly', () => {
  const { Themes } = boot();
  const before = Themes.all().length;
  const neo = { id: 'neo', nameKey: 'theme.neo', preview: ['#000000', '#111111', '#222222'], tokens: FULL({ '--acc': '#ff00ff' }) };
  Themes.add(neo);
  assert.strictEqual(Themes.all().length, before + 1, 'the new theme is listed (the Settings grid builds from this)');
  assert.strictEqual(Themes.get('neo').tokens['--acc'], '#ff00ff', 'it carries its own colors');

  assert.throws(() => Themes.add(neo), /already registered/i, 'a duplicate id is refused');
  assert.throws(() => Themes.add({ id: 'bad', tokens: {} }), /theme refused/i, 'a malformed theme is refused');
  assert.strictEqual(Themes.all().length, before + 1, 'a refusal registers nothing');
});

test('the app\'s own themes are the first three, and the shop\'s own theme is the fourth', () => {
  const { Themes } = boot();
  const ids = Themes.all().map((t) => t.id);
  assert.deepStrictEqual(Array.from(ids), ['souk', 'mint', 'royal', 'own'], 'three presets, then the shop\'s own');
  assert.strictEqual(Themes.get('own').own, true, 'and it is the only one flagged as the shop\'s own');
});

// ---------- applyTheme with an unknown or missing base ----------

test('applyTheme with an unknown or missing base falls back to the default theme', () => {
  const { Themes } = boot();
  assert.strictEqual(Themes.applyTheme({ id: 'no-such-theme', seeds: {} }).id, 'souk');
  assert.strictEqual(Themes.applyTheme(null).id, 'souk');
  assert.strictEqual(Themes.applyTheme({ id: 'souk', seeds: 'nope' }).id, 'souk', 'a seed blob that is not an object is not a crash');
});

test('checkTokens splits a bag into paintable values and unreadable ones (one verdict for engine + screen)', () => {
  const { Themes } = boot();
  const r = Themes.checkTokens({ '--acc': '#ff0000', '--nope': '#fff', '--txt': '', '--bg': 'rgb(1,2,3)', '--shadow': '0 2px 4px rgba(0,0,0,.4)' });
  assert.deepStrictEqual(Object.keys(r.good).sort(), ['--acc', '--bg', '--shadow']);
  assert.deepStrictEqual(Array.from(r.ignored).sort(), ['--nope', '--txt']);
  assert.strictEqual(JSON.stringify(Themes.checkTokens('nope')), '{"good":{},"ignored":[]}', 'junk in, nothing out — never a crash');
});

// ---------- the state side (core): the shop's theme is DATA ----------

test('a fresh shop declares the default theme, owns no colours, and the gate accepts it', () => {
  const s = CORE.createShop({});
  assert.deepStrictEqual(s.custom.theme, { id: 'souk', name: '', seeds: {} });
  assert.deepStrictEqual(CORE.customProblems(s.custom), []);
});

test('the gate refuses a theme block that is not a theme (and names it)', () => {
  const mk = (theme) => { const c = CORE.defaultCustom(); c.theme = theme; return CORE.customProblems(c); };
  assert.ok(mk({ id: '', name: '', seeds: {} }).some((p) => /theme\.id/.test(p)), 'an empty id');
  assert.ok(mk({ id: 'souk', name: '', seeds: 'nope' }).some((p) => /theme\.seeds/.test(p)), 'seeds must be an object');
  assert.ok(mk({ id: 'souk', name: '', seeds: { brand: 123 } }).some((p) => /seeds\.brand/.test(p)), 'a non-string colour');
  assert.ok(mk({ id: 'souk', name: '', seeds: { blue: '#0000ff' } }).some((p) => /seeds\.blue/.test(p)), 'a colour the shop does not own');
  assert.ok(mk({ id: 'souk', name: 'x'.repeat(25), seeds: {} }).some((p) => /theme\.name/.test(p)), 'a name that is not a name');
  assert.ok(mk({ id: 'souk', name: '', seeds: {}, extra: 1 }).some((p) => /theme/.test(p)), 'an unknown key inside theme');
  assert.ok(mk({ id: 'own', name: '', seeds: {} }).some((p) => /brand, money and ground/.test(p)), '"my own theme" with no colours at all');
  assert.ok(mk('souk').some((p) => /theme/.test(p)), 'theme must be an object');
  assert.deepStrictEqual(CORE.customProblems(CORE.defaultCustom()), [], 'the defaults stay clean');
});

test('setCustom merges a theme patch, and repairs a broken block on load', () => {
  let s = CORE.createShop({});
  s = CORE.setCustom(s, { theme: { id: 'own', name: 'Dekkanet Nour', seeds: { brand: '#ff0000', money: '#00ff00', ground: '#101318' } } });
  assert.strictEqual(s.custom.theme.id, 'own');
  assert.strictEqual(s.custom.theme.name, 'Dekkanet Nour');
  assert.strictEqual(s.custom.theme.seeds.brand, '#ff0000');
  assert.throws(() => CORE.setCustom(s, { theme: { id: 'mint', seeds: { blue: '#0000ff' } } }), /custom:/, 'a typo is refused');
  assert.throws(() => CORE.setCustom(s, { theme: { id: 'mint', tokens: {} } }), /custom:/, 'the token era is gone: that key is not a setting');

  const broken = CORE.createShop({});
  broken.custom.theme = { id: 42, name: 7, seeds: 'nope' };
  const fixed = CORE.ensureCustomState(broken);
  assert.deepStrictEqual(fixed.custom.theme, { id: 'souk', name: '', seeds: {} }, 'an unreadable theme falls back to the default');
});

test('a shop that picked one colour keeps it: the engine fills the rest at paint time', () => {
  const { Themes, applied } = boot();
  Themes.applyTheme({ id: 'own', seeds: { brand: '#ff0000' } });
  assert.strictEqual(applied['--acc'], '#ff0000', 'the colour he chose');
  assert.strictEqual(applied['--bg'], Themes.get('souk').tokens['--bg'], 'and the app\'s own walls behind it');
});
