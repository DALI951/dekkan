/* DEKKAN employees tests — the team: hire, edit, fire, and monthly salary math.
 * Run: node --test test/employees.test.js
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const D = require('../core/dekkan-core.ts');

function shop() {
  return D.createShop({ name: 'Test', startCash: 100 });
}

/* wave 6: hiring and giving the login are ONE action — an employee without one
   could never open the till, so addEmployee refuses. These tests are about the
   TEAM book, so they hire through this thin helper; the login rules themselves
   are pinned in test/accounts.test.ts. */
function hire(state, opts) {
  opts = opts || {};
  const who = 'u' + String(opts.name == null ? 'user' : opts.name).trim();
  return D.addEmployee(state, Object.assign({}, opts, {
    account: {
      name: who, role: 'cashier',
      salt: 'saltsaltsaltsalt',
      hash: 'hashhashhashhashhashhashhashhashhashhashhashhashhashhashhashhash',
      iters: 1000
    }
  }));
}

test('employees: a fresh shop starts with an empty team', () => {
  const s = shop();
  assert.ok(Array.isArray(s.employees));
  assert.strictEqual(s.employees.length, 0);
});

test('employees: addEmployee books the hire with every field', () => {
  let s = hire(shop(), { name: 'Ali', type: 'Cashier', salary: 300, phone: '+216 22', note: 'shifts' });
  s = hire(s, { name: 'Sarra', type: 'Cleaner', salary: 150 });
  assert.strictEqual(s.employees.length, 2);
  const a = s.employees[0];
  assert.ok(a.id);
  assert.strictEqual(a.name, 'Ali');
  assert.strictEqual(a.type, 'Cashier');
  assert.strictEqual(a.salary, 300);
  assert.strictEqual(a.phone, '+216 22');
  assert.strictEqual(a.note, 'shifts');
  assert.strictEqual(a.active, true);
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(a.hiredAt), 'hiredAt is a YYYY-MM-DD stamp');
  const b = s.employees[1];
  assert.strictEqual(b.phone, '', 'phone defaults to empty');
  assert.strictEqual(b.note, '', 'note defaults to empty');
});

test('employees: names and types are trimmed and required', () => {
  let s = hire(shop(), { name: '  Ali  ', type: ' بائع ', salary: 100 });
  assert.strictEqual(s.employees[0].name, 'Ali');
  assert.strictEqual(s.employees[0].type, 'بائع');
  assert.throws(() => hire(shop(), { name: '', type: 'x', salary: 0 }), /name/);
  assert.throws(() => hire(shop(), { name: '   ', type: 'x', salary: 0 }), /name/);
  assert.throws(() => hire(shop(), { name: 'Ali', type: '', salary: 0 }), /type/);
});

test('employees: salary must be a finite number >= 0', () => {
  assert.throws(() => hire(shop(), { name: 'A', type: 'x', salary: -1 }), /salary/);
  assert.throws(() => hire(shop(), { name: 'A', type: 'x', salary: NaN }), /salary/);
  assert.throws(() => hire(shop(), { name: 'A', type: 'x', salary: '300' }), /salary/);
  let s = hire(shop(), { name: 'A', type: 'x', salary: 0 });
  assert.strictEqual(s.employees[0].salary, 0);
});

test('employees: updateEmployee edits the editable fields only', () => {
  let s = hire(shop(), { name: 'Ali', type: 'Cashier', salary: 300 });
  const id = s.employees[0].id;
  const hiredAt = s.employees[0].hiredAt;
  s = D.updateEmployee(s, id, { name: 'Ali Jr', salary: 350, phone: '99' });
  const e = s.employees[0];
  assert.strictEqual(e.name, 'Ali Jr');
  assert.strictEqual(e.salary, 350);
  assert.strictEqual(e.phone, '99');
  assert.strictEqual(e.type, 'Cashier', 'fields not in the patch stay');
  assert.strictEqual(e.id, id);
  assert.strictEqual(e.hiredAt, hiredAt);
  assert.strictEqual(e.active, true);
  assert.throws(() => D.updateEmployee(s, 'nope', { name: 'X' }), /not found/);
  assert.throws(() => D.updateEmployee(s, id, { name: ' ' }), /name/);
  assert.throws(() => D.updateEmployee(s, id, { salary: -2 }), /salary/);
});

test('employees: fireEmployee marks the hire ended with a date', () => {
  let s = hire(shop(), { name: 'Ali', type: 'Cashier', salary: 300 });
  s = hire(s, { name: 'Sarra', type: 'Cleaner', salary: 150 });
  const id = s.employees[0].id;
  s = D.fireEmployee(s, id);
  assert.strictEqual(s.employees[0].active, false);
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(s.employees[0].firedAt));
  assert.strictEqual(s.employees[1].active, true, 'the rest of the team is untouched');
  assert.throws(() => D.fireEmployee(s, 'nope'), /not found/);
});

test('employees: salariesFor sums the payroll of one month', () => {
  const s = {
    employees: [
      { id: 'a', name: 'A', type: 'x', salary: 300, active: true, hiredAt: '2026-05-02' },
      { id: 'b', name: 'B', type: 'x', salary: 150, active: true, hiredAt: '2026-03-01' },
      { id: 'c', name: 'C', type: 'x', salary: 100, active: false, firedAt: '2026-05-20', hiredAt: '2026-01-10' },
      { id: 'd', name: 'D', type: 'x', salary: 200, active: false, firedAt: '2026-04-28', hiredAt: '2026-01-10' },
      { id: 'e', name: 'E', type: 'x', salary: 400, active: true, hiredAt: '2026-06-01' }
    ]
  };
  assert.strictEqual(D.salariesFor(s, '2026-05'), 550,
    'May: a. b active, c fired mid-May; d fired before May, e hired after');
  assert.strictEqual(D.salariesFor(s, '2026-06'), 850,
    'June: a. b still active this month + e joins; c, d are out');
  assert.strictEqual(D.salariesFor(s, '2026-04'), 450,
    'April: b, c, d worked all month; a not hired yet, e not hired yet');
  assert.strictEqual(D.salariesFor({}, '2026-05'), 0, 'a book with no team owes no salary');
});