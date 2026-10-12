// @ts-nocheck
// JS -> TS migration (first pass): this file is the dynamic DOM / service-worker /
// vm-harness layer (loose globals + event targets). Types get tightened incrementally.
// DEKKAN i18n check — every key used in the UI must exist in EVERY registered language.
// The language engine (ui/langs.ts) is the source of truth: each language is an object
// and must be in EXACT parity with the base language (no missing, no extra, no empty).
// Verifies: index.html data-i18n/-ph/-title keys, the UI files' T.t('...') keys,
// the engine's parity report, and that every id the UI reaches for exists in the markup.
// Usage: node scripts/check-i18n.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripTypeScriptTypes } = require('module');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
// the UI layer is split across several files now — scan them all
const uiFiles = ['ui/app.ts', 'ui/fmt.ts', 'ui/pages.ts', 'ui/actions.ts', 'ui/auth.ts'];

// load the ENGINE and then the dictionaries exactly like the browser would
// (the engine only touches localStorage/document inside try/catch + set/restore)
const sandbox = {
  window: {},
  localStorage: { getItem: function () { return null; }, setItem: function () {} },
  document: { documentElement: {} },
  CustomEvent: function () {},
  addEventListener: function () {}
};
sandbox.window = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);
['ui/langs.ts', 'ui/lang.ts'].forEach(function (f) {
  vm.runInContext(stripTypeScriptTypes(fs.readFileSync(path.join(ROOT, f), 'utf8')), sandbox, { filename: f });
});
const Langs = sandbox.DEK && sandbox.DEK.Langs;
if (!Langs || !Langs.list().length) {
  console.error('FAIL: ui/langs.ts + ui/lang.ts did not register any language');
  process.exit(1);
}
const base = Langs.base;
const baseKeys = Langs.keys(base);

const htmlKeys = new Set();
for (const attr of ['data-i18n', 'data-i18n-ph', 'data-i18n-title']) {
  for (const m of html.matchAll(RegExp(attr + '="([^"]+)"', 'g'))) htmlKeys.add(m[1]);
}
const appKeys = new Set();
for (const f of uiFiles) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const m of src.matchAll(/T\.t\('([^']+)'\)/g)) appKeys.add(m[1]);
}

let bad = 0;
const report = (msg) => { console.error('  FAIL ' + msg); bad++; };

// every registered language must be in EXACT parity with the base language.
// This is the engine's own contract report — the same data test/langs.test.ts asserts.
const languageIds = Langs.list();
languageIds.forEach(function (id) {
  const r = Langs.parity(id);
  if (!r.ok) {
    if (r.missing.length) report("language '" + id + "' is missing " + r.missing.length + ' key(s): ' + r.missing.slice(0, 5).join(', '));
    if (r.extra.length) report("language '" + id + "' has " + r.extra.length + " key(s) the base lacks: " + r.extra.slice(0, 5).join(', '));
    if (r.empty.length) report("language '" + id + "' has " + r.empty.length + ' empty value(s): ' + r.empty.slice(0, 5).join(', '));
  }
});
if (!Langs.has(base)) report("the base language '" + base + "' is not registered");
if (languageIds.length < 2) report('a single language proves nothing — register at least the base + one translation');

// used keys must exist in EVERY language (fill one language, all of them work
// for the UI; a key that exists only in the base would silently fall back)
htmlKeys.forEach(function (k) { if (!(k in baseKeys)) report("index.html uses '" + k + "' - not in the dictionaries"); });
appKeys.forEach(function (k) { if (!(k in baseKeys)) report("ui uses '" + k + "' - not in the dictionaries"); });

// Every id the UI reaches for must EXIST in the real markup. The UI test harness
// invents any element it is asked for, so a typo'd id passes 43 green tests and
// then throws a TypeError in the browser (that is how the account form's
// #gateNameRow shipped broken once). This is the check that catches it.
const htmlIds = new Set();
for (const m of html.matchAll(/\sid="([^"]+)"/g)) htmlIds.add(m[1]);
const wantedIds = new Set();
for (const f of uiFiles) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const m of src.matchAll(/(?:\$|getElementById)\('([A-Za-z][\w-]*)'\)/g)) wantedIds.add(m[1]);
}
// ids the code builds or creates itself are not markup's job
const notMarkup = new Set();
wantedIds.forEach(function (id) {
  if (notMarkup.has(id)) return;
  if (!htmlIds.has(id)) report("the UI reaches for #" + id + " - index.html has no such element");
});

const counts = languageIds.map(function (id) { return id + '=' + Object.keys(Langs.keys(id)).length; }).join(' ');
console.log('i18n keys: ' + counts + ' | languages ' + languageIds.length +
  ' | base ' + base +
  ' | html uses ' + htmlKeys.size + ' | ui uses ' + appKeys.size +
  ' | ids checked ' + wantedIds.size);

if (bad > 0) { console.error('i18n check FAILED (' + bad + ')'); process.exit(1); }
console.log('i18n check OK — every registered language is in parity with the base');