/* ABSURD-INPUT CONTRACT (RED first) — proof that the till can NEVER be tricked
 * out of a real dinars-worth by a fat-fingered or hostile number box.
 *
 * Why this file exists separately: the core is where money()/price/qty/paid
 * live, and a shopkeeper who types "-5" into the free-line price, "NaN" into
 * paid, or "120" into discount% gets either a REFUSAL or an honest till — but
 * NEVER a till that goes negative or reads NaN/Infinity. Every assert here is
 * pure math (no Arabic, no currency strings) so the checks are byte-stable
 * across any encoding on disk.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const D = require('../core/dekkan-core.js');

function shop() {
  let s = D.createShop({ name: 'C', startCash: 50 });
  s = D.addProduct(s, { name: 'Coca', buy: 0.8, sell: 1.5, stock: 10, lowAt: 3 });
  return s;
}

test('a NEGATIVE free price is refused: nothing is sold, the till never drains', () => {
  let s = shop();
  const cashBefore = D.cash(s);
  const abs = Math.abs(D.cash(s));
  // "-5" in the free-line price box — a negative price is REFUSED, not met
  assert.throws(() => D.sellFree(s, { name: 'x', price: -5, qty: 1 }), /price/);
  // and the refusal changed NOTHING: byte-identical till
  assert.equal(D.cash(s), cashBefore, 'a refused absurd price moves NO cash');
  assert.equal(D.cash(s), Math.abs(D.cash(s)), 'cash is always non-negative (never drains)');
  assert.notEqual(D.cash(s), Number.NaN, 'the till never reads NaN');
  assert.equal(D.cash(s) < abs ? abs : 0, abs === D.cash(s) ? 0 : 1, 'never loses real dinars');
});

test('a NEGATIVE per-item price override on a stock sale is refused; stock and cash stay put', () => {
  let s = shop();
  const cashBefore = D.cash(s);
  const stockBefore = s.products[0].stock;
  assert.throws(() => D.sell(s, { items: [{ id: s.products[0].id, qty: 1, price: -4 }] }), /price/);
  assert.equal(D.cash(s), cashBefore, 'no cash moved on a refused sale');
  assert.equal(s.products[0].stock, stockBefore, 'no stock moved on a refused sale');
});

test('NaN in the paid box is refused: no partial pay, no debt, till stays a real number', () => {
  let s = shop();
  assert.throws(() => D.sell(s, { items: [{ id: s.products[0].id, qty: 1 }], paid: Number.NaN }), /paid/);
  assert.throws(() => D.sellFree(s, { name: 'x', price: 2, qty: 1, paid: Number.NaN }), /paid/);
  assert.equal(Number.isFinite(D.cash(s)), true, 'till is still a finite number');
  assert.equal(s.day.entries.length, 0, 'absurd paid recorded nothing');
  assert.equal(s.debts.length, 0, 'absurd paid created no debt');
});

test('discount percent over 100 or under 0 is refused; cash identity still holds', () => {
  let s = shop();
  assert.throws(() => D.sell(s, { items: [{ id: s.products[0].id, qty: 1 }], discount: { percent: 101 } }), /percent/);
  assert.throws(() => D.sell(s, { items: [{ id: s.products[0].id, qty: 1 }], discount: { percent: -1 } }), /percent/);
  assert.throws(() => D.sell(s, { items: [{ id: s.products[0].id, qty: 1 }], discount: { amount: -5 } }), /amount/);
  // the till is still exactly startCash: a single dinars never left for a refusal
  assert.equal(D.cash(s), 50, 'absurd discount never touches the till');
});

test('absurd qty (0, negative, or 1e15) is refused: stock and cash never leave, till stays finite', () => {
  let s = shop();
  [-3, 0, 1e15].forEach(function (q) {
    assert.throws(() => D.sell(s, { items: [{ id: s.products[0].id, qty: q }] }), /qty|stock/);
  });
  assert.equal(D.cash(s), 50, 'till unchanged by absurd qty');
  assert.equal(Number.isFinite(D.cash(s)), true, 'till is finite after absurd qty');
  assert.equal(s.products[0].stock, 10, 'stock unchanged by absurd qty');
});
