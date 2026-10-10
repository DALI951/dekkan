// DEKKAN CORE — tax profiles (workbook CFG-005, TAX-001..003).
// RED-first: written before any tax code existed.
// The rules (workbook): rates are CONFIGURABLE with effective dates + ONE rounding
// policy, Tunisian defaults live in config (never hard-coded in posting code), and
// a posted line keeps a snapshot of the rate that was in force when it was posted.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const D = require('../core/dekkan-core.ts');

test('TAX-001: a fresh shop carries the Tunisian default profile (in config, effective from the past)', () => {
  const s = D.createShop({ name: 'T', startCash: 50 });
  const p = s.settings.tax.profiles[0];
  assert.ok(p, 'a default profile exists');
  assert.equal(p.code, 'TVA');
  assert.equal(p.rate, 0.19, 'Tunisian standard TVA rate is 19%');
  assert.ok(p.from <= '2000-01-01' || /^\d{4}-\d{2}-\d{2}$/.test(p.from), 'has an effective-from date');
  assert.equal(s.settings.tax.rounding, 'half-up', 'one rounding policy is configured');
  assert.deepStrictEqual(D.currentTax(s), { code: 'TVA', rate: 0.19 });
});

test('TAX-002: a posted sale keeps the rate snapshot even after the profile changes', () => {
  let s = D.createShop({ name: 'T', startCash: 50 });
  s = D.addProduct(s, { name: 'Coca', buy: 0.8, sell: 1.5, stock: 10 });
  s = D.sellAll(s, { items: [{ id: s.products[0].id, qty: 2 }], paid: 3 });
  const entry = s.day.entries[s.day.entries.length - 1];
  assert.deepStrictEqual(entry.bill.tax, { code: 'TVA', rate: 0.19 }, 'sale is stamped with the active profile');

  // the owner reconfigures the rate — the posted receipt must NOT follow
  s.settings.tax.profiles[0].rate = 0.07;
  assert.equal(D.currentTax(s).rate, 0.07);
  assert.equal(entry.bill.tax.rate, 0.19, 'the old receipt keeps its posted rate');
});

test('TAX-003: profiles activate by effective date; the latest-configured wins', () => {
  let s = D.createShop({ name: 'T', startCash: 50 });
  s.settings.tax.profiles.push({ code: 'TVA', name: 'TVA 7%', rate: 0.07, from: '2027-01-01', to: null });
  const t = s.settings.tax.profiles[0];
  assert.equal(D.taxProfileFor(s, '2026-10-10').rate, 0.19, 'today still uses the old rate');
  assert.equal(D.taxProfileFor(s, '2027-06-01').rate, 0.07, 'the new rate takes over from its date');
  assert.equal(D.taxProfileFor(s, '2026-01-01').rate, 0.19);
});

test('old saves without a tax config are repaired on load (settings.tax filled)', () => {
  const s = D.createShop({ name: 'T', startCash: 50 });
  delete s.settings.tax;
  const restored = D.restoreState(JSON.parse(JSON.stringify(s)));
  assert.ok(restored.settings.tax, 'tax config repaired');
  assert.equal(restored.settings.tax.rounding, 'half-up');
  assert.equal(restored.settings.tax.profiles[0].rate, 0.19);
});