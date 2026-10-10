// DEKKAN CORE — supplier record on purchases (PUR-001 area).
// RED-first: written before buyStock knew suppliers.
// Rules: every buy can carry a supplier (name + optional contact); that
// supplier is recorded on the buy entry AND rides in the stock movement;
// history can answer "what did we buy from X" — across the open day and
// every closed day.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const D = require('../core/dekkan-core.ts');

function lastEntry(s) { return s.day.entries[s.day.entries.length - 1]; }

test('PUR-001a: a buy records its supplier (name + contact) on the entry', () => {
  let s = D.createShop({ name: 'T', startCash: 200 });
  s = D.addProduct(s, { name: 'Coca', buy: 0.8, sell: 1.5, stock: 10 });
  s = D.buyStock(s, s.products[0].id, 24, 0.8, { name: 'Boissons TN', contact: '71 123 456' });
  const e = lastEntry(s);
  assert.equal(e.kind, 'buy');
  assert.deepStrictEqual(e.supplier, { name: 'Boissons TN', contact: '71 123 456' });
  // backward compatible: buying without a supplier records nothing extra
  s = D.buyStock(s, s.products[0].id, 6, 0.8);
  assert.equal(lastEntry(s).supplier || null, null);
});

test('PUR-001b: purchase history lists buys per supplier (open day + closed days)', () => {
  let s = D.createShop({ name: 'T', startCash: 500 });
  s = D.addProduct(s, { name: 'Coca', buy: 0.8, sell: 1.5, stock: 10 });
  const id = s.products[0].id;
  s = D.buyStock(s, id, 24, 0.8, 'Boissons TN');      // string supplier accepted too
  s = D.buyStock(s, id, 12, 0.9, 'Maxi Market');
  const today = D.buysBySupplier(s, 'Boissons TN');
  assert.equal(today.length, 1);
  assert.equal(today[0].qty, 24);

  // roll the day over: the buys move into the closed day, history follows
  s = D.closeDay(s);
  s = D.buyStock(s, id, 10, 0.8, 'Boissons TN');       // a buy on the fresh day
  const all = D.buysBySupplier(s, 'Boissons TN');
  assert.equal(all.length, 2, 'history spans the closed day AND the open one');
  assert.deepStrictEqual(all.map(function (b) { return b.qty; }).sort(), [10, 24]);
  assert.equal(D.buysBySupplier(s, 'nobody').length, 0);
});