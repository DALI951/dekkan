// DEKKAN CORE — ADJUSTMENT REASON CODES (workbook M04: "adjustments + reasons").
// RED-first: this file was written BEFORE the codes existed.
// The rule: a manual stock edit is an ADJUSTMENT, and an adjustment must say WHY.
// The reason is a code from a closed vocabulary, it lives on the MOVEMENT (the
// audit trail), never on the product (the catalogue), and a refused adjustment
// writes NOTHING.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const D = require('../core/dekkan-core.ts');

function shop() {
  let s = D.createShop({ name: 'Cafe', startCash: 50 });
  s = D.addProduct(s, { name: 'Coca', buy: 0.8, sell: 1.5, stock: 10, lowAt: 3 });
  return s;
}

test('M04: the reason vocabulary is closed and known', () => {
  assert.deepStrictEqual(D.STOCK_REASONS, ['count', 'damage', 'loss', 'other']);
  D.STOCK_REASONS.forEach(function (code) {
    assert.strictEqual(D.isStockReason(code), true, code + ' is a code');
  });
  assert.strictEqual(D.isStockReason('whatever'), false);
  assert.strictEqual(D.isStockReason(''), false);
  assert.strictEqual(D.isStockReason(null), false);
  assert.strictEqual(D.isStockReason(undefined), false);
});

test('M04: an adjustment with NO reason is refused and changes nothing', () => {
  const s = shop();
  const id = s.products[0].id;
  const before = JSON.stringify(s);
  assert.throws(function () { D.setProduct(s, id, { stock: 7 }); }, /toast\.stockReason/);
  assert.strictEqual(JSON.stringify(s), before, 'a refused adjustment writes nothing');
  assert.strictEqual(D.getProduct(s, id).stock, 10);
});

test('M04: an unknown reason code is refused', () => {
  const s = shop();
  const id = s.products[0].id;
  assert.throws(function () { D.setProduct(s, id, { stock: 7, stockReason: 'because' }); }, /toast\.stockReason/);
  assert.strictEqual(D.getProduct(s, id).stock, 10);
});

test('M04: an adjustment with a code records the movement and moves the counter', () => {
  let s = shop();
  const id = s.products[0].id;
  s = D.setProduct(s, id, { stock: 7, stockReason: 'damage' });
  const adj = D.stockMovementsFor(s, id).find(function (m) { return m.kind === 'adjust'; });
  assert.ok(adj, 'the adjustment is on the ledger');
  assert.strictEqual(adj.qty, -3);
  assert.strictEqual(adj.reason, 'damage');
  assert.strictEqual(D.getProduct(s, id).stock, 7);
  assert.deepStrictEqual(D.stockIntegrity(s), []);
});

test('M04: a no-op stock edit needs no reason and writes NO movement', () => {
  let s = shop();
  const id = s.products[0].id;
  const moves = D.stockMovementsFor(s, id).length;
  s = D.setProduct(s, id, { stock: 10 }); // same count — not a change
  assert.strictEqual(D.stockMovementsFor(s, id).length, moves, 'nothing to explain');
});

test('M04: a non-stock edit (price only) needs no reason', () => {
  let s = shop();
  const id = s.products[0].id;
  s = D.setProduct(s, id, { sell: 1.8, name: 'Coca 33' });
  assert.strictEqual(D.getProduct(s, id).sell, 1.8);
  assert.strictEqual(D.stockMovementsFor(s, id).length, 1, 'still just the opening move');
});

test('M04: the reason stays on the movement, never on the product', () => {
  let s = shop();
  const id = s.products[0].id;
  s = D.setProduct(s, id, { stock: 9, stockReason: 'count' });
  assert.strictEqual('stockReason' in D.getProduct(s, id), false, 'the catalogue is untouched');
  assert.deepStrictEqual(Object.keys(D.getProduct(s, id)).sort(), ['buy', 'id', 'lowAt', 'name', 'sell', 'sku', 'stock']);
});

test('RPT-006: the stock card shows each adjustment with its reason', () => {
  let s = shop();
  const id = s.products[0].id;
  s = D.setProduct(s, id, { stock: 12, stockReason: 'count' });
  s = D.setProduct(s, id, { stock: 11, stockReason: 'loss' });
  const card = D.stockCard(s, id);
  assert.deepStrictEqual(card.moves.map(function (m) { return m.reason; }), [null, 'count', 'loss']);
  assert.strictEqual(card.balance, 11);
  assert.strictEqual(card.stock, 11);
});

test('M04: a note is still optional free text and never masquerades as a reason', () => {
  let s = shop();
  const id = s.products[0].id;
  s = D.setProduct(s, id, { stock: 6, stockReason: 'other', stockNote: 'broken crate' });
  const adj = D.stockMovementsFor(s, id).find(function (m) { return m.kind === 'adjust'; });
  assert.strictEqual(adj.reason, 'other');
  assert.strictEqual(adj.note, 'broken crate');
  const plain = D.stockMovementsFor(s, id).find(function (m) { return m.kind === 'opening'; });
  assert.strictEqual(plain.reason, null, 'movements that need no reason carry null, not a guess');
});
