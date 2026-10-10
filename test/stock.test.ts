// DEKKAN CORE — the STOCK LEDGER + stock card (workbook STK-001/003/007, RPT-006).
// RED-first: this file was written BEFORE the ledger existed.
// The rule (workbook): on-hand comes from source-linked movements; users never
// type over stock. Every shelf change is an immutable signed movement, and the
// counter on the product must always equal the sum of its movements.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const D = require('../core/dekkan-core.ts');

// a fresh shop with two shelf products
function shop() {
  let s = D.createShop({ name: 'Cafe', startCash: 50 });
  s = D.addProduct(s, { name: 'Coca', buy: 0.8, sell: 1.5, stock: 10, lowAt: 3 });
  s = D.addProduct(s, { name: 'Pain', buy: 0.4, sell: 1, stock: 20, lowAt: 5 });
  return s;
}

test('STK-001: addProduct records an opening movement; the card balance ties to on-hand', () => {
  const s = shop();
  const coca = s.products[0].id;
  const card = D.stockCard(s, coca);
  assert.equal(card.moves.length, 1);
  assert.equal(card.moves[0].kind, 'opening');
  assert.equal(card.moves[0].qty, 10);
  assert.equal(card.balance, 10);
  assert.equal(card.stock, 10);
  assert.deepStrictEqual(D.stockIntegrity(s), []);
});

test('STK-003: every stock change is a signed movement; the ladder ties to balance', () => {
  let s = shop();
  const coca = s.products[0].id;
  s = D.sell(s, { items: [{ id: coca, qty: 3 }] });       // -3
  s = D.buyStock(s, coca, 5, 0.8);                        // +5
  s = D.refund(s, { items: [{ id: coca, qty: 1 }], reason: 'test' });     // +1
  const card = D.stockCard(s, coca);
  assert.deepStrictEqual(card.moves.map(function (m) { return m.kind; }), ['opening', 'sale', 'buy', 'refund']);
  assert.deepStrictEqual(card.moves.map(function (m) { return m.qty; }), [10, -3, 5, 1]);
  assert.deepStrictEqual(card.moves.map(function (m) { return m.balance; }), [10, 7, 12, 13]);
  assert.equal(card.balance, 13);
  assert.equal(D.getProduct(s, coca).stock, 13);
  assert.deepStrictEqual(D.stockIntegrity(s), []);
});

test('STK-003: a sale movement points back at its ledger entry (source-linked)', () => {
  let s = shop();
  const coca = s.products[0].id;
  s = D.sell(s, { items: [{ id: coca, qty: 2 }] });
  const saleEntry = s.day.entries[s.day.entries.length - 1];
  const saleMove = D.stockMovementsFor(s, coca).find(function (m) { return m.kind === 'sale'; });
  assert.equal(saleMove.qty, -2);
  assert.equal(saleMove.ref, saleEntry.id, 'the sale movement references the sale entry that caused it');
});

test('STK-001: a manual stock edit is recorded as an adjust, never a silent overwrite', () => {
  let s = shop();
  const coca = s.products[0].id; // 10
  s = D.setProduct(s, coca, { stock: 7 }); // delta -3
  const adj = D.stockMovementsFor(s, coca).find(function (m) { return m.kind === 'adjust'; });
  assert.equal(adj.qty, -3);
  assert.equal(D.getProduct(s, coca).stock, 7);
  assert.deepStrictEqual(D.stockIntegrity(s), []);
});

test('STK-003: undoLastSale reverses the shelf through the ledger', () => {
  let s = shop();
  const coca = s.products[0].id;
  s = D.sell(s, { items: [{ id: coca, qty: 4 }] });
  assert.equal(D.getProduct(s, coca).stock, 6);
  s = D.undoLastSale(s);
  assert.equal(D.getProduct(s, coca).stock, 10);
  const kinds = D.stockMovementsFor(s, coca).map(function (m) { return m.kind; });
  assert.ok(kinds.indexOf('undo') >= 0, 'an undo movement was written');
  assert.deepStrictEqual(D.stockIntegrity(s), []);
});

test('STK-007 / RPT-006: the stock card returns one product; an unknown id returns null', () => {
  const s = shop();
  assert.equal(D.stockCard(s, 'nope'), null);
  const card = D.stockCard(s, s.products[0].id);
  assert.equal(card.product.name, 'Coca');
  assert.equal(card.product.id, s.products[0].id);
});

test('reconcileStock rebuilds on-hand from the ledger', () => {
  let s = shop();
  const coca = s.products[0].id;
  s = D.sell(s, { items: [{ id: coca, qty: 2 }] });
  s.products[0].stock = 999; // corrupt the counter behind the ledger's back
  const fixed = D.reconcileStock(s);
  assert.equal(D.getProduct(fixed, coca).stock, 8);
  assert.deepStrictEqual(D.stockIntegrity(fixed), []);
});

test('migration: a legacy save with no ledger gets an opening movement that reconciles', () => {
  const s = shop();
  delete s.movements;
  const restored = D.restoreState(JSON.parse(JSON.stringify(s)));
  assert.ok(Array.isArray(restored.movements), 'the ledger array is created');
  const coca = restored.products[0].id;
  const first = D.stockMovementsFor(restored, coca)[0];
  assert.equal(first.kind, 'opening');
  assert.equal(first.qty, 10, 'opening == the on-hand count it was saved with');
  assert.deepStrictEqual(D.stockIntegrity(restored), []);
});

test('the ledger never goes negative: oversell is refused and writes NO movement', () => {
  let s = shop();
  const coca = s.products[0].id;
  const before = D.stockMovementsFor(s, coca).length;
  assert.throws(function () { D.sell(s, { items: [{ id: coca, qty: 99 }] }); }, /not enough stock/);
  assert.equal(D.stockMovementsFor(s, coca).length, before, 'a refused sale changes nothing');
});
