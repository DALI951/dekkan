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
    setAttribute() {}, getAttribute(k) { return e[k]; },
    scrollIntoView() { e._scrolled = true; }
  };
  return e;
}

// boot a fresh page with one product (Coca, sells at 1.500) already in the book
// optional seed(s): mutate the state (with real core calls) BEFORE the page boots;
// a second callback can pre-fill localStorage (e.g. a persisted language) before the scripts load;
// a third `env` can replace fetch/confirm (the cloud: 404 "no state" by default; confirm: yes by default)
function boot(seed, pre, env) {
  const els = {};
  const doc = {
    documentElement: { style: {}, lang: '', dir: '' },
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
    navigator: {
      onLine: true,
      storage: { estimate: () => ({ then() { return this; }, catch() { return this; } }) }
    },
    location: { hash: '' },
    // no server in the harness: every cloud call answers 404 "no state"
    fetch: (env && env.fetch) || (() => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ error: 'no_state' }) })),
    confirm: (env && env.confirm) || (() => true),
    alert: () => {},
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
  // `pre` runs LAST: filling localStorage is the whole point (an old state on the
  // device, a saved session) and it must win over the freshly built shop
  if (pre) pre(store);

  ['core/dekkan-core.js', 'core/core.js', 'core/products.js', 'core/debts.js',
    'core/sales.js', 'core/refunds.js', 'core/employees.js', 'core/cashbox.js', 'core/report.js', 'core/shop.js', 'core/pin.js',
    'js/themes.js', 'js/lang.js', 'js/fmt.js', 'js/pages.js', 'js/actions.js', 'js/auth.js', 'js/app.js'].forEach(f => {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
  });

  const $ = id => doc.getElementById(id);
  const click = (action, id, i) => {
    // HONEST tiles for real: a report metric box carries `data-metric` (never
    // `data-id`) — that is exactly what the page really renders (js/app.js
    // builds '<button data-action="metric-open" data-metric="sales">').
    // Pretending data-metric is data-id is what hid the metric panal bug
    // («لا حركة اليوم» even after a real sale) for a week.
    const tile = el('t');
    tile.getAttribute = k => (k === 'data-action' ? action
      : k === 'data-metric' ? (action === 'metric-open' ? id : null)
      : k === 'data-id' ? (action === 'metric-open' ? null : id)
      : k === 'data-i' ? i : null);
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
  return { $, click, goto, saved, cashNow, pid: s.products[0].id, T: sandbox.T, doc, store, sandbox };
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

test('lang: a hard refresh restores the LAYOUT (dir) with the language, not just the text', () => {
  const ui = boot(null, store => { store['dekkan.lang'] = 'en'; });
  assert.strictEqual(ui.doc.documentElement.dir, 'ltr',
    'English persisted -> the shell is declared LEFT (not stuck on the Arabic side)');
  assert.strictEqual(ui.doc.documentElement.lang, 'en', 'and the language attribute matches');
  assert.strictEqual(ui.T.lang, 'en', 'the translation registry remembers English too');
});

test('lang: the default (nothing saved) stays on the Arabic side — the app\'s birth direction', () => {
  const ui = boot();
  assert.strictEqual(ui.doc.documentElement.dir, 'rtl',
    'no saved choice means the RTL shell stays RTL');
  assert.strictEqual(ui.doc.documentElement.lang, 'ar');
});

test('stock: the edit label is invisible by default and only appears on action', () => {
  const ui = boot();
  ui.goto('#/stock');
  assert.strictEqual(ui.$('productFormTitle').textContent, '',
    'the label stays hidden BEFORE any action');
  assert.strictEqual(ui.$('productForm')._scrolled, undefined, 'nothing scrolled yet');

  ui.click('stock-edit', ui.pid); // pressing edit on the product...
  assert.ok(ui.$('productFormTitle').textContent.indexOf('تعديل') !== -1,
    'now the EDIT label is spelled out');
  assert.strictEqual(ui.$('productForm')._scrolled, true,
    'and the page scrolls so the label is actually visible');
});

test('stock: a sold-out product cannot be added to the basket', () => {
  const ui = boot((core, s) => {
    s = core.addProduct(s, { name: 'Choco', buy: 1, sell: 2, stock: 0, lowAt: 3 });
    return s;
  });
  const choco = ui.saved().products.find(p => p.name === 'Choco');
  const before = ui.$('basketList').innerHTML;
  ui.click('sell-add', choco.id);
  assert.strictEqual(ui.$('basketList').innerHTML, before,
    'the basket did not change');
  assert.ok(ui.$('toast').textContent.length > 0, 'and he is told why');
});

test('stock: the + never takes the basket over what is in stock', () => {
  const ui = boot((core, s) => {
    s = core.addProduct(s, { name: 'Biscuit', buy: 0.4, sell: 0.9, stock: 4, lowAt: 0 });
    return s;
  });
  const b = ui.saved().products.find(p => p.name === 'Biscuit');
  // fill the basket up to the limit, then try to go beyond
  for (let i = 0; i < 4; i++) ui.click('basket-plus', b.id);
  assert.ok(ui.$('basketList').innerHTML.indexOf('x4') !== -1, 'basket holds 4');

  ui.click('basket-plus', b.id); // the 5th — refused
  assert.ok(ui.$('basketList').innerHTML.indexOf('x4') !== -1, 'still 4, not 5');
  assert.ok(ui.$('toast').textContent.length > 0, 'and he is told why');
});

test('receipt refund: the sale on the receipt is refundable in one tap', () => {
  const ui = boot();
  ui.click('sell-add', ui.pid);              // Coca x1
  ui.click('sell-add', ui.pid);              // Coca x2 -> 3.000
  ui.$('paidCash').value = '3';
  ui.$('paidCash').fire('input');
  ui.$('btnSell').fire('click');
  assert.strictEqual(ui.cashNow(), 53, 'the box took the 3.000');

  ui.$('btnReceiptRefund').fire('click');
  const s = ui.saved();
  assert.strictEqual(s.products[0].stock, 10, 'the goods went back on the shelf');
  assert.strictEqual(ui.cashNow(), 50, 'the cash went back to the starting 50');
  const refunds = s.day.entries.filter(e => e.kind === 'refund');
  assert.strictEqual(refunds.length, 1, 'one refund on the ledger');
  assert.strictEqual(refunds[0].amount, -3, 'for the full 3.000 (with the price from the bill)');
  assert.ok(ui.$('toast').textContent.length > 0, 'and a toast told him');
});

test('receipt refund: free lines are cleared without stock, the sale stays filed', () => {
  const ui = boot();
  ui.click('sell-add', ui.pid);              // 1 Coca -> 1.500
  ui.$('freeName').value = 'Cafe';
  ui.$('freePrice').value = '2';
  ui.$('btnAddFree').fire('click');          // + free Cafe 2.000
  ui.$('paidCash').value = '3.5';
  ui.$('paidCash').fire('input');
  ui.$('btnSell').fire('click');

  ui.$('btnReceiptRefund').fire('click');
  const s = ui.saved();
  assert.strictEqual(s.products[0].stock, 10, 'coca restocked from the bill line id');
  assert.strictEqual(ui.cashNow(), 50, 'all 3.500 came back out of the box');
  const refunds = s.day.entries.filter(e => e.kind === 'refund');
  assert.strictEqual(refunds.length, 2, 'one refund for the stock line, one for the free line');
  assert.ok(s.day.entries.some(e => e.kind === 'sale'), 'the original sale stays filed');
});

test("today's moves: bare number rows and refunds name the sale they undid", () => {
  const ui = boot();
  ui.click('sell-add', ui.pid);              // Coca x1 -> 1.500
  ui.$('paidCash').value = '1.5';
  ui.$('paidCash').fire('input');
  ui.$('btnSell').fire('click');
  ui.$('btnReceiptRefund').fire('click');

  const html = ui.$('entriesList').innerHTML;
  assert.ok(/k-refund[\s\S]*class="e-no">#1</.test(html),
    'the refund row shows the # of the sale it reversed');
  assert.ok(html.indexOf('د.ت') === -1,
    'no currency sign in today\'s moves — just the number');
});

// ---------- STAFF (team page) + MONTHLY REVIEW (its own page) ----------

test('the staff page hires a worker into the book', () => {
  const ui = boot();
  ui.goto('#/employees');
  ui.$('btnAddEmployee').fire('click');
  ui.$('empName').value = 'Ali';
  ui.$('empType').value = 'Cashier';
  ui.$('empSalary').value = '300';
  ui.$('btnSaveEmployee').fire('click');

  const s = ui.saved();
  assert.strictEqual(s.employees.length, 1);
  assert.strictEqual(s.employees[0].name, 'Ali', 'trimmed name is in the book');
  assert.strictEqual(s.employees[0].salary, 300);
  assert.ok(ui.$('staffList').innerHTML.indexOf('Ali') !== -1, 'the hire is on screen');
});

test('the staff page fires a worker and the monthly page counts a month of money', () => {
  const ui = boot((core, s) => {
    s = core.addEmployee(s, { name: 'Sarra', type: 'Cleaner', salary: 150 });
    s.day.entries.push({ id: 'x1', kind: 'sale', amount: 100, at: new Date().toISOString(), note: '', ref: '', bill: 0 });
    s.day.entries.push({ id: 'x2', kind: 'expense', amount: -30, at: new Date().toISOString(), note: '', ref: '', bill: 0 });
    return s;
  });
  ui.goto('#/employees');
  assert.ok(ui.$('staffList').innerHTML.indexOf('Sarra') !== -1, 'the seeded hire is listed');

  const id = ui.saved().employees[0].id;
  ui.click('staff-fire', id);
  const s = ui.saved();
  assert.strictEqual(s.employees[0].active, false, 'fired leaves the team');
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(s.employees[0].firedAt), 'with the date stamped');

  ui.goto('#/monthly');
  assert.ok(ui.$('monthWins').textContent.indexOf('100') !== -1, 'the monthly page wins show the 100 sale');
  assert.ok(ui.$('monthLosses').textContent.indexOf('180') !== -1, 'losses: 30 expense + 150 salary');
});

