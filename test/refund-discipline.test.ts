// DEKKAN CORE — refund discipline (P0-9). RED-first: written before the core
// REQUIRED a reason.
// RET-001: a refund always carries a reason — no reason, no refund.
// RET-003: a refund is ADDITIVE. The original sale entry is never deleted or
//          altered ("no silent delete"); history grows, it does not rewrite.
// SALE-007: a ticket is a frozen snapshot — re-reading it later returns the
//          numbers that were true when it was rung, not today's prices.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const D = require('../core/dekkan-core.ts');

function shop() {
  let s = D.createShop({ name: 'T', startCash: 100 });
  s = D.addProduct(s, { name: 'Coca', buy: 0.8, sell: 1.5, stock: 10 });
  s = D.sell(s, { items: [{ id: s.products[0].id, qty: 3 }], paid: 4.5 });
  return s;
}
const id = s => s.products[0].id;
const refundEntries = s => s.day.entries.filter(e => e.kind === 'refund');

test('RET-001: a refund with no reason is refused', () => {
  const s = shop();
  assert.throws(function () { D.refund(s, { items: [{ id: id(s), qty: 1 }] }); }, /refundReason/);
  assert.throws(function () { D.refund(s, { items: [{ id: id(s), qty: 1 }], reason: '   ' }); }, /refundReason/);
  // and nothing moved: the shelf, the till and the ledger are all untouched
  assert.strictEqual(s.products[0].stock, 7);
  assert.strictEqual(refundEntries(s).length, 0);
});

test('RET-001b: a refund WITH a reason records that reason on the entry', () => {
  const s0 = shop();
  const s = D.refund(s0, { items: [{ id: id(s0), qty: 1 }], reason: 'bad bottle' });
  const r = refundEntries(s)[0];
  assert.strictEqual(r.kind, 'refund');
  assert.strictEqual(r.reason, 'bad bottle');
  assert.strictEqual(s.products[0].stock, 8, 'the bottle went back on the shelf');
  assert.strictEqual(r.amount, -1.5, 'and the drawer gave the money back');
});

test('RET-001c: refundFree also demands a reason', () => {
  let s = D.createShop({ name: 'T', startCash: 50 });
  s = D.sellFree(s, { name: 'Ice', price: 0.5, qty: 2, paid: 1 });
  assert.throws(function () { D.refundFree(s, { name: 'Ice', qty: 1 }); }, /refundReason/);
  s = D.refundFree(s, { name: 'Ice', qty: 1, reason: 'melted' });
  assert.strictEqual(refundEntries(s)[0].reason, 'melted');
});

test('RET-003: a refund never deletes or rewrites the sale it came from', () => {
  const s0 = shop();
  const saleBefore = JSON.parse(JSON.stringify(s0.day.entries.filter(e => e.kind === 'sale')[0]));
  const s = D.refund(s0, { items: [{ id: id(s0), qty: 1 }], reason: 'returned' });
  const saleAfter = s.day.entries.filter(e => e.kind === 'sale');
  assert.strictEqual(saleAfter.length, 1, 'the original sale is still there');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(saleAfter[0])), saleBefore,
    'the sale entry is byte-for-byte unchanged — a refund only ADDS a line');
  // the ledger is append-only: the refund is a NEW entry after the sale
  const kinds = s.day.entries.map(e => e.kind);
  assert.strictEqual(kinds.indexOf('sale') < kinds.indexOf('refund'), true);
});

test('SALE-007: a ticket is a frozen snapshot, not a live view of today prices', () => {
  const s1 = shop();
  const sale = s1.day.entries.filter(e => e.kind === 'sale')[0];
  const frozen = JSON.parse(JSON.stringify(sale.bill));
  // the shop raises the price afterwards
  const s2 = D.setProduct(s1, id(s1), { sell: 9.9 });
  const sale2 = s2.day.entries.filter(e => e.kind === 'sale')[0];
  assert.deepStrictEqual(JSON.parse(JSON.stringify(sale2.bill)), frozen,
    'the stored bill did not follow the new price — a reprint shows history');
  assert.strictEqual(sale2.bill.lines[0].price, 1.5, 'the line still says 1.500');
});