/* DEKKAN monthly tests — the month in review: total wins/losses/profit with
 * salaries cut out of the losses. report.dayReport() only knows today, so
 * this is a second lens on the SAME ledger (day.entries + closed days).
 * Run: node --test test/monthly.test.js
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const D = require('../core/dekkan-core.js');

const pad = n => (n < 10 ? '0' : '') + n;
const locDay = iso => {           // the LOCAL date of a stamp — same rule the app uses
  const d = new Date(iso);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
};

let n = 0;
function ent(kind, amount, at) {
  return { id: 'e' + (++n), kind, amount, at: at || '2026-05-15T12:00:00.000Z', note: '', ref: '', bill: 0 };
}

const MAY = '2026-05';

// a real-shaped state with our own entries; employees optional (old saves lack it)
function mk(opts) {
  opts = opts || {};
  return {
    version: 3, shop: { name: 'T' }, settings: {},
    employees: opts.employees,
    categories: { in: [], out: [] },
    day: { date: '2026-05-15', startCash: 100, openedAt: '2026-05-15T09:00:00.000Z', soldCost: 0, entries: opts.dayEntries || [], checks: [] },
    days: (opts.oldEntries || []).length
      ? [{ date: '2026-05-06', startCash: 0, openedAt: 'x', soldCost: 0, entries: opts.oldEntries, checks: [] }]
      : [],
    products: [], customers: [], debts: [], sales: []
  };
}

test('monthly: an empty month is a clean slate', () => {
  const r = D.monthlyReport(mk(), MAY);
  assert.strictEqual(r.month, MAY);
  assert.strictEqual(r.sales, 0);
  assert.strictEqual(r.wins, 0);
  assert.strictEqual(r.losses, 0);
  assert.strictEqual(r.profit, 0);
  assert.strictEqual(r.moves, 0);
  assert.deepStrictEqual(r.days, []);
});

test('monthly: wins, losses and profit follow the money moves', () => {
  const r = D.monthlyReport(mk({
    dayEntries: [
      ent('sale', 40),        // +40
      ent('debt-pay', 10),    // +10
      ent('income', 5),       // +5
      ent('refund', -6),      // -6
      ent('expense', -4)      // -4
    ],
    oldEntries: [
      ent('buy', -12),        // -12
      ent('sale', 25)         // +25
    ]
  }), MAY);
  assert.strictEqual(r.sales, 65);
  assert.strictEqual(r.debtPays, 10);
  assert.strictEqual(r.incomes, 5);
  assert.strictEqual(r.refunds, 6);
  assert.strictEqual(r.buys, 12);
  assert.strictEqual(r.expenses, 4);
  assert.strictEqual(r.salaries, 0);
  assert.strictEqual(r.wins, 80, 'sale + debt-pay + income');
  assert.strictEqual(r.losses, 22, 'refund + buy + expense');
  assert.strictEqual(r.profit, 58);
  assert.strictEqual(r.moves, 7);
});

test('monthly: salaries are part of the month losses', () => {
  const r = D.monthlyReport(mk({
    dayEntries: [ent('sale', 100), ent('expense', -10)],
    employees: [
      { id: 'a', name: 'Ali', type: 'Cashier', salary: 300, active: true, hiredAt: '2026-05-02' },
      { id: 'b', name: 'Sarra', type: 'Cleaner', salary: 150, active: false, firedAt: '2026-05-10', hiredAt: '2026-01-01' }
    ]
  }), MAY);
  assert.strictEqual(r.salaries, 450);
  assert.strictEqual(r.losses, 460);
  assert.strictEqual(r.profit, -360, 'a month can lose money');
});

test('monthly: only the requested month counts', () => {
  const r = D.monthlyReport(mk({
    dayEntries: [
      ent('sale', 30, '2026-05-10T12:00:00.000Z'),
      ent('sale', 40, '2026-04-15T12:00:00.000Z'),
      ent('expense', -9, '2026-06-15T12:00:00.000Z'),
      ent('sale', 20, '2026-05-20T12:00:00.000Z')
    ]
  }), MAY);
  assert.strictEqual(r.sales, 50, 'April and June sales stay out');
  assert.strictEqual(r.expenses, 0, 'June expense stays out');
  assert.strictEqual(r.moves, 2);
});

test('monthly: the report breaks the month into per-day rows', () => {
  const a = ent('sale', 10, '2026-05-05T12:00:00.000Z');
  const b = ent('sale', 20, '2026-05-20T12:00:00.000Z');
  const c = ent('expense', -7, '2026-05-20T12:00:00.000Z');
  const r = D.monthlyReport(mk({ dayEntries: [a, b, c] }), MAY);
  assert.strictEqual(r.days.length, 2);
  const d1 = r.days[0];
  const d2 = r.days[1];
  assert.strictEqual(d1.date, locDay(a.at), 'row key is the LOCAL date');
  assert.strictEqual(d1.in, 10);
  assert.strictEqual(d1.out, 0);
  assert.strictEqual(d2.date, locDay(b.at));
  assert.strictEqual(d2.in, 20);
  assert.strictEqual(d2.out, 7, 'out takes the abs of negative moves');
});

test('monthly: old saves without an employees key still report', () => {
  const s = mk({ dayEntries: [ent('sale', 55)] });
  delete s.employees;
  const r = D.monthlyReport(s, MAY);
  assert.strictEqual(r.sales, 55);
  assert.strictEqual(r.salaries, 0);
});

test('monthly: entries without a usable timestamp are ignored, not fatal', () => {
  const e = ent('sale', 9);
  delete e.at;
  const r = D.monthlyReport(mk({ dayEntries: [e, ent('sale', 3, '2026-05-01T12:00:00.000Z')] }), MAY);
  assert.strictEqual(r.sales, 3);
});