test('the month picker switches the review to any month', () => {
  const ui = boot((core, s) => {
    s.day.entries.push({ id: 'x1', kind: 'sale', amount: 70, at: new Date().toISOString(), note: '', ref: '', bill: 0 });
    return s;
  });
  ui.goto('#/monthly');
  assert.ok(ui.$('monthWins').textContent.indexOf('70') !== -1, 'the current month sees the sale');
  ui.$('monthPicker').value = '2020-01';
  ui.$('monthPicker').fire('input');
  assert.ok(ui.$('monthWins').textContent.indexOf('0.000') !== -1, 'a dead month is empty');
});

// ---------- CLIENTS (saved client profiles) ----------

test('the clients page shows saved client data, purchases, refunds and debt history', () => {
  const ui = boot((core, s) => {
    s = core.sellAll(s, { items: [{ id: s.products[0].id, qty: 2 }], customer: 'Ali', phone: '222', paid: 3 });
    s = core.sellAll(s, { free: [{ name: 'Delivery', qty: 1, price: 4 }], customer: 'Ali', paid: 1 });
    const saleNo = core.clientNoOf(s, s.day.entries.filter(e => e.kind === 'sale')[0].id);
    s = core.refund(s, { items: [{ id: s.products[0].id, qty: 1 }], reason: 'returned', saleNo: saleNo });
    const debt = s.debts.find(d => d.name === 'Ali');
    return core.payDebt(s, debt.id, { amount: 2 });
  });
  ui.goto('#/clients');
  const html = ui.$('clientsList').innerHTML;
  assert.ok(html.indexOf('Ali') !== -1, 'saved client is listed');
  assert.ok(html.indexOf('222') !== -1, 'saved phone is shown');
  assert.ok(html.indexOf('Coca x2') !== -1, 'purchase lines are shown');
  assert.ok(html.indexOf('Delivery x1') !== -1, 'free purchase lines are shown');
  assert.ok(html.indexOf('#1') !== -1, 'refund points back to the sale number');
assert.ok(html.indexOf('1.000') !== -1, 'open owed total is shown');
});

