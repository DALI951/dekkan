// @ts-nocheck
/* DEKKAN themes, wave 7 — THE SHOP'S OWN THEME (a theme he OWNS, not a preset he edits).
 *
 * Dali's words (2026-10-13): "i need you to change how you did the theme engine i want
 * the user to be able to create his own theme using any 3 colors and as i said no one
 * can be able to change the default themes".
 *
 * What wave 5 got wrong: his three colours were stored as OVERRIDES on top of one of the
 * app's own themes (`{id:'souk', tokens:{'--acc':'#ff0000'}}`), which means (a) the app's
 * own themes WERE editable — the exact thing he forbade — and (b) his look was hostage to
 * the preset: pick another preset and his colours were gone.
 *
 * The wave 7 contract this file locks:
 *   * the app's own themes (souk / mint / royal) are READ-ONLY: a token handed to the
 *     engine for a preset is IGNORED and NAMED. There is no code path that can move a
 *     pixel of a preset.
 *   * 'own' is a real theme in the list (a 4th card), built from ANY three colours via
 *     palette(); his wall is EXACTLY the colour he picked.
 *   * the state stores `{id, name, seeds}` — the three colours, never the derived tokens
 *     (a derived value stored is a derived value that drifts). Choosing a preset KEEPS
 *     his own theme, so he can come back to it.
 *   * a save from wave 5-6 (`{id, tokens}`) is MIGRATED to the equivalent own theme: no
 *     shop loses the look it has, and the preset it used to lean on stays pristine.
 *   * the cache in localStorage follows (its only job is to paint before the first
 *     paint).
 *
 * RED-first: written before any of it exists.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripTypeScriptTypes } = require('module');

const ROOT = path.join(__dirname, '..');
const D = require('../core/dekkan-core.ts');

const plain = (o) => JSON.parse(JSON.stringify(o));
const MINES = { brand: '#3b82f6', money: '#22c55e', ground: '#101318' };
const SOUK = { brand: '#e8b04b', money: '#e8b04b', ground: '#0e0c0a' };

function bootThemes(store) {
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
  return { Themes: sandbox.DEK.Themes, BASE: sandbox.DEK.BASE, applied, store };
}

const T = bootThemes().Themes;
const BASE = bootThemes().BASE;

// ---------- a preset is not editable. Not by JSON, not by state, not by anything ----------

test('a preset is READ-ONLY: tokens handed to the engine are ignored, and named', () => {
  const { Themes, applied } = bootThemes();
  const res = Themes.applyTheme({ id: 'souk', tokens: { '--acc': '#ff0000', '--bg': '#ffffff' } });
  assert.strictEqual(applied['--acc'], '#e8b04b', 'the preset keeps its own accent');
  assert.strictEqual(applied['--bg'], '#0e0c0a', 'and its own wall');
  assert.deepStrictEqual(Array.from(res.ignored).sort(), ['--acc', '--bg'], 'and it says what it refused');
  assert.strictEqual(Themes.isCustomized(), false, 'nothing about a preset is "customized"');
});

test('every preset paints exactly its own token set, whatever is handed in', () => {
  const { Themes, applied } = bootThemes();
  Themes.all().forEach((th) => {
    if (th.id === 'own') return;
    Object.keys(applied).forEach((k) => { delete applied[k]; });
    Themes.applyTheme({ id: th.id, tokens: { '--acc': '#123456' }, seeds: { brand: '#123456', money: '#123456', ground: '#123456' } });
    assert.strictEqual(applied['--acc'], th.tokens['--acc'], th.id + ' paints its own accent');
    assert.strictEqual(applied['--bg'], th.tokens['--bg'], th.id + ' paints its own wall');
  });
});

test('the app\'s own themes never appear as editable — no preset carries an "own" flag', () => {
  const { Themes } = bootThemes();
  Themes.all().forEach((th) => {
    if (th.id === 'own') { assert.strictEqual(th.own, true, 'the shop\'s own theme is the only one flagged'); return; }
    assert.ok(!th.own, th.id + ' is a preset, not a theme the shop owns');
  });
});

// ---------- his own theme: any three colours, exactly his wall ----------

test('any three colours build his whole shop — and his wall is EXACTLY the colour he picked', () => {
  const { Themes, applied } = bootThemes();
  Themes.applyTheme({ id: 'own', seeds: MINES });
  assert.strictEqual(Themes.currentId(), 'own');
  assert.strictEqual(applied['--bg'], MINES.ground, 'his wall, untouched');
  assert.strictEqual(applied['--coin2'], MINES.money, 'his money, untouched');
  assert.strictEqual(applied['--acc'], MINES.brand, 'a brand colour that can be read on his wall comes out as he picked it');
  assert.strictEqual(Object.keys(applied).sort().join(','), BASE.slice().sort().join(','), 'the whole token set, no more, no less');
});

test('a wall so light it would blind the text still gets read (the engine decides, not the picker)', () => {
  const { Themes, applied } = bootThemes();
  Themes.applyTheme({ id: 'own', seeds: { brand: '#ff0000', money: '#ffcc00', ground: '#ffffff' } });
  assert.strictEqual(applied['--bg'], '#ffffff', 'still his wall');
  assert.notStrictEqual(applied['--txt'], '#ffffff', 'the text on it had to move');
  assert.match(applied['--txt'], /^#[0-9a-f]{6}$/);
});

test('a brand colour that is invisible on his wall is nudged, never silently dropped', () => {
  const { Themes, applied } = bootThemes();
  Themes.applyTheme({ id: 'own', seeds: { brand: '#101318', money: '#22c55e', ground: '#101318' } });
  assert.ok(Themes.contrast(applied['--acc'], applied['--bg']) >= 3, 'the accent can be seen on the wall');
  assert.strictEqual(applied['--coin2'], '#22c55e', 'and nothing else moved');
});

test('junk in the seeds falls back to the app\'s own three colours — his shop never breaks', () => {
  const { Themes, applied } = bootThemes();
  Themes.applyTheme({ id: 'own', seeds: { brand: 'gold-ish', money: null, ground: 42 } });
  assert.strictEqual(applied['--bg'], SOUK.ground);
  assert.strictEqual(applied['--coin2'], SOUK.money);
  assert.strictEqual(applied['--acc'], SOUK.brand);
});

// ---------- his theme is his, even while he looks at a preset ----------

test('choosing a preset keeps HIS theme: the three colours survive the trip', () => {
  const { Themes, applied, store } = bootThemes();
  const res = Themes.applyTheme({ id: 'mint', seeds: MINES });
  assert.strictEqual(applied['--bg'], '#06140f', 'the shop wears Midnight Mint now');
  assert.deepStrictEqual(plain(res.seeds), MINES, 'and his own three colours came back with the answer');
  assert.strictEqual(Themes.seeds().ground, MINES.ground, 'the engine still knows his own theme');
  assert.strictEqual(JSON.parse(store['dekkan.themeseeds']).brand, MINES.brand, 'the no-flash cache carries them too');
});

test('and picking "own" again puts his shop back, colour for colour', () => {
  const { Themes, applied } = bootThemes();
  Themes.applyTheme({ id: 'souk', seeds: MINES });
  Themes.applyTheme({ id: 'own', seeds: Themes.seeds() });
  assert.strictEqual(applied['--bg'], MINES.ground);
  assert.strictEqual(applied['--coin2'], MINES.money);
});

// ---------- the no-flash cache ----------

test('the cache paints his own theme before the app boots (no flash of a preset)', () => {
  const store = {};
  const first = bootThemes(store);
  first.Themes.applyTheme({ id: 'own', seeds: MINES });
  const second = bootThemes(store);              // a NEW page load, same browser storage
  second.Themes.restore();
  assert.strictEqual(second.applied['--bg'], MINES.ground, 'the head script already knew');
  assert.strictEqual(second.applied['--coin2'], MINES.money);
});

test('an old (wave 5-6) cache still paints the shopkeeper\'s own colour on the first paint', () => {
  const store = { 'dekkan.theme': 'souk', 'dekkan.themetokens': JSON.stringify({ '--acc': '#ff0000', '--bg': '#101318' }) };
  const { Themes, applied } = bootThemes(store);
  Themes.restore();
  assert.strictEqual(applied['--bg'], '#101318', 'his wall came back');
  assert.strictEqual(applied['--acc'], '#ff0000', 'and so did his brand colour');
});

// ---------- export / import: a theme is a file he can hand to another shop ----------

test('export writes HIS three colours (not 42 derived tokens a shopkeeper cannot read)', () => {
  const { Themes } = bootThemes();
  const json = JSON.parse(Themes.exportTheme('Dekkanet Nour', MINES));
  assert.strictEqual(json.name, 'Dekkanet Nour');
  assert.deepStrictEqual(json.seeds, MINES);
  assert.ok(!json.tokens, 'the derived tokens are not exported: they are derived');
});

test('import accepts his three colours and hands them back for review', () => {
  const { Themes } = bootThemes();
  const res = Themes.importTheme(JSON.stringify({ name: 'Cafe Vert', seeds: MINES }));
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.name, 'Cafe Vert');
  assert.deepStrictEqual(plain(res.seeds), MINES);
});

test('import still accepts a wave 5-6 file (tokens), and converts it to the same three colours', () => {
  const { Themes } = bootThemes();
  const res = Themes.importTheme(JSON.stringify({ id: 'souk', tokens: { '--acc': '#ff0000', '--coin2': '#00ff00', '--bg': '#101318' } }));
  assert.strictEqual(res.ok, true, 'an old file is not thrown away');
  assert.deepStrictEqual(plain(res.seeds), { brand: '#ff0000', money: '#00ff00', ground: '#101318' });
});

test('import REFUSES nonsense by name, and changes nothing', () => {
  const { Themes, store } = bootThemes();
  Themes.applyTheme({ id: 'souk', seeds: MINES });
  const cases = [
    ['{not json', /json/i],
    ['[]', /theme|object/i],
    ['{"name":"x"}', /seed/i],
    ['{"seeds":{"brand":"gold-ish","money":"#00ff00","ground":"#101318"}}', /brand/],
    ['{"seeds":{"brand":"#ff0000","money":"#00ff00"}}', /ground/],
    ['{"seeds":{"brand":"#ff0000","money":"#00ff00","ground":"#101318","extra":"#ffffff"}}', /extra/]
  ];
  cases.forEach(([text, re]) => {
    const res = Themes.importTheme(text);
    assert.strictEqual(res.ok, false, 'must be refused: ' + text);
    assert.match(res.problems.join(' | '), re, 'the refusal names the problem: ' + text);
  });
  assert.strictEqual(Themes.currentId(), 'souk', 'no refusal changed the current theme');
  assert.strictEqual(JSON.parse(store['dekkan.themeseeds']).brand, MINES.brand, 'and his own colours are untouched');
});

test('seedsOf() tells the truth about what the pickers must show', () => {
  const { Themes } = bootThemes();
  assert.deepStrictEqual(plain(Themes.seedsOf('souk', {})), SOUK, 'a preset shows its own three colours');
  assert.deepStrictEqual(plain(Themes.seedsOf('own', MINES)), MINES, 'his own theme shows his own three colours');
  assert.deepStrictEqual(plain(Themes.seedsOf('own', null)), SOUK, 'an empty own theme falls back to the app\'s colours');
});

// ---------- the state side (core): the shop's theme is DATA ----------

test('a fresh shop declares an app theme and owns no colours yet', () => {
  const c = D.defaultCustom();
  assert.strictEqual(c.theme.id, 'souk');
  assert.strictEqual(c.theme.name, '');
  assert.deepStrictEqual(c.theme.seeds, {});
});

test('core accepts a good own theme and refuses a bad one BY NAME', () => {
  const good = D.setCustom(D.createShop({}), { theme: { id: 'own', name: 'Dekkanet Nour', seeds: MINES } });
  assert.deepStrictEqual(good.custom.theme, { id: 'own', name: 'Dekkanet Nour', seeds: MINES });

  const cases = [
    ['seeds.brand must be a #rrggbb colour', { theme: { id: 'own', seeds: { brand: 'gold-ish', money: '#00ff00', ground: '#101318' } } }],
    ['seeds.extra is not a colour the shop owns', { theme: { id: 'own', seeds: { brand: '#ff0000', money: '#00ff00', ground: '#101318', extra: '#ffffff' } } }],
    ['theme.name is too long', { theme: { id: 'own', name: 'x'.repeat(25), seeds: MINES } }]
  ];
  cases.forEach(([why, patch]) => {
    assert.throws(() => D.setCustom(D.createShop({}), patch), new RegExp(why.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'must refuse: ' + why);
  });
});

test('a save from the token era MIGRATES to the equivalent own theme (nobody loses their shop)', () => {
  const legacy = { theme: { id: 'souk', tokens: { '--acc': '#ff0000', '--coin2': '#00ff00', '--bg': '#101318' } } };
  const state = D.createShop({});
  state.custom = JSON.parse(JSON.stringify(Object.assign({}, state.custom, legacy)));
  const s = D.restoreState(state);
  assert.deepStrictEqual(s.custom.theme, { id: 'own', name: '', seeds: { brand: '#ff0000', money: '#00ff00', ground: '#101318' } });
  assert.strictEqual(s.custom.theme.tokens, undefined, 'the derived tokens are not carried around any more');
});

test('a save that declares the own theme with NO colours falls back to an app theme', () => {
  const state = D.createShop({});
  state.custom = Object.assign({}, state.custom, { theme: { id: 'own', name: 'x', seeds: {} } });
  const s = D.restoreState(state);
  assert.strictEqual(s.custom.theme.id, 'souk', 'a shop never opens into a theme that does not exist');
  assert.deepStrictEqual(s.custom.theme.seeds, {});
});

test('the repair keeps a readable seed and drops the junk around it', () => {
  const state = D.createShop({});
  state.custom = Object.assign({}, state.custom, { theme: { id: 'own', name: 7, seeds: { brand: '#ff0000', money: 'nope', ground: '#101318', extra: '#ffffff' } } });
  const s = D.restoreState(state);
  assert.deepStrictEqual(s.custom.theme, { id: 'own', name: '', seeds: { brand: '#ff0000', ground: '#101318' } },
    'the two colours he really chose survive; what cannot be read is not invented');
});

test('a state that carries a theme the app has never heard of still opens', () => {
  const state = D.createShop({});
  state.custom = Object.assign({}, state.custom, { theme: { id: 'neon-2077', name: '', seeds: MINES } });
  const s = D.restoreState(state);
  assert.strictEqual(s.custom.theme.id, 'neon-2077', 'core does not police which themes exist — the engine falls back');
  const { Themes, applied } = bootThemes();
  Themes.applyTheme(s.custom.theme);
  assert.strictEqual(applied['--bg'], SOUK.ground, 'and the screen falls back to the app\'s own theme');
});
