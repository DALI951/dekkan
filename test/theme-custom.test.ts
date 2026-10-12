// @ts-nocheck
// JS -> TS migration (first pass): a vm sandbox with loose globals.
/* DEKKAN themes, wave 2 — the CUSTOM theme editor's engine contract.
 * (docs/customize-plan.md B.4 wave 2, "the demo-worthy one": all 41 tokens
 * already exist, so this wave is validation + a screen, not new styling.)
 *
 * RED-first: written before any of it existed.
 *
 * The contract:
 *   * a theme = { id, nameKey, preview, tokens } and EVERY theme carries exactly
 *     the 41 base tokens — the same rule test/themes.test.ts already enforces,
 *     now enforced by the engine itself, at runtime, for themes that arrive as
 *     JSON from a shopkeeper's clipboard.
 *   * an IMPORT is untrusted text: bad JSON, an unknown base theme, an unknown
 *     token, a non-color value and a non-object are all REFUSED BY NAME, and a
 *     refusal changes nothing (the current theme keeps painting).
 *   * a shop's own colors are OVERRIDES on a base theme ({id, tokens}) — not a
 *     separate "custom" theme — so a shop that tweaks two tokens still inherits
 *     every future fix to its base.
 *   * an override that cannot be read is IGNORED on load (a shop must never open
 *     into an unreadable screen) but REFUSED on write (a typo must not be saved
 *     silently).
 *   * localStorage stays a no-flash CACHE of the state's choice: the head script
 *     applies the right colors before the first paint; the state is authoritative.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripTypeScriptTypes } = require('module');

const ROOT = path.join(__dirname, '..');

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

// ---------- a shop's own colors are overrides ----------

test('applyTheme({id, tokens}) paints the base theme, then the shop\'s overrides', () => {
  const { Themes, applied } = boot();
  const res = Themes.applyTheme({ id: 'mint', tokens: { '--acc': '#ff0000' } });
  assert.strictEqual(res.id, 'mint', 'the effective theme is reported back');
  assert.strictEqual(res.overrides, 1, 'and how many overrides were applied');
  assert.strictEqual(applied['--acc'], '#ff0000', 'the override wins');
  assert.strictEqual(applied['--bg'], Themes.get('mint').tokens['--bg'], 'everything else comes from the base');
});

test('applyTheme IGNORES an override that cannot be read (a phone must never open unreadable)', () => {
  const { Themes, applied } = boot();
  const res = Themes.applyTheme({ id: 'royal', tokens: { '--acc': 'not-a-color', '--nope': '#fff', '--txt': '#00ff00' } });
  assert.strictEqual(applied['--acc'], Themes.get('royal').tokens['--acc'], 'a bad color falls back to the base color');
  assert.strictEqual(applied['--txt'], '#00ff00', 'a good override still applies');
  assert.strictEqual(res.overrides, 1, 'only the readable override counts');
  assert.strictEqual(res.ignored.length, 2, 'and what was ignored is reported, not silent');
});

test('applyTheme with an unknown or missing base falls back to the default theme', () => {
  const { Themes } = boot();
  assert.strictEqual(Themes.applyTheme({ id: 'no-such-theme', tokens: {} }).id, 'souk');
  assert.strictEqual(Themes.applyTheme(null).id, 'souk');
  assert.strictEqual(Themes.applyTheme({ id: 'souk', tokens: 'nope' }).id, 'souk', 'a token blob that is not an object is not a crash');
});

test('preview() paints live WITHOUT saving; revert() puts the shop\'s theme back', () => {
  const { Themes, applied, store } = boot();
  Themes.applyTheme({ id: 'souk', tokens: { '--acc': '#111111' } });
  Themes.preview({ '--acc': '#abcdef' });
  assert.strictEqual(applied['--acc'], '#abcdef', 'the preview is on screen');
  assert.strictEqual(store['dekkan.theme'], 'souk', 'previewing does NOT persist a choice');
  assert.strictEqual(store['dekkan.themetokens'], JSON.stringify({ '--acc': '#111111' }), 'and does not touch the cache');
  Themes.revert();
  assert.strictEqual(applied['--acc'], '#111111', 'revert restores the saved overrides');
});

// ---------- the no-flash cache (state is authoritative, storage is the cache) ----------

test('applyTheme caches the choice for index.html\'s pre-paint script', () => {
  const { Themes, store } = boot();
  Themes.applyTheme({ id: 'royal', tokens: { '--acc': '#00ff00' } });
  assert.strictEqual(store['dekkan.theme'], 'royal');
  assert.strictEqual(JSON.parse(store['dekkan.themetokens'])['--acc'], '#00ff00');
});

test('restore() brings back the cached choice with its overrides (what the head script calls)', () => {
  const { Themes, applied } = boot();
  Themes.applyTheme({ id: 'royal', tokens: { '--acc': '#00ff00' } });
  const fresh = boot({ 'dekkan.theme': 'royal', 'dekkan.themetokens': JSON.stringify({ '--acc': '#00ff00' }) });
  fresh.Themes.restore();
  assert.strictEqual(fresh.Themes.current().id, 'royal', 'the cached base is restored');
  assert.strictEqual(fresh.applied['--acc'], '#00ff00', 'and its overrides with it');
});

test('restore() survives a corrupted cache instead of painting nothing', () => {
  const broken = boot({ 'dekkan.theme': 'royal', 'dekkan.themetokens': '{not json' });
  broken.Themes.restore();
  assert.strictEqual(broken.Themes.current().id, 'royal', 'the base still applies');
  assert.strictEqual(broken.applied['--bg'], broken.Themes.get('royal').tokens['--bg'], 'and the screen is still readable');
});

// ---------- export / import ----------

test('exportTheme() gives JSON a shopkeeper can copy, edit and share', () => {
  const { Themes } = boot();
  const json = Themes.exportTheme({ id: 'souk', tokens: { '--acc': '#ff0000' } });
  const back = JSON.parse(json);
  assert.strictEqual(back.id, 'souk');
  assert.strictEqual(back.tokens['--acc'], '#ff0000');
  assert.ok(typeof back.name === 'string' && back.name.length, 'a shared theme carries a human name');
  assert.ok(back.tokens['--bg'], 'and the WHOLE token set, so it stands alone');
});

test('export → import round-trips the shop\'s own colors', () => {
  const { Themes } = boot();
  const json = Themes.exportTheme({ id: 'mint', tokens: { '--acc': '#ff0000', '--panel': '#0a0a0a' } });
  const res = Themes.importTheme(json);
  assert.strictEqual(res.ok, true, 'a valid export is accepted');
  assert.strictEqual(res.theme.id, 'mint');
  assert.strictEqual(res.theme.tokens['--acc'], '#ff0000');
});

test('importTheme REFUSES untrusted text by name, and changes nothing', () => {
  const { Themes, store } = boot();
  Themes.applyTheme({ id: 'souk', tokens: {} });

  const cases = [
    ['{not json', /json/i],
    ['[]', /theme|object/i],
    ['{"id":"no-such-base","tokens":{}}', /base|unknown/i],
    ['{"id":"souk","tokens":{"--acc":"#fff","--nope":"#fff"}}', /--nope/],
    ['{"id":"souk","tokens":{"--acc":"gold-ish"}}', /--acc/],
    ['{"id":"souk","tokens":"nope"}', /tokens/i],
    ['{"id":"souk"}', /tokens/i]
  ];
  cases.forEach(([text, re]) => {
    const res = Themes.importTheme(text);
    assert.strictEqual(res.ok, false, 'must be refused: ' + text);
    assert.match(res.problems.join(' | '), re, 'the refusal names the problem: ' + text);
  });
  assert.strictEqual(Themes.current().id, 'souk', 'no refusal changed the current theme');
  assert.strictEqual(store['dekkan.theme'], 'souk');
});

test('importTheme accepts a PARTIAL token set (inherit the base, override the rest)', () => {
  const { Themes } = boot();
  const res = Themes.importTheme('{"id":"royal","tokens":{"--acc":"#abcdef"}}');
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.theme.tokens['--acc'], '#abcdef');
});

test('checkTokens splits a bag into paintable values and unreadable ones (one verdict for engine + screen)', () => {
  const { Themes } = boot();
  const r = Themes.checkTokens({ '--acc': '#ff0000', '--nope': '#fff', '--txt': '', '--bg': 'rgb(1,2,3)', '--shadow': '0 2px 4px rgba(0,0,0,.4)' });
  assert.deepStrictEqual(Object.keys(r.good).sort(), ['--acc', '--bg', '--shadow']);
  assert.deepStrictEqual(Array.from(r.ignored).sort(), ['--nope', '--txt']);
  assert.strictEqual(JSON.stringify(Themes.checkTokens('nope')), '{"good":{},"ignored":[]}', 'junk in, nothing out — never a crash');
});

// ---------- the state side (core): the shop's colors are DATA ----------

test('a fresh shop declares the default theme, and the gate accepts it', () => {
  const s = CORE.createShop({});
  assert.deepStrictEqual(s.custom.theme, { id: 'souk', tokens: {} });
  assert.deepStrictEqual(CORE.customProblems(s.custom), []);
});

test('the gate refuses a theme block that is not a theme (and names it)', () => {
  const mk = (theme) => { const c = CORE.defaultCustom(); c.theme = theme; return CORE.customProblems(c); };
  assert.ok(mk({ id: '', tokens: {} }).some((p) => /theme\.id/.test(p)), 'an empty id');
  assert.ok(mk({ id: 'souk', tokens: { acc: '#fff' } }).some((p) => /--/.test(p)), 'a token that is not a CSS custom property');
  assert.ok(mk({ id: 'souk', tokens: { '--acc': 123 } }).some((p) => /theme\.tokens/.test(p)), 'a non-string value');
  assert.ok(mk({ id: 'souk', tokens: 'nope' }).some((p) => /theme\.tokens/.test(p)), 'tokens must be an object');
  assert.ok(mk({ id: 'souk', tokens: {}, extra: 1 }).some((p) => /theme/.test(p)), 'an unknown key inside theme');
  assert.ok(mk('souk').some((p) => /theme/.test(p)), 'theme must be an object');
  assert.deepStrictEqual(CORE.customProblems(CORE.defaultCustom()), [], 'the defaults stay clean');
});

test('setCustom merges a theme patch, and repairs a broken block on load', () => {
  let s = CORE.createShop({});
  s = CORE.setCustom(s, { theme: { id: 'mint', tokens: { '--acc': '#ff0000' } } });
  assert.strictEqual(s.custom.theme.id, 'mint');
  assert.strictEqual(s.custom.theme.tokens['--acc'], '#ff0000');
  assert.throws(() => CORE.setCustom(s, { theme: { id: 'mint', tokens: { bad: '#fff' } } }), /custom:/, 'a typo is refused');
  const broken = CORE.createShop({});
  broken.custom.theme = { id: 42, tokens: 'nope' };
  const fixed = CORE.ensureCustomState(broken);
  assert.deepStrictEqual(fixed.custom.theme, { id: 'souk', tokens: {} }, 'an unreadable theme falls back to the default');
});