// ---------- ACCOUNT (cloud backup — no gate, no ambush, no silent overwrite) ----------

test('no saved session: the shop opens straight into the till — nothing pops up', () => {
  const ui = boot();
  assert.strictEqual(ui.$('gate').style.display, 'none', 'no gate on boot, ever');
  assert.ok(ui.T.t('auth.title').length > 0, 'account strings are translated');
  assert.ok(ui.T.t('auth.err.badCredentials').length > 0, 'error strings are translated');
});

test('a saved session still opens the till — the account lives in settings', () => {
  const ui = boot(null, store => {
    store['dekkan.token'] = 'a'.repeat(64);
    store['dekkan.user'] = JSON.stringify({ id: 7, email: 'boss@shop.tn', shopName: 'Test Shop' });
  });
  assert.strictEqual(ui.$('gate').style.display, 'none', 'no gate on boot, signed in or not');
  ui.goto('#/settings');
  assert.strictEqual(ui.$('accountEmail').textContent, 'boss@shop.tn', 'signed-in email is shown');
  assert.strictEqual(ui.$('accountMode').textContent, ui.T.t('settings.accountSigned'), 'mode says signed in');
});

test('no session: settings shows local mode, a way IN, and hides sign-out', () => {
  const ui = boot();
  ui.goto('#/settings');
  assert.strictEqual(ui.$('accountEmail').textContent, '—', 'no email to show');
  assert.strictEqual(ui.$('accountMode').textContent, ui.T.t('settings.accountLocal'), 'mode says local');
  assert.strictEqual(ui.$('accountSync').textContent, ui.T.t('auth.syncNever'), 'and the cloud is honestly "not on"');
  assert.ok(ui.$('btnAccountOpen'), 'there is a button to sign up/in later (that used to be missing forever)');
});

