// @ts-nocheck
// JS -> TS migration (first pass): a vm sandbox with loose globals.
// DEKKAN — the language a FRESH browser lands in (LANG-001, unit level).
// English is the default; Arabic comes back only when explicitly chosen and
// persisted. This pins the exact default that the UI shell and e2e assume.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripTypeScriptTypes } = require('module');

const ROOT = path.join(__dirname, '..');

function bootLang(saved) {
  const store = {};
  if (saved != null) store['dekkan.lang'] = saved;
  const doc = {
    documentElement: { lang: '', dir: '' },
    querySelectorAll() { return []; }
  };
  const sandbox = {
    console, localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    },
    document: doc,
    window: {},
    CustomEvent: function (t, o) { this.type = t; this.detail = o && o.detail; }
  };
  sandbox.window = sandbox;
  sandbox.window.dispatchEvent = function () {};
  sandbox.window.addEventListener = function () {};
  vm.createContext(sandbox);
  vm.runInContext(stripTypeScriptTypes(fs.readFileSync(path.join(ROOT, 'ui', 'lang.ts'), 'utf8')), sandbox, { filename: 'ui/lang.ts' });
  return { T: sandbox.window.T || sandbox.T, doc, store };
}

test('LANG-001 (unit): no saved language -> English, LEFT-to-right', () => {
  const { T, doc } = bootLang(null);
  assert.strictEqual(T.lang, 'en', 'a fresh browser must land in English');
  assert.strictEqual(doc.documentElement.lang, 'en');
  assert.strictEqual(doc.documentElement.dir, 'ltr');
  assert.strictEqual(T.t('tab.stock'), 'Stock');
});

test('LANG-002 (unit): a saved Arabic choice is honoured', () => {
  const { T, doc } = bootLang('ar');
  assert.strictEqual(T.lang, 'ar');
  assert.strictEqual(doc.documentElement.lang, 'ar');
  assert.strictEqual(doc.documentElement.dir, 'rtl');
  assert.strictEqual(T.t('tab.stock'), 'المخزون');
});

test('LANG-003 (unit): switching language persists it', () => {
  const { T, store } = bootLang(null);
  T.set('ar');
  assert.strictEqual(store['dekkan.lang'], 'ar');
  T.set('en');
  assert.strictEqual(store['dekkan.lang'], 'en');
});
