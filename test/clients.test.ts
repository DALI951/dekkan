'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const D = require('../core/dekkan-core.js');

function shopWithClientStory() {
  let s = D.createShop({ name: 'T', startCash: 100 });
  s = D.addProduct(s, { name: 'Coca', buy: 0.8, sell: 1.5, stock: 10 });
  const pid = s.products[0].id;
  s = D.sellAll(s, { items: [{ id: pid, qty: 2 }], customer: 'Ali', phone: '222', paid: 3 });
  s = D.sellAll(s, { free: [{ name: 'Delivery', qty: 1, price: 4 }], customer: 'Ali', paid: 1 });
  const saleNo = D.clientNoOf(s, s.day.entries.filter(e => e.kind === 'sale')[0].id);
  s = D.refund(s, { items: [{ id: pid, qty: 1 }], reason: 'returned', saleNo: saleNo });
  const debt = s.debts.find(d => d.name === 'Ali');
  s = D.payDebt(s, debt.id, { amount: 2 });
  return s;
}

test('clientsReport: saved clients get purchases, refunds, debts and payments', () => {
  const r = D.clientsReport(shopWithClientStory());
  assert.strictEqual(r.clients.length, 1);
  const ali = r.clients[0];
  assert.strictEqual(ali.name, 'Ali');
  assert.strictEqual(ali.phone, '222');
  assert.strictEqual(ali.purchases, 7);
  assert.strictEqual(ali.refunds, 1.5);
  assert.strictEqual(ali.debtAdded, 3);
  assert.strictEqual(ali.debtPaid, 2);
  assert.strictEqual(ali.owed, 1);
  assert.ok(ali.history.some(x => x.kind === 'sale' && x.lines.indexOf('Coca x2') !== -1));
  assert.ok(ali.history.some(x => x.kind === 'refund' && x.saleNo === 1));
  assert.ok(ali.history.some(x => x.kind === 'debt-pay'));
});

test('clientProfile: unknown names return an empty profile', () => {
  const p = D.clientProfile(shopWithClientStory(), 'Nobody');
  assert.strictEqual(p.name, 'Nobody');
  assert.strictEqual(p.purchases, 0);
  assert.strictEqual(p.history.length, 0);
});
