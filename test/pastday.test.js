/* DEKKAN CORE — past-day browsing: the report of a closed day, same shape as today. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const D = require('../core/dekkan-core.js');

function shopWith(products) {
  let s = D.createShop({ name: 'Test', startCash: 100 });
  for (const p of products) s = D.addProduct(s, p);
  return s;
}
const COLA = { name: 'Cola', buy: 0.8, sell: 1.5, stock: 50 };

test('a closed day is browsable: sales, cash, entries of THAT day only', () => {
  let s = shopWith([COLA]);
  const id = s.products[0].id;
  s = D.sellAll(s, { items: [{ id, qty: 2 }] });          // today: +3, till 103
  s = D.closeDay(s);                                      // closed at 103
  const closedDate = s.days[s.days.length - 1].date;

  s = D.sellAll(s, { items: [{ id, qty: 1 }] });          // new open day: +1.5

  const r = D.dayReportFor(s, closedDate);
  assert.ok(r, 'a report comes back');
  assert.strictEqual(r.date, closedDate);
  assert.strictEqual(r.daySales, 3, 'only THAT day sales');
  assert.strictEqual(r.cash, 103, 'the closed till at close time');
  assert.strictEqual(r.entries.length, 1);
  assert.strictEqual(r.entries[0].no, 1, 'client #1 of that day');
});

test('dayReportFor(today) == the live report', () => {
  let s = shopWith([COLA]);
  const id = s.products[0].id;
  s = D.sellAll(s, { items: [{ id, qty: 1 }] });
  const r1 = D.stats(s);
  const r2 = D.dayReportFor(s, r1.date);
  assert.ok(r2);
  assert.strictEqual(r2.daySales, r1.daySales);
  assert.strictEqual(r2.cash, r1.cash);
});

test('an unknown date returns null (the UI shows the empty state)', () => {
  const s = shopWith([COLA]);
  assert.strictEqual(D.dayReportFor(s, '1999-01-01'), null);
});

test('a day with no dates passed falls back to today', () => {
  const s = shopWith([COLA]);
  assert.strictEqual(D.dayReportFor(s, null).date, D.stats(s).date);
});

test('cashiers of a past day come back with it', () => {
  let s = shopWith([COLA]);
  const id = s.products[0].id;
  s = D.sellAll(s, { items: [{ id, qty: 1 }], who: 'Amine' });
  s = D.closeDay(s);
  const closedDate = s.days[s.days.length - 1].date;
  const r = D.dayReportFor(s, closedDate);
  assert.deepStrictEqual(r.byCashier, [{ who: 'Amine', count: 1, total: 1.5 }]);
});

test('a refunded sale on a past day shows netted numbers', () => {
  let s = shopWith([COLA]);
  const id = s.products[0].id;
  s = D.sellAll(s, { items: [{ id, qty: 2 }] });            // +3
  s = D.refund(s, { items: [{ id, qty: 1 }] });             // -1.5 back
  s = D.closeDay(s);
  const closedDate = s.days[s.days.length - 1].date;
  const r = D.dayReportFor(s, closedDate);
  assert.strictEqual(r.daySales, 3);
  assert.strictEqual(r.dayRefunds, 1.5);
  assert.strictEqual(r.entries.length, 2);
});