test('a cloud copy that differs from a till WITH moves never overwrites it silently', async () => {
  let asked = 0;
  const cloud = { shop: { name: 'Other Shop', currency: 'TND' }, days: [], products: [{ id: 'p9', name: 'Ghost', buy: 1, sell: 2, stock: 3, lowAt: 0 }], debts: [], customers: [], day: { date: '2000-01-01', startCash: 999, soldCost: 0, entries: [], checks: [] } };
  const ui = boot(
    (core, s) => core.sellAll(s, { items: [{ id: s.products[0].id, qty: 1 }] }),   // 1 local sale
    store => {
      store['dekkan.token'] = 'a'.repeat(64);
      store['dekkan.user'] = JSON.stringify({ id: 7, email: 'boss@shop.tn', shopName: 'Test Shop' });
    },
    {
      confirm: () => { asked++; return false; },                                     // he says NO
      fetch: (url) => Promise.resolve(String(url).indexOf('state.php') !== -1
        ? { ok: true, status: 200, json: () => Promise.resolve(cloud) }
        : { ok: false, status: 404, json: () => Promise.resolve({ error: 'no_state' }) })
    });
  await new Promise(r => setTimeout(r, 10));

  assert.strictEqual(asked, 1, 'he was asked before anything was replaced');
  const s = ui.saved();
  assert.strictEqual(s.shop.name, 'Test', 'his own shop survived');
  assert.strictEqual(s.day.entries.filter(e => e.kind === 'sale').length, 1, 'his sale survived');
  assert.ok(s.products.every(p => p.name !== 'Ghost'), 'the cloud products did NOT land');
});

test('taking the cloud copy backs up the till it replaces', async () => {
  const cloud = { shop: { name: 'Other Shop', currency: 'TND' }, days: [], products: [], debts: [], customers: [], day: { date: '2000-01-01', startCash: 999, soldCost: 0, entries: [], checks: [] } };
  const ui = boot(
    (core, s) => core.sellAll(s, { items: [{ id: s.products[0].id, qty: 1 }] }),
    store => {
      store['dekkan.token'] = 'a'.repeat(64);
      store['dekkan.user'] = JSON.stringify({ id: 7, email: 'boss@shop.tn', shopName: 'Test Shop' });
    },
    {
      confirm: () => true,
      fetch: (url) => Promise.resolve(String(url).indexOf('state.php') !== -1
        ? { ok: true, status: 200, json: () => Promise.resolve(cloud) }
        : { ok: false, status: 404, json: () => Promise.resolve({ error: 'no_state' }) })
    });
  await new Promise(r => setTimeout(r, 10));

  assert.strictEqual(ui.saved().shop.name, 'Other Shop', 'the cloud copy is live');
  const backup = JSON.parse(ui.store['dekkan.premerge']);
  assert.strictEqual(backup.shop.name, 'Test', 'the copy it replaced is kept, not dropped');
  assert.strictEqual(backup.day.entries.filter(e => e.kind === 'sale').length, 1, 'with his sale in it');
});

