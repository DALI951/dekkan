// DEKKAN CORE — state integrity validation (workbook SAL-004, TEN-002, NFR-002).
// RED-first: written before stateProblems existed.
// The minimum-viable server-side trust boundary: the API validates a pushed
// blob BEFORE storing it (ledger ⇔ counters reconcile, bills reconcile with
// entries, debts are well-formed, pin shape intact) and rejects with 409 —
// forged data never gets written anywhere it could be trusted later.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const D = require('../core/dekkan-core.ts');

test('a healthy shop has no problems', () => {
  let s = D.createShop({ name: 'T', startCash: 100 });
  s = D.addProduct(s, { name: 'Coca', buy: 0.8, sell: 1.5, stock: 10 });
  s = D.sellAll(s, { items: [{ id: s.products[0].id, qty: 2 }], paid: 3 });
  s = D.addDebt(s, { name: 'Ali', amount: 5 });
  s = D.payDebt(s, s.debts[0].id, { amount: 2 });
  s = D.expense(s, { amount: 1, note: 'x' });
  s = D.refund(s, { items: [{ id: s.products[0].id, qty: 1 }], reason: 'r' });
  assert.deepStrictEqual(D.stateProblems(s), []);
  // and it stays healthy through a day rollover
  s = D.closeDay(s);
  assert.deepStrictEqual(D.stateProblems(s), []);
});

test('forged stock counter (tampered product.stock) is caught by the ledger', () => {
  let s = D.createShop({ name: 'T', startCash: 100 });
  s = D.addProduct(s, { name: 'Coca', buy: 0.8, sell: 1.5, stock: 10 });
  s.products[0].stock = 9999; // attacker edits the counter, not the ledger
  const probs = D.stateProblems(s);
  assert.ok(probs.some(function (p) { return /stock counter/.test(p); }), JSON.stringify(probs));
});

test('forged negative stock is caught', () => {
  let s = D.createShop({ name: 'T', startCash: 100 });
  s = D.addProduct(s, { name: 'Coca', buy: 0.8, sell: 1.5, stock: 10 });
  s = D.sellAll(s, { items: [{ id: s.products[0].id, qty: 3 }], paid: 4.5 });
  s.products[0].stock = -2;
  const probs = D.stateProblems(s);
  assert.ok(probs.some(function (p) { return /negative stock/.test(p); }), JSON.stringify(probs));
});

test('a sale whose entry amount no longer matches its bill is caught', () => {
  let s = D.createShop({ name: 'T', startCash: 100 });
  s = D.addProduct(s, { name: 'Coca', buy: 0.8, sell: 1.5, stock: 10 });
  s = D.sellAll(s, { items: [{ id: s.products[0].id, qty: 2 }], paid: 3 });
  s.day.entries[0].amount = 1; // forged ledger math
  assert.ok(D.stateProblems(s).length > 0);
});

test('unknown entry kind and duplicate entry ids are caught', () => {
  let s = D.createShop({ name: 'T', startCash: 100 });
  s.day.entries.push({ id: 'x1', kind: 'transfer-dollars', amount: 5, note: 'shady' });
  assert.ok(D.stateProblems(s).some(function (p) { return /unknown entry kind/.test(p); }));
  s.day.entries.pop();
  s = D.addProduct(s, { name: 'Coca', buy: 1, sell: 2, stock: 5 });
  s = D.sellAll(s, { items: [{ id: s.products[0].id, qty: 1 }], paid: 2 });
  s = D.income(s, { amount: 3, note: 'found' });
  s.day.entries[1].id = s.day.entries[0].id; // duplicate ids across two real entries
  assert.ok(D.stateProblems(s).some(function (p) { return /duplicate entry id/.test(p); }));
});

test('a debt whose paid exceeds total is caught', () => {
  const s = D.createShop({ name: 'T', startCash: 100 });
  s.debts.push({ id: 'd1', name: 'Rami', total: 5, paid: 9, settled: true, payments: [], phone: '', note: '' });
  assert.ok(D.stateProblems(s).some(function (p) { return /paid exceeds total/.test(p); }));
});

test('a non-string pinHash and a stale version are caught', () => {
  let s = D.createShop({ name: 'T', startCash: 100 });
  s.settings.pinHash = { hacked: true };
  assert.ok(D.stateProblems(s).some(function (p) { return /pinHash/.test(p); }));
  s = D.createShop({ name: 'T', startCash: 100 });
  s.version = 3; // an old blob that never went through migration
  assert.ok(D.stateProblems(s).some(function (p) { return /version/.test(p); }));
});