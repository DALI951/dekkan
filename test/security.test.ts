// DEKKAN CORE — RBAC light (SEC-001): Owner vs Cashier, server-side enforced.
// RED-first: written before canApply existed.
// Rules: the OWNER may change anything (PIN included, it's their till); a
// CASHIER may run the shop day-to-day (prices, sales, debts, expenses) but
// can NEVER touch the lock — settings.pinHash / settings.pinSalt — not even
// wipe them. The PIN stays the in-app action gate; the role is the server's.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const D = require('../core/dekkan-core.ts');

function pinState(seed) {
  let s = D.createShop({ name: 'T', startCash: 50 });
  s = D.addProduct(s, { name: 'Coca', buy: 0.8, sell: 1.5, stock: 10 });
  s = D.setPin(s, '1234');
  return s;
}

test('SEC-001: a cashier cannot change or wipe the PIN — the owner can', () => {
  const base = pinState();
  const changed = D.setPin(pinState(), '9999');
  const wiped = pinState(); delete wiped.settings.pinHash;

  // cashier: anything that touches the lock is denied
  assert.equal(D.canApply('cashier', base, changed).ok, false, 'cashier may not change the pin');
  assert.equal(D.canApply('cashier', base, wiped).ok, false, 'cashier may not wipe the pin');
  // owner: the same actions are fine
  assert.equal(D.canApply('owner', base, changed).ok, true, 'owner changes the pin');
  assert.equal(D.canApply('owner', base, wiped).ok, true, 'owner may wipe the pin (their choice)');
  // a cashier acting on a state WITHOUT the lock field is still denied if the change introduces it
  const gainsPin = D.setPin(pinState(), '4242');
  const clean = pinState(); delete clean.settings.pinHash; delete clean.settings.pinSalt;
  assert.equal(D.canApply('cashier', clean, gainsPin).ok, false, 'cashier may not ADD a pin either');
});

test('SEC-001: a cashier keeps the day-to-day powers — prices, sales, expenses', () => {
  const base = pinState();
  const repriced = D.setProduct(base, base.products[0].id, { sell: 1.6 });
  assert.equal(D.canApply('cashier', base, repriced).ok, true, 'cashier can change prices');
  // the sale day runs ON THE SAME shop (same lock, same salt) — only business moves
  let s = D.sellAll(base, { items: [{ id: base.products[0].id, qty: 1 }], paid: 1.5 });
  s = D.expense(s, { amount: 2, note: 'water' });
  assert.equal(D.canApply('cashier', base, s).ok, true, 'cashier can ring sales and expenses');
});

test('leftover from P0-1: the PIN still gates in-app actions and never leaves settings', () => {
  const s = D.setPin(pinState(), '4321');
  assert.equal(D.checkPin(s, '4321'), true);
  assert.equal(D.checkPin(s, '0000'), false);
  assert.ok(s.settings.pinHash && typeof s.settings.pinHash === 'string');
  assert.ok(s.settings.pinSalt && typeof s.settings.pinSalt === 'string');
});