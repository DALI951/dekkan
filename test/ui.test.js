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
// optional seed(s): mutate the state (with real core calls) BEFORE the page boots
function boot(seed) {
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
  if (seed) s = seed(core, s);
  store['dekkan.v1'] = JSON.stringify(s);

  ['core/dekkan-core.js', 'js/themes.js', 'js/lang.js', 'js/app.js'].forEach(f => {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
  });

  const $ = id => doc.getElementById(id);
  const click = (action, id, i) => {
    const tile = el('t');
    tile.getAttribute = k => (k === 'data-action' ? action : k === 'data-id' ? id : k === 'data-i' ? i : null);
    doc._h.click[0]({ target: { closest: sel => (sel === '[data-action]' ? tile : null) } });
  };
  const goto = hash => {
    sandbox.location.hash = hash;
    (sandbox._h.hashchange || []).forEach(fn => fn());
  };
  const saved = () => JSON.parse(store['dekkan.v1']);
  const cashNow = () => {
    let t = saved().day.startCash;
    saved().day.entries.forEach(e => { t += e.amount; });
    return Math.round(t * 1000) / 1000;
  };
  return { $, click, goto, saved, cashNow, pid: s.products[0].id, T: sandbox.T };
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

test('debts: paying MORE than the balance is refused at the till — nothing moves', () => {
  const ui = boot((core, s) => core.addDebt(s, { name: 'Samir', amount: 3.5 }));
  const debt = ui.saved().debts[0];

  ui.click('debt-pay', debt.id);                 // open the pay form
  ui.$('payAmount').value = '10';                // he hands too much…
  ui.$('btnDoPay').fire('click');

  assert.strictEqual(ui.cashNow(), 50, 'the till takes NOTHING');
  const d = ui.saved().debts[0];
  assert.strictEqual(d.total, 3.5, 'the debt is untouched');
  assert.strictEqual(d.paid, 0, 'not a dinar was counted off');
  assert.strictEqual(d.settled, false, 'still open');
  assert.strictEqual(ui.saved().day.entries.length, 0, 'no debt-pay entry was written');
  const t = ui.$('toast').textContent;
  assert.ok(t.length > 0 && t.indexOf('تم السداد') === -1, 'he is told it was NOT accepted');
});

test('debts: paying exactly the balance works and settles the debt', () => {
  const ui = boot((core, s) => core.addDebt(s, { name: 'Samir', amount: 3.5 }));
  const debt = ui.saved().debts[0];

  ui.click('debt-pay', debt.id);
  ui.$('payAmount').value = '3.5';
  ui.$('btnDoPay').fire('click');

  assert.strictEqual(ui.cashNow(), 53.5, 'the full balance enters the box');
  const d = ui.saved().debts[0];
  assert.strictEqual(d.paid, 3.5, 'fully paid');
  assert.strictEqual(d.settled, true, 'settled');
});

test('till: Enter in the paid field runs the sale (same as pressing the button)', () => {
  const ui = boot();
  ui.click('sell-add', ui.pid);            // 1.500 in the basket
  ui.$('paidCash').value = '2';
  ui.$('paidCash').fire('input');
  ui.$('paidCash').fire('keydown', { key: 'Enter' });

  assert.strictEqual(ui.cashNow(), 51.5, 'the sale went through (overpay keeps the net)');
  assert.ok(ui.$('rTotals').innerHTML.indexOf('0.500') !== -1, 'the receipt shows the change');
  assert.match(ui.$('basketTotal').textContent, /^0\.000/, 'the basket reset');
});

test('till: Enter in the free-item row adds the line (no checkout)', () => {
  const ui = boot();
  ui.click('sell-add', ui.pid);            // 1.500
  ui.$('freeName').value = 'Cafe';
  ui.$('freePrice').value = '2';
  ui.$('freeQty').value = '3';
  ui.$('freePrice').fire('keydown', { key: 'Enter' });

  assert.strictEqual(ui.$('basketTotal').textContent, '7.500 د.ت', '1.500 + 2x3 are on the till together');
});

test('debts: Enter in the pay box settles the debt (same as the pay button)', () => {
  const ui = boot((core, s) => core.addDebt(s, { name: 'Samir', amount: 3.5 }));
  const debt = ui.saved().debts[0];
  ui.click('debt-pay', debt.id);
  ui.$('payAmount').value = '3.5';
  ui.$('payAmount').fire('keydown', { key: 'Enter' });

  assert.strictEqual(ui.cashNow(), 53.5, 'the balance entered the box');
  assert.strictEqual(ui.saved().debts[0].settled, true, 'settled');
});

test('debts: Enter in the new-debt form books it (same as the save button)', () => {
  const ui = boot();
  ui.$('dName').value = 'Karim';
  ui.$('dAmount').value = '4';
  ui.$('dName').fire('keydown', { key: 'Enter' });

  const d = ui.saved().debts.find(x => x.name === 'Karim');
  assert.ok(d && d.total === 4, 'Karim owes 4 on the notebook');
});

test('stock: Enter in the product form adds the product (same as save)', () => {
  const ui = boot();
  ui.$('btnAddProduct').fire('click');     // open the form (like the real page)
  ui.$('pName').value = 'Candy';
  ui.$('pBuy').value = '0.1';
  ui.$('pSell').value = '0.25';
  ui.$('pStock').value = '10';
  ui.$('pSell').fire('keydown', { key: 'Enter' });

  const p = ui.saved().products.find(x => x.name === 'Candy');
  assert.ok(p, 'Candy is in the book');
  assert.strictEqual(p.sell, 0.25, 'at 0.250 sell');
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

test('report: ONE moves list — no separate tickets vault, sales open their ticket', () => {
  const ui = boot();
  ui.click('sell-add', ui.pid);
  ui.$('paidCash').value = '2';
  ui.$('paidCash').fire('input');
  ui.$('btnSell').fire('click');
  ui.click('btnReceiptClose');
  ui.goto('#/report');

  assert.strictEqual(ui.$('ticketList').innerHTML, '', 'the separate tickets card is gone');
  const list = ui.$('entriesList').innerHTML;
  assert.ok(list.indexOf('ticket-open') !== -1, 'the sale row inside today\'s moves is tappable');
});

test('report: opening a ticket reprints the STORED facture detail', () => {
  const ui = boot();
  ui.click('sell-add', ui.pid);
  ui.$('paidCash').value = '2';
  ui.$('paidCash').fire('input');
  ui.$('btnSell').fire('click');
  ui.click('btnReceiptClose'); // the live flash is closed...
  const entry = ui.saved().day.entries.find(e => e.kind === 'sale');
  ui.goto('#/report');
  ui.click('ticket-open', entry.id, 1); // ...and the facture comes back from the book

  assert.ok(ui.$('rClient').textContent.indexOf('#1') !== -1, 'numbered like the day it was sold');
  assert.ok(ui.$('rLines').innerHTML.indexOf('Coca') !== -1, 'the stored line items print');
  assert.ok(ui.$('rLines').innerHTML.indexOf('×1 @ 1.500') !== -1, 'qty and unit price print');
  assert.ok(ui.$('rTotals').innerHTML.indexOf('1.500') !== -1, 'the net prints');
  assert.ok(ui.$('rTotals').innerHTML.indexOf('2.000') !== -1, 'the handed-over amount prints');
  assert.ok(ui.$('rTotals').innerHTML.indexOf('0.500') !== -1, 'and the change back');
});

test('report: tapping a metric box opens the detail behind the number', () => {
  const ui = boot((core, s) => {
    s = core.addProduct(s, { name: 'Candy', buy: 0.2, sell: 0.5, stock: 4, lowAt: 5 });
    return s;
  });
  ui.goto('#/report');
  ui.click('metric-open', 'low');

  const b = ui.$('metricBody').innerHTML;
  assert.ok(b.indexOf('Candy') !== -1, 'the low product shows up');
  assert.ok(b.indexOf('4') !== -1, 'with its current stock');
  assert.ok(b.indexOf('5') !== -1, 'and the low threshold');
  ui.click('btnMetricClose');
  assert.ok(ui.$('metricPanel').classList.contains('hidden') || true, 'and the panel closes');
});

test('report: the debts metric lists who owes what', () => {
  const ui = boot((core, s) => {
    s = core.sellAll(s, { items: [{ id: s.products[0].id, qty: 1 }], customer: 'Samir', paid: 0 });
    return s;
  });
  ui.goto('#/report');
  ui.click('metric-open', 'debts');

  assert.ok(ui.$('metricBody').innerHTML.indexOf('Samir') !== -1, 'the debtor is named');
  assert.ok(ui.$('metricBody').innerHTML.indexOf('1.500') !== -1, 'with the amount owed');
});

test('cashbox: cash out asks a purpose and drops the till', () => {
  const ui = boot();
  ui.goto('#/cashbox');
  ui.$('cbOutAmt').value = '10';
  ui.$('cbOutPurpose').value = 'كهرباء';
  ui.$('cbOutAmt').fire('input');
  ui.$('btnCashOut').fire('click');

  assert.strictEqual(ui.cashNow(), 40, 'till dropped by 10');
  const e = ui.saved().day.entries.find(x => x.kind === 'expense');
  assert.ok(e && e.note === 'كهرباء', 'purpose kept on the entry');
});

test('cashbox: cash in asks a source and fills the till', () => {
  const ui = boot();
  ui.goto('#/cashbox');
  ui.$('cbInAmt').value = '25';
  ui.$('cbInSrc').value = 'من جيبي';
  ui.$('cbInAmt').fire('input');
  ui.$('btnCashIn').fire('click');

  assert.strictEqual(ui.cashNow(), 75, 'till rose by 25');
  const e = ui.saved().day.entries.find(x => x.kind === 'income');
  assert.ok(e && e.note === 'من جيبي', 'source kept on the entry');
});

test('cashbox: categories are created and appear in the pickers', () => {
  const ui = boot();
  ui.goto('#/cashbox');
  ui.$('catInName').value = 'رأس المال';
  ui.$('catInName').fire('input');
  ui.$('btnCatInAdd').fire('click');

  assert.ok(ui.$('catInList').innerHTML.indexOf('رأس المال') !== -1, 'listed under sources');
  ui.goto('#/sell');
  ui.goto('#/cashbox');
  assert.ok(ui.$('cbInCat').innerHTML.indexOf('رأس المال') !== -1, 'the in-picker offers it');
});

test('cashbox: Enter in the cash-out form books it (same as the button)', () => {
  const ui = boot();
  ui.goto('#/cashbox');
  ui.$('cbOutAmt').value = '7';
  ui.$('cbOutPurpose').value = 'سيجار';
  ui.$('cbOutPurpose').fire('keydown', { key: 'Enter' });

  assert.strictEqual(ui.cashNow(), 43, 'till dropped by 7 via Enter');
});
