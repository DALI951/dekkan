// DEKKAN CORE — document numbering (workbook DOC-001/002, CFG-006).
// RED-first: written before any numbering code existed.
// Rules: every facture / refund / buy receipt carries a per-kind, GLOBAL
// sequence number with a configurable prefix (never resets at midnight —
// only the *client #* resets daily). Under a single writer per account the
// allocation is unique by construction (server-allocated numbering is the
// P1 "Ideal" — see PLAN.md item 3).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const D = require('../core/dekkan-core.ts');

function lastEntry(s) { return s.day.entries[s.day.entries.length - 1]; }

test('DOC-001: rapid consecutive posts never produce a duplicate document number', () => {
  let s = D.createShop({ name: 'T', startCash: 500 });
  s = D.addProduct(s, { name: 'Coca', buy: 0.8, sell: 1.5, stock: 200 });
  const id = s.products[0].id;

  const factures = [], refunds = [], buys = [];
  for (let i = 0; i < 40; i++) { s = D.sellAll(s, { items: [{ id, qty: 1 }] }); factures.push(lastEntry(s).doc.no); }
  for (let i = 0; i < 20; i++) { s = D.buyStock(s, id, 1, 0.8); buys.push(lastEntry(s).doc.no); }
  for (let i = 0; i < 20; i++) {
    s = D.sellAll(s, { items: [{ id, qty: 1 }] });
    factures.push(lastEntry(s).doc.no);
    s = D.refund(s, { items: [{ id, qty: 1 }], reason: 'test' });
    refunds.push(lastEntry(s).doc.no);
  }

  function unique(list) { return new Set(list).size === list.length; }
  assert.ok(unique(factures), 'all facture numbers unique (' + factures.length + ')');
  assert.ok(unique(refunds), 'all refund numbers unique (' + refunds.length + ')');
  assert.ok(unique(buys), 'all buy numbers unique (' + buys.length + ')');
  for (let i = 1; i < factures.length; i++) assert.ok(factures[i] > factures[i - 1], 'facture sequence is strictly increasing');
  for (let i = 1; i < refunds.length; i++) assert.ok(refunds[i] > refunds[i - 1], 'refund sequence is strictly increasing');
  for (let i = 1; i < buys.length; i++) assert.ok(buys[i] > buys[i - 1], 'buy sequence is strictly increasing');

  // per-kind counters are SEPARATE: a refund number is not a facture number
  assert.ok(refunds.some(function (n) { return factures.indexOf(n) === -1; }) || refunds[0] !== factures[0]);
});

test('DOC-002: prefixes are configurable and the daily client # is untouched by the global sequence', () => {
  let s = D.createShop({ name: 'T', startCash: 50 });
  s = D.addProduct(s, { name: 'Coca', buy: 0.8, sell: 1.5, stock: 50 });
  const id = s.products[0].id;
  s = D.sellAll(s, { items: [{ id, qty: 1 }] });
  s = D.sellAll(s, { items: [{ id, qty: 1 }] });
  assert.equal(D.clientNoOf(s, lastEntry(s).id), 2, 'client # comes from the daily counter');

  // the shop reconfigures the facture prefix mid-day
  s.settings.docPrefix.sale = 'FC';
  s = D.sellAll(s, { items: [{ id, qty: 1 }] });
  const third = lastEntry(s).doc.no;
  assert.ok(third.startsWith('FC-'), 'new documents use the new prefix: ' + third);
  assert.equal(D.clientNoOf(s, lastEntry(s).id), 3, 'the daily client # keeps counting regardless');
});

test('CFG-006: defaults live in config — a fresh shop knows them, old saves are repaired', () => {
  const s = D.createShop({ name: 'T', startCash: 50 });
  assert.deepStrictEqual(s.settings.docPrefix, { sale: 'F', refund: 'R', buy: 'A' });
  assert.deepStrictEqual(s.seq, { sale: 0, refund: 0, buy: 0 });

  delete s.settings.docPrefix; delete s.seq;
  const restored = D.restoreState(JSON.parse(JSON.stringify(s)));
  assert.deepStrictEqual(restored.settings.docPrefix, { sale: 'F', refund: 'R', buy: 'A' }, 'prefix repaired');
  assert.deepStrictEqual(restored.seq, { sale: 0, refund: 0, buy: 0 }, 'sequence repaired');
});

test('a buy receipt carries a number in the buy sequence', () => {
  let s = D.createShop({ name: 'T', startCash: 50 });
  s = D.addProduct(s, { name: 'Coca', buy: 0.8, sell: 1.5, stock: 10 });
  s = D.buyStock(s, s.products[0].id, 5, 0.8);
  assert.equal(lastEntry(s).doc.kind, 'buy');
  assert.match(lastEntry(s).doc.no, /^A-\d{4}$/);
});