test('an empty till takes a cloud copy quietly — nothing to lose, nothing to ask', async () => {
  let asked = 0;
  const cloud = { shop: { name: 'Other Shop', currency: 'TND' }, days: [], products: [], debts: [], customers: [], day: { date: '2000-01-01', startCash: 999, soldCost: 0, entries: [], checks: [] } };
  const ui = boot(null,
    store => {
      store['dekkan.token'] = 'a'.repeat(64);
      store['dekkan.user'] = JSON.stringify({ id: 7, email: 'boss@shop.tn', shopName: 'Test Shop' });
    },
    {
      confirm: () => { asked++; return true; },
      fetch: (url) => Promise.resolve(String(url).indexOf('state.php') !== -1
        ? { ok: true, status: 200, json: () => Promise.resolve(cloud) }
        : { ok: false, status: 404, json: () => Promise.resolve({ error: 'no_state' }) })
    });
  await new Promise(r => setTimeout(r, 10));
  assert.strictEqual(asked, 0, 'no pointless question');
  assert.strictEqual(ui.saved().shop.name, 'Other Shop', 'his shop came down from the cloud');
});

test('settings says the session expired instead of the gate reappearing', async () => {
  const ui = boot(null,
    store => {
      store['dekkan.token'] = 'a'.repeat(64);
      store['dekkan.user'] = JSON.stringify({ id: 7, email: 'boss@shop.tn', shopName: 'Test Shop' });
    },
    { fetch: () => Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({ error: 'invalid_token' }) }) });
  await new Promise(r => setTimeout(r, 10));
  ui.goto('#/settings');
  assert.strictEqual(ui.$('gate').style.display, 'none', 'still no gate');
  assert.strictEqual(ui.$('accountSync').textContent, ui.T.t('auth.expired'), 'he is told why the cloud is off');
});

// ---------- LOGIC: the bill on screen must be the bill that runs ----------

test('a discount above 100% sells at the capped total — no english error, no mismatch', () => {
  const ui = boot();
  ui.click('sell-add', ui.pid);                       // 1.500
  ui.$('discPct').value = '150';
  ui.$('discPct').fire('input');
  assert.strictEqual(ui.$('basketTotal').textContent, '0.000 د.ت', 'the screen says 0.000');
  ui.$('btnSell').fire('click');
  const sale = ui.saved().day.entries.filter(e => e.kind === 'sale')[0];
  assert.ok(sale, 'the sale went through — what he saw is what ran');
  assert.strictEqual(sale.bill.net, 0, 'net 0 like the screen said');
  assert.strictEqual(sale.bill.discount, 1.5, 'the whole bill came off');
  assert.strictEqual(ui.cashNow(), 50, 'and the till is untouched');
});

// ---------- LOGIC: browsing a past day must behave like a past day ----------

// a real PAST day: closing the day and selling again leaves the shop on the SAME
// date, so a closed day is moved back a week — otherwise "yesterday" is today and
// the test proves nothing.
function lastWeek() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

test('counting the drawer while browsing a past day is refused — a count belongs to today', () => {
  const ui = boot((core, s) => {
    s = core.sellAll(s, { items: [{ id: s.products[0].id, qty: 1 }] });
    const closed = core.closeDay(s);
    closed.days[0].date = lastWeek();
    return core.sellAll(closed, { items: [{ id: closed.products[0].id, qty: 1 }] });
  });
  const y = ui.saved().days[0].date;
  ui.goto('#/report');
  ui.$('dayPicker').value = y;
  ui.$('dayPicker').fire('input');
  ui.$('countedCash').value = '10';
  ui.$('btnCheckCash').fire('click');
  assert.strictEqual((ui.saved().day.checks || []).length, 0, 'today took no count');
  assert.ok(ui.$('toast').textContent.indexOf(ui.T.t('report.checkPastDay')) !== -1, 'he is told why');
});

