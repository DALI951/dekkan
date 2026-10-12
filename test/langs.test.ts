// @ts-nocheck
// JS -> TS migration (first pass): a vm sandbox with loose globals.
/* DEKKAN languages tests — the language registry contract (the twin of test/themes.test.ts).
 *
 * Why this file exists: adding a language must be ONE object, and the engine must
 * refuse anything malformed or out of parity with the base language. Before the
 * engine, a language was a `=== 'ar' ? AR : EN` branch hidden in the facade — the
 * exact shape that made a third language a refactor instead of a data change.
 *
 * Contract under test (ui/langs.ts):
 *   a language = { id, name, native, dir, keys }
 *   add()  — refuses a malformed object / a duplicate id, loudly, and writes nothing
 *   parity — every language has EXACTLY the base key set, with no empty values
 *   t()    — current language, then the base language, then the key itself
 *   dir()  — comes from the language object, never from a hardcoded 'ar' check
 *   resolve() — a saved choice is honoured; a saved garbage id falls back to the base
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripTypeScriptTypes } = require('module');

const ROOT = path.join(__dirname, '..');

// The engine carries no text — ui/lang.ts REGISTERS the two dictionaries. So the
// contract is tested exactly the way the browser sees it: engine first, data second.
function boot(saved) {
  const store = {};
  if (saved != null) store['dekkan.lang'] = saved;
  const doc = {
    documentElement: { lang: '', dir: '' },
    querySelectorAll() { return []; }
  };
  const sandbox = {
    console,
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    },
    document: doc,
    CustomEvent: function (t, o) { this.type = t; this.detail = o && o.detail; }
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.addEventListener = function () {};
  sandbox.dispatchEvent = function () {};
  vm.createContext(sandbox);
  ['ui/langs.ts', 'ui/lang.ts'].forEach(f => {
    vm.runInContext(stripTypeScriptTypes(fs.readFileSync(path.join(ROOT, f), 'utf8')), sandbox, { filename: f });
  });
  return { Langs: sandbox.DEK.Langs, LANGS: sandbox.DEK.LANGS, T: sandbox.T, store, doc, sandbox };
}

const { LANGS, Langs } = boot(null);

test('registry: at least 2 languages, and the base is English', () => {
  const ids = Langs.list();
  assert.ok(ids.length >= 2, 'need >= 2 languages to prove the system (got ' + ids.length + ')');
  assert.strictEqual(Langs.base, 'en', 'the base language is the parity reference');
  assert.ok(LANGS.en, 'en must exist (base + default)');
  assert.ok(LANGS.ar, 'ar must exist');
});

test('every language carries the full contract (id / name / native / dir / keys)', () => {
  Langs.all().forEach(function (l) {
    assert.strictEqual(typeof l.id, 'string', 'id');
    assert.match(l.id, /^[a-z]{2}(-[A-Za-z0-9]+)?$/, 'id must look like a language tag: ' + l.id);
    assert.ok(typeof l.name === 'string' && l.name.trim(), l.id + ' needs a name');
    assert.ok(typeof l.native === 'string' && l.native.trim(), l.id + ' needs a native name');
    assert.ok(l.dir === 'ltr' || l.dir === 'rtl', l.id + " dir must be 'ltr' or 'rtl'");
    assert.ok(l.keys && typeof l.keys === 'object', l.id + ' needs a keys object');
  });
});

test('add() refuses a malformed language, loudly, and registers nothing', () => {
  const before = Langs.list().length;
  assert.throws(() => Langs.add({ name: 'No Id', native: 'X', dir: 'ltr', keys: {} }), /language refused/i, 'no id');
  assert.throws(() => Langs.add({ id: 'zz', name: 'Bad Dir', native: 'X', dir: 'sideways', keys: {} }), /language refused/i, 'bad dir');
  assert.throws(() => Langs.add({ id: 'zz', name: 'No Keys', native: 'X', dir: 'ltr' }), /language refused/i, 'no keys');
  assert.throws(() => Langs.add({ id: 'zz', name: 'No Native', dir: 'ltr', keys: {} }), /language refused/i, 'no native name');
  assert.strictEqual(Langs.list().length, before, 'a refused language must not be registered');
  assert.strictEqual(Langs.has('zz'), false);
});

test('add() refuses a duplicate id (one language, one object)', () => {
  assert.throws(() => Langs.add({ id: 'en', name: 'English again', native: 'English', dir: 'ltr', keys: {} }),
    /already registered/i);
});

test('parity: EVERY language has exactly the base key set, no missing / extra / empty', () => {
  const reports = Langs.parityAll();
  assert.strictEqual(reports.length, Langs.all().length, 'parity must cover every language');
  reports.forEach(function (r) {
    assert.ok(r.missing.length === 0, r.id + ' is missing keys: ' + r.missing.slice(0, 5).join(', '));
    assert.ok(r.extra.length === 0, r.id + ' has keys the base lacks: ' + r.extra.slice(0, 5).join(', '));
    assert.ok(r.empty.length === 0, r.id + ' has empty values: ' + r.empty.slice(0, 5).join(', '));
    assert.strictEqual(r.ok, true, r.id + ' must be in parity');
  });
});

test('the base language is bigger than a toy (the real app dictionary)', () => {
  const keys = Object.keys(LANGS.en.keys);
  assert.ok(keys.length > 100, 'the base dictionary should hold the app text, found ' + keys.length);
});

test('one object = one language: a third language registered on the fly speaks, and the others do not change', () => {
  const FR = { id: 'fr-test', name: 'French', native: 'Français', dir: 'ltr', keys: {} };
  Object.keys(LANGS.en.keys).forEach(function (k) { FR.keys[k] = 'fr:' + k; });
  FR.keys['tab.stock'] = 'Stock FR';
  Langs.add(FR);

  assert.strictEqual(Langs.has('fr-test'), true);
  assert.ok(Langs.list().indexOf('fr-test') !== -1, 'list() must expose it (Settings builds from this)');
  assert.strictEqual(Langs.t('fr-test', 'tab.stock'), 'Stock FR', 'the new language answers');
  assert.notStrictEqual(Langs.t('en', 'tab.stock'), 'Stock FR', 'the base language is untouched');
  assert.strictEqual(Langs.dir('fr-test'), 'ltr');
  assert.strictEqual(Langs.parity('fr-test').ok, true, 'a complete language passes parity');

  delete LANGS['fr-test']; // leave the registry as we found it
  assert.strictEqual(Langs.has('fr-test'), false);
});

test('t(): current language, then the base, then the key itself (never a crash)', () => {
  assert.strictEqual(Langs.t('en', 'tab.stock'), 'Stock');
  assert.strictEqual(Langs.t('ar', 'tab.stock'), 'المخزون');
  assert.strictEqual(Langs.t('en', 'no.such.key.at.all'), 'no.such.key.at.all', 'unknown key falls back to itself');
});

test('a key missing from a language falls back to the base language (not to the raw key)', () => {
  const partial = { id: 'xx', name: 'Partial', native: 'Partial', dir: 'ltr', keys: { 'tab.stock': 'XX-stock' } };
  Langs.add(partial);
  assert.strictEqual(Langs.t('xx', 'tab.stock'), 'XX-stock');
  assert.strictEqual(Langs.t('xx', 'tab.sell'), LANGS.en.keys['tab.sell'], 'falls back to EN');
  assert.strictEqual(Langs.parity('xx').ok, false, 'and parity names it as incomplete');
  assert.ok(Langs.parity('xx').missing.length > 0);
  delete LANGS.xx;
});

test('dir comes from the language object, never from a hardcoded id check', () => {
  assert.strictEqual(Langs.dir('ar'), 'rtl');
  assert.strictEqual(Langs.dir('en'), 'ltr');
  const rtl = { id: 'he-xx', name: 'Test RTL', native: 'Test', dir: 'rtl', keys: {} };
  Object.keys(LANGS.en.keys).forEach(function (k) { rtl.keys[k] = 'h:' + k; });
  Langs.add(rtl);
  assert.strictEqual(Langs.dir('he-xx'), 'rtl', 'any language can be RTL without touching the engine');
  delete LANGS['he-xx'];
});

test('resolve(): saved choice honoured, garbage falls back to the base', () => {
  assert.strictEqual(Langs.resolve(null), 'en', 'nothing saved -> base');
  assert.strictEqual(Langs.resolve('ar'), 'ar', 'a saved language is honoured');
  assert.strictEqual(Langs.resolve('nope-not-a-language'), 'en', 'garbage -> base, never a broken UI');
});

test('Langs and LANGS agree on ids (same objects, one registry)', () => {
  Langs.all().forEach(function (l) {
    assert.strictEqual(LANGS[l.id], l);
    assert.strictEqual(Langs.get(l.id), l);
  });
  assert.strictEqual(Langs.get('nope'), null);
});
