/* DEKKAN UI tests — drive the REAL js/app.js inside a stub DOM.
 * Why: the core can be perfect while the page shows nonsense (a formatted
 * money string fed back into maths, a doubled currency, a listener never
 * wired). This proves what the shopkeeper actually sees on the Sell page.
 * Run: node --test
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

function el(id) {
  const e = {
    id, value: '', textContent: '', innerHTML: '', className: '', checked: false,
    style: {}, _h: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener(type, fn) { (e._h[type] = e._h[type] || []).push(fn); },
    fire(type, ev) { (e._h[type] || []).forEach(fn => fn(ev || {})); },
    closest() { return null; }, querySelectorAll() { return []; },
    setAttribute() {}, getAttribute(k) { return e[k]; }
  };
  return e;
}

// boot a fresh page with one product (Coca, sells at 1.500) already in the book
function boot() {
  const els = {};
  const doc = {
    documentElement: { style: {} },
    _h: {},
    getElementById(id) { return (els[id] = els[id] || el(id)); },
    querySelectorAll() { return []; },
    createElement() { return el('tmp'); },
    addEventListener(t, fn) { (doc._h[t] = doc._h[t] || []).push(fn); },
    dispatchEvent() {}
  };
  const store = {};
  const sandbox = {
    console, setTimeout, clearTimeout, document: doc, Promise, Object, JSON, Math,
    Number, String, Array, Date, RegExp, Error, parseInt, parseFloat, isFinite,
    navigator: { storage: { estimate: () => ({ then() { return this; }, catch() { return this; } }) } },
    location: { hash: '' },
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    },
    CustomEvent: function (t, o) { this.type = t; this.detail = o && o.detail; },
    URL: { createObjectURL: () => '', revokeObjectURL() {} },
    Blob: function () {}
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.window.addEventListener = function (t, fn) {
    sandbox._h = sandbox._h || {};
    (sandbox._h[t] = sandbox._h[t] || []).push(fn);
  };
  sandbox.window.dispatchEvent = function () {};
  vm.createContext(sandbox);

  const core = require(path.join(ROOT, 'core', 'dekkan-core.js'));
  let s = core.createShop({ name: 'Test', startCash: 50 });
  s = core.addProduct(s, { name: 'Coca', buy: 0.8, sell: 1.5, stock: 10, lowAt: 3 });
  store['dekkan.v1'] = JSON.stringify(s);

  ['core/dekkan-core.js', 'js/themes.js', 'js/lang.js', 'js/app.js'].forEach(f => {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
  });

  const $ = id => doc.getElementById(id);
  const click = (action, id) => {
    const tile = el('t');
    tile.getAttribute = k => (k === 'data-action' ? action : k === 'data-id' ? id : null);
    doc._h.click[0]({ target: { closest: sel => (sel === '[data-action]' ? tile : null) } });
  };
  const saved = () => JSON.parse(store['dekkan.v1']);
  const cashNow = () => {
    let t = saved().day.startCash;
    saved().day.entries.forEach(e => { t += e.amount; });
    return Math.round(t * 1000) / 1000;
  };
  return { $, click, saved, cashNow, pid: s.products[0].id, T: sandbox.T };
}

test('the amount due is on screen, follows the basket, and moves while typing', () => {
  const ui = boot();
  assert.match(ui.$('basketTotal').textContent, /^0\.000/, 'starts at zero');
  assert.ok(ui.$('dueHint').textContent.length > 0, 'and says what to do');

  ui.click('sell-add', ui.pid);
  assert.strictEqual(ui.$('basketTotal').textContent, '1.500 د.ت', 'picking a product sets the due');
  assert.match(ui.$('dueHint').textContent, /^1 /, 'hint counts the items');

  ui.$('discPct').value = '50';
  ui.$('discPct').fire('input');
  assert.strictEqual(ui.$('basketTotal').textContent, '0.750 د.ت', 'typing a 50% discount moves the due');
  assert.ok(ui.$('dueHint').textContent.indexOf('خصم') !== -1, 'hint mentions the discount');

  ui.$('discPct').value = '';
  ui.$('discPct').fire('input');
  ui.$('paidCash').value = '2';
  ui.$('paidCash').fire('input');
  assert.ok(ui.$('changeLine').textContent.indexOf('0.500') !== -1, 'typing 2.000 on 1.500 offers 0.500 change');
  assert.ok(ui.$('changeLine').className.indexOf('ok') !== -1, 'and it is green');

  ui.$('paidCash').value = '1';
  ui.$('creditName').value = 'Samir';
  ui.$('paidCash').fire('input');
  assert.ok(ui.$('changeLine').textContent.indexOf('Samir') !== -1, 'a shortage names who owes the rest');
  assert.ok(ui.$('changeLine').className.indexOf('bad') !== -1, 'and it is red');
});

test('the no-stock line previews its own total while typing', () => {
  const ui = boot();
  ui.$('freeName').value = 'Cafe';
  ui.$('freePrice').value = '2';
  ui.$('freeQty').value = '3';
  ui.$('freePrice').fire('input');
  const txt = ui.$('freePrev').textContent;
  assert.ok(txt.indexOf('6.000') !== -1, 'shows 2 x 3 = 6.000');
  assert.strictEqual(txt.split('د.ت').length - 1, 1, 'the currency is printed once');
});

test('checkout: a part payment puts the rest on the customer', () => {
  const ui = boot();
  ui.click('sell-add', ui.pid);                 // 1.500
  ui.$('paidCash').value = '1';
  ui.$('creditName').value = 'Samir';
  ui.$('paidCash').fire('input');
  ui.$('btnSell').fire('click');

  assert.strictEqual(ui.cashNow(), 51, 'only the 1.000 handed over enters the box');
  const debts = ui.saved().debts;
  assert.strictEqual(debts.length, 1);
  assert.strictEqual(debts[0].name, 'Samir');
  assert.strictEqual(debts[0].total, 0.5, 'the 0.500 rest is on Samir');
  assert.ok(ui.$('toast').textContent.indexOf('Samir') !== -1, 'the toast says who owes');
  assert.ok(ui.$('rClient').textContent.indexOf('Samir #1') !== -1, 'the receipt shows the customer and their #1');
  // the stub DOM writes receipt lines/totals via innerHTML, so read innerHTML here
  assert.ok(ui.$('rTotals').innerHTML.indexOf('0.500') !== -1, 'the paper spells out the rest');
  assert.match(ui.$('basketTotal').textContent, /^0\.000/, 'the basket resets');
});

test('checkout: paying too much shows the change and never inflates the box', () => {
  const ui = boot();
  ui.click('sell-add', ui.pid);
  ui.$('paidCash').value = '5';
  ui.$('paidCash').fire('input');
  ui.$('btnSell').fire('click');

  assert.strictEqual(ui.cashNow(), 51.5, 'cash rises by the price only');
  assert.strictEqual(ui.saved().debts.length, 0, 'overpay never creates a debt');
  const r = ui.$('rTotals').innerHTML; // stub: totals are written via innerHTML
  assert.ok(r.indexOf('3.500') !== -1, 'the change is spelled out on the receipt');
  assert.strictEqual(r.split('د.ت').length - 1, 3, 'three amounts on the paper (total, paid, change)');
  assert.ok(ui.$('rClient').textContent.indexOf('#1') !== -1, 'the walk-in is the day\'s #1');
});

test('checkout: a shortage with no name is refused, and nothing changes', () => {
  const ui = boot();
  ui.click('sell-add', ui.pid);
  ui.$('paidCash').value = '1';
  ui.$('paidCash').fire('input');
  ui.$('btnSell').fire('click');

  assert.strictEqual(ui.cashNow(), 50, 'no money moved');
  assert.strictEqual(ui.saved().debts.length, 0, 'no debt invented');
  assert.strictEqual(ui.saved().products[0].stock, 10, 'stock untouched');
  assert.ok(ui.$('toast').textContent.length > 0, 'and he is told why');
});