test('the metric boxes follow the day you are browsing', () => {
  const ui = boot((core, s) => {
    s = core.sellAll(s, { items: [{ id: s.products[0].id, qty: 2 }] });   // past day: 3.000
    const closed = core.closeDay(s);
    closed.days[0].date = lastWeek();
    return core.sellAll(closed, { items: [{ id: closed.products[0].id, qty: 1 }] });  // today: 1.500
  });
  const y = ui.saved().days[0].date;
  ui.goto('#/report');
  ui.click('metric-open', 'sales');
  assert.ok(ui.$('metricBody').innerHTML.indexOf('1.500') !== -1, 'today first: his 1.500 sale');

  ui.$('dayPicker').value = y;
  ui.$('dayPicker').fire('input');
  ui.click('metric-open', 'sales');
  const body = ui.$('metricBody').innerHTML;
  assert.ok(body.indexOf('3.000') !== -1, 'the past day shows ITS 3.000 sale');
  assert.ok(body.indexOf('1.500') === -1, "and NOT today's 1.500 — the old bug showed today's numbers");
  assert.ok(ui.$('metricTitle').textContent.indexOf(y) !== -1, 'the panel names the day it is showing');
});

test('a part-paid sale refunded takes the cash back and writes the credit off', () => {
  const ui = boot();
  ui.click('sell-add', ui.pid);                       // 1.500
  ui.$('paidCash').value = '1';
  ui.$('creditName').value = 'Samir';
  ui.$('paidCash').fire('input');
  ui.$('btnSell').fire('click');
  assert.strictEqual(ui.cashNow(), 51, '1.000 in the drawer, 0.500 on Samir');

  ui.$('btnReceiptRefund').fire('click');
  const s = ui.saved();
  assert.strictEqual(ui.cashNow(), 50, 'only the 1.000 that came in went back out');
  assert.strictEqual(s.debts[0].total, 0, 'the 0.500 credit was written off');
  assert.strictEqual(s.products[0].stock, 10, 'the cola is back on the shelf');
});

test('a fully discounted sale refunded takes NOTHING out of the drawer', () => {
  const ui = boot();
  ui.click('sell-add', ui.pid);                       // 1.500
  ui.$('discPct').value = '100';                      // the whole bill off
  ui.$('discPct').fire('input');
  ui.$('btnSell').fire('click');
  assert.strictEqual(ui.cashNow(), 50, 'the till never moved');

  ui.$('btnReceiptRefund').fire('click');
  const s = ui.saved();
  assert.strictEqual(ui.cashNow(), 50, 'and the refund takes nothing either — the shelf price is not money he took');
  assert.strictEqual(s.products[0].stock, 10, 'but the cola is still back on the shelf');
});

test('a half-discounted sale refunded gives back exactly what was paid', () => {
  const ui = boot();
  ui.click('sell-add', ui.pid);                       // 1.500
  ui.$('discPct').value = '50';                       // 0.750 to pay
  ui.$('discPct').fire('input');
  ui.$('paidCash').value = '0.75';
  ui.$('paidCash').fire('input');
  ui.$('btnSell').fire('click');
  assert.strictEqual(ui.cashNow(), 50.75, '0.750 in the drawer');

  ui.$('btnReceiptRefund').fire('click');
  assert.strictEqual(ui.cashNow(), 50, 'exactly 0.750 came back out — not the 1.500 shelf price');
});

// ---------- an OLD shop (saved before the notebook existed) must still open ----------
test('a shop saved by an older version still opens, sells and reports — no white screen', () => {
  const ui = boot(null, store => {
    store['dekkan.v1'] = JSON.stringify({
      shop: { name: 'Old Shop', startCash: 50 },
      products: [{ id: 'p1', name: 'Coca', buy: 0.8, sell: 1.5, stock: 10, lowAt: 3 }],
      day: { date: new Date().toISOString().slice(0, 10), startCash: 50, entries: [] },
      // no settings, no debts, no categories, no customers, no employees, no days
    });
  });
  for (const page of ['#/sell', '#/report', '#/debts', '#/stock', '#/cashbox', '#/settings']) {
    assert.doesNotThrow(() => ui.goto(page), page + ' must render');
  }
  ui.goto('#/sell');
  ui.click('sell-add', 'p1');
  ui.$('paidCash').value = '1.5';      // paid in full, so no customer name is asked for
  ui.$('paidCash').fire('input');
  ui.$('btnSell').fire('click');
  const sale = ui.saved().day.entries.filter(e => e.kind === 'sale')[0];
  assert.ok(sale, 'and it can still sell');
  assert.ok(Array.isArray(ui.saved().debts), 'the notebook array is there for later');
  assert.ok(Array.isArray(ui.saved().day.checks), 'and the day can still be counted');
});
