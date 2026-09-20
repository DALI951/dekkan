/* DEKKAN tickets — every sale entry must carry its FULL bill (the facture):
 * lines (name, qty, price, total), discount, net, paid, rest, change.
 * The report lists tickets from these bills and the printer re-renders them.
 * Run: node --test
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const D = require('../core/dekkan-core.js');

function shop() {
  let s = D.createShop({ name: 'Test', startCash: 50 });
  s = D.addProduct(s, { name: 'Coca', buy: 0.8, sell: 1.5, stock: 10, lowAt: 3 });
  s = D.addProduct(s, { name: 'Biscuit', buy: 1.1, sell: 1.75, stock: 10, lowAt: 3 });
  return { s, coca: s.products[0].id, biscuit: s.products[1].id };
}

test('a plain cash sale stores its full bill on the sale entry', () => {
  const { s: s0, coca } = shop();
  const s = D.sellAll(s0, { items: [{ id: coca, qty: 2 }], paid: 3 }); // 3.00 exact

  const e = s.day.entries[s.day.entries.length - 1];
  assert.strictEqual(e.kind, 'sale');
  assert.ok(e.bill, 'the entry carries its bill');
  assert.deepStrictEqual(e.bill.lines, [{ id: coca, name: 'Coca', qty: 2, price: 1.5, total: 3 }]);
  assert.strictEqual(e.bill.discount, 0);
  assert.strictEqual(e.bill.net, 3);
  assert.strictEqual(e.bill.paid, 3);
  assert.strictEqual(e.bill.rest, 0);
  assert.strictEqual(e.bill.change, 0);
  assert.strictEqual(e.amount, 3, 'the ledger math is untouched by the bill');
});

test('overpay: the bill says what was handed and the change, entry.amount stays net', () => {
  const { s: s0, coca } = shop();
  const s = D.sellAll(s0, { items: [{ id: coca, qty: 1 }], paid: 5 }); // 1.50 bill, 3.50 change

  const e = s.day.entries[s.day.entries.length - 1];
  assert.strictEqual(e.amount, 1.5, 'the till only ever banks the net');
  assert.strictEqual(e.bill.paid, 5);
  assert.strictEqual(e.bill.change, 3.5);
  assert.strictEqual(e.bill.rest, 0);
});

test('partial payment: the bill splits handed money and the rest on the customer', () => {
  const { s: s0, coca } = shop();
  let s = D.sellAll(s0, { items: [{ id: coca, qty: 4 }], paid: 2, customer: 'Samir' }); // 6.00 bill

  const e = s.day.entries[s.day.entries.length - 1];
  assert.strictEqual(e.kind, 'sale');
  assert.strictEqual(e.note, 'Samir', 'the entry names the customer');
  assert.strictEqual(e.amount, 2, 'cash took only the handed 2');
  assert.strictEqual(e.bill.net, 6);
  assert.strictEqual(e.bill.paid, 2);
  assert.strictEqual(e.bill.rest, 4);
  assert.strictEqual(e.bill.change, 0);
});

test('full credit: no paid, the whole net is the rest, entry.amount is 0', () => {
  const { s: s0, coca } = shop();
  const s = D.sellAll(s0, { items: [{ id: coca, qty: 2 }], customer: 'Amine' });

  const e = s.day.entries[s.day.entries.length - 1];
  assert.strictEqual(e.amount, 0, 'no cash moved');
  assert.strictEqual(e.bill.paid, null, 'nothing was handed over');
  assert.strictEqual(e.bill.rest, 3);
  assert.strictEqual(e.bill.change, 0);
});

test('discount: the bill keeps the discount and the reduced net', () => {
  const { s: s0, coca } = shop();
  const s = D.sellAll(s0, { items: [{ id: coca, qty: 4 }], discount: { percent: 50 }, paid: 3 }); // 6 -> 3

  const e = s.day.entries[s.day.entries.length - 1];
  assert.strictEqual(e.bill.discount, 3);
  assert.strictEqual(e.bill.net, 3);
  assert.strictEqual(e.bill.lines.length, 1, 'lines keep the raw prices');
  assert.strictEqual(e.bill.lines[0].total, 6, 'the line shows 4 x 1.5 BEFORE the cut');
});

test('a mixed basket (stock + free) is ONE bill with ALL its lines', () => {
  const { s: s0, coca } = shop();
  const s = D.sellAll(s0, {
    items: [{ id: coca, qty: 1 }],
    free: [{ name: 'Cafe', price: 1, qty: 2 }],
    paid: 3.5
  }); // 1.5 + 2.0 = 3.5 exact

  const e = s.day.entries[s.day.entries.length - 1];
  assert.strictEqual(e.bill.lines.length, 2);
  assert.deepStrictEqual(e.bill.lines[0], { id: coca, name: 'Coca', qty: 1, price: 1.5, total: 1.5 });
  assert.deepStrictEqual(e.bill.lines[1], { name: 'Cafe', qty: 2, price: 1, total: 2 });
  assert.strictEqual(e.bill.net, 3.5);
});

test('legacy sell() and sellFree() also stamp their bills on the entry', () => {
  const { s: s0, biscuit } = shop();
  let s = D.sell(s0, { items: [{ id: biscuit, qty: 1 }], creditTo: 'Rami' });
  let e = s.day.entries[s.day.entries.length - 1];
  assert.strictEqual(e.kind, 'sale');
  assert.deepStrictEqual(e.bill.lines, [{ id: biscuit, name: 'Biscuit', qty: 1, price: 1.75, total: 1.75 }]);
  assert.strictEqual(e.bill.rest, 1.75, 'full credit rest');

  s = D.sellFree(s, { name: 'Coffee', price: 0.5, qty: 2 });
  e = s.day.entries[s.day.entries.length - 1];
  assert.deepStrictEqual(e.bill.lines, [{ name: 'Coffee', qty: 2, price: 0.5, total: 1 }]);
});

test('non-sale entries carry NO bill', () => {
  const { s: s0, coca } = shop();
  let s = D.sellAll(s0, { items: [{ id: coca, qty: 1 }], paid: 1.5 });
  s = D.refund(s, { items: [{ id: coca, qty: 1 }] });

  const refund = s.day.entries[s.day.entries.length - 1];
  assert.strictEqual(refund.kind, 'refund');
  assert.strictEqual(refund.bill, null);
});

test('bills survive a day close — history tickets keep their detail', () => {
  const { s: s0, coca } = shop();
  let s = D.sellAll(s0, { items: [{ id: coca, qty: 2 }], paid: 3, customer: 'Samir' });
  s = D.closeDay(s); // freeze day 1 into history
  s = D.sellAll(s, { items: [{ id: coca, qty: 1 }], paid: 1.5 }); // day 2, fresh

  const hist = s.days[s.days.length - 1];
  assert.ok(hist.entries[0].bill, 'the frozen entry kept its bill');
  assert.strictEqual(hist.entries[0].bill.net, 3);
  assert.strictEqual(s.day.entries[0].bill.net, 1.5, 'and the new day has its own');
});

test('refund carries the number of the sale it reversed', () => {
  const { s: s0, coca } = shop();
  let s = D.sellAll(s0, { items: [{ id: coca, qty: 2 }], paid: 3 }); // sale #1
  const saleId = s.day.entries[s.day.entries.length - 1].id;
  const saleNo = D.clientNoOf(s, saleId); // derived, 1-based — the # the receipt showed
  assert.strictEqual(saleNo, 1, 'the sale took number 1');
  s = D.refund(s, { items: [{ id: coca, qty: 2 }], saleNo: saleNo });
  const r = s.day.entries[s.day.entries.length - 1];
  assert.strictEqual(r.kind, 'refund');
  assert.strictEqual(r.saleNo, saleNo, 'the refund says which sale it undid');

  s = D.refundFree(s, { name: 'Cafe', qty: 1, price: 2, saleNo: 7 });
  const rf = s.day.entries[s.day.entries.length - 1];
  assert.strictEqual(rf.saleNo, 7, 'and free-line refunds too');
});