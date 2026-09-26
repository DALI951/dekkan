/* DEKKAN refund/cash guards — the "refund more than you ever sold" and
 * "take money out of an empty till" holes, locked RED-first.
 * Run: node --test test/refunds.test.js
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const D = require('../core/dekkan-core.js');

function shop() {
  return D.createShop({ name: 'Test', startCash: 100 });
}

test('sales feed the same per-day refund budget per product', () => {
  let s = shop();
  s = D.addProduct(s, { name: 'Soda', buy: 0.5, sell: 1.5, stock: 10, lowAt: 2 });
  const id = s.products[0].id;
  s = D.sellAll(s, { items: [{ id, qty: 3 }] });
  s = D.sellAll(s, { items: [{ id, qty: 2 }] });
  assert.strictEqual(s.day.soldByProduct[id], 5, 'two sales pile up the budget');
});

test('refund is capped at what was actually sold today', () => {
  let s = shop();
  s = D.addProduct(s, { name: 'Soda', buy: 0.5, sell: 1.5, stock: 10, lowAt: 2 });
  const id = s.products[0].id;
  s = D.sellAll(s, { items: [{ id, qty: 3 }] }); // only 3 left the shelf
  assert.throws(() => D.refund(s, { items: [{ id, qty: 4 }] }), /sold today/);
  // partial refunds consume the budget: 3 -> refund 2 -> only 1 left
  s = D.refund(s, { items: [{ id, qty: 2 }] });
  assert.throws(() => D.refund(s, { items: [{ id, qty: 2 }] }), /sold today/);
  s = D.refund(s, { items: [{ id, qty: 1 }] }); // exactly the remaining budget
  assert.strictEqual(s.day.soldByProduct[id], 0);
  assert.strictEqual(s.products[0].stock, 10, 'stock fully restored');
});

test('a cash refund cannot take more out than the till physically holds', () => {
  let s = D.createShop({ name: 'Test', startCash: 0 });
  s = D.addProduct(s, { name: 'Soda', buy: 0.5, sell: 1.5, stock: 10, lowAt: 2 });
  const id = s.products[0].id;
  s = D.sellAll(s, { items: [{ id, qty: 1 }], customer: 'Ali' }); // full credit: no cash moved
  assert.throws(() => D.refund(s, { items: [{ id, qty: 1 }] }), /not enough cash/);
  // the honest way back: creditTo undoes the receivable instead of cash
  s = D.refund(s, { items: [{ id, qty: 1 }], creditTo: 'Ali' });
  const d = s.debts.find(x => x.name === 'Ali');
  assert.strictEqual(d && d.total, 0, 'the debt went back to zero');
  assert.ok(d.settled);
});

test('free-item refunds are capped by the free-item sales budget', () => {
  let s = shop();
  s = D.sellFree(s, { name: 'Coffee', price: 2, qty: 2 });
  assert.strictEqual(s.day.soldFree.Coffee, 2);
  s = D.refundFree(s, { name: 'Coffee', qty: 2 });
  assert.throws(() => D.refundFree(s, { name: 'Coffee', qty: 1 }), /sold today/);
});

test('expenses cannot push the till below zero', () => {
  let s = D.createShop({ name: 'Test', startCash: 10 });
  assert.throws(() => D.expense(s, { amount: 10.001 }), /not enough cash/);
  s = D.expense(s, { amount: 10 }); // exact is allowed: till lands on 0
  assert.strictEqual(D.cash(s), 0);
  assert.throws(() => D.expense(s, { amount: 0.001 }), /not enough cash/);
  s = D.income(s, { amount: 5 });
  assert.strictEqual(D.cash(s), 5);
});

test('incomes do not need a cash floor (money can always come in)', () => {
  let s = D.createShop({ name: 'Test', startCash: 0 });
  s = D.income(s, { amount: 100 });
  assert.strictEqual(D.cash(s), 100);
});
// ---------- a DISCOUNTED sale: the gap is the discount, not a debt ----------
test('a discounted walk-in sale refunds what was paid, not the shelf price', () => {
  let s = shop();
  s = D.addProduct(s, { name: 'Soda', buy: 0.5, sell: 1.5, stock: 10, lowAt: 2 });
  const id = s.products[0].id;
  s = D.sellAll(s, { items: [{ id, qty: 1 }], discount: { percent: 50 }, paid: 0.75 });
  assert.strictEqual(D.cash(s), 100.75, 'he paid 0.750 of a 1.500 bottle');
  s = D.refund(s, { items: [{ id, qty: 1, price: 1.5 }], cash: 0.75, discount: true });
  assert.strictEqual(D.cash(s), 100, 'exactly what he took came back');
  assert.strictEqual(s.products[0].stock, 10, 'and the bottle is back on the shelf');
});

test('a 100%-off (free) sale refunds nothing but still returns the goods', () => {
  let s = shop();
  s = D.addProduct(s, { name: 'Soda', buy: 0.5, sell: 1.5, stock: 10, lowAt: 2 });
  const id = s.products[0].id;
  s = D.sellAll(s, { items: [{ id, qty: 1 }], discount: { percent: 100 }, paid: 0 });
  assert.strictEqual(D.cash(s), 100, 'a free sale leaves the till alone');
  s = D.refund(s, { items: [{ id, qty: 1, price: 1.5 }], cash: 0, discount: true });
  assert.strictEqual(D.cash(s), 100, 'refunding it takes nothing either');
  assert.strictEqual(s.products[0].stock, 10, 'the bottle came back');
});

test('without the discount flag a gap is still refused (nothing goes missing silently)', () => {
  let s = shop();
  s = D.addProduct(s, { name: 'Soda', buy: 0.5, sell: 1.5, stock: 10, lowAt: 2 });
  const id = s.products[0].id;
  s = D.sellAll(s, { items: [{ id, qty: 1 }] });
  s = D.sellAll(s, { items: [{ id, qty: 1 }] });
  assert.throws(() => D.refund(s, { items: [{ id, qty: 1, price: 1.5 }], cash: 0.5 }),
    /on credit/, 'taking 0.500 of a 1.500 return with no customer is refused');
});
