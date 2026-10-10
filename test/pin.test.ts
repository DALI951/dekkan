/* DEKKAN CORE — owner PIN: set/clear/check, never stored plaintext. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const D = require('../core/dekkan-core.js');

test('a fresh shop has no PIN', () => {
  const s = D.createShop({ name: 'Test' });
  assert.strictEqual(D.hasPin(s), false);
  assert.strictEqual(D.checkPin(s, '1234'), true); // no lock = anything passes
});

test('setPin stores a hash, never the digits', () => {
  let s = D.createShop({ name: 'Test' });
  s = D.setPin(s, '2580');
  assert.strictEqual(D.hasPin(s), true);
  assert.notStrictEqual(s.settings.pinHash, '2580');
  assert.ok(!String(s.settings.pinHash).includes('2580'));
  assert.ok(s.settings.pinSalt);
});

test('the right PIN unlocks it, the wrong one does not', () => {
  let s = D.createShop({ name: 'Test' });
  s = D.setPin(s, '2580');
  assert.strictEqual(D.checkPin(s, '2580'), true);
  assert.strictEqual(D.checkPin(s, '0000'), false);
  assert.strictEqual(D.checkPin(s, ''), false);
  assert.strictEqual(D.checkPin(s, '2580 '), false); // no sneaky spaces
});

test('clearPin removes the lock entirely', () => {
  let s = D.createShop({ name: 'Test' });
  s = D.setPin(s, '1234');
  s = D.clearPin(s);
  assert.strictEqual(D.hasPin(s), false);
  assert.strictEqual(D.checkPin(s, '1234'), true);
});

test('PIN rules: 4-6 digits only, and it can be changed', () => {
  let s = D.createShop({ name: 'Test' });
  assert.throws(() => D.setPin(s, '123'), /4-6 digits/);
  assert.throws(() => D.setPin(s, '1234567'), /4-6 digits/);
  assert.throws(() => D.setPin(s, 'abc1'), /4-6 digits/);
  s = D.setPin(s, '12345'); // 5 digits fine
  assert.strictEqual(D.checkPin(s, '12345'), true);
  s = D.setPin(s, '9999'); // change
  assert.strictEqual(D.checkPin(s, '9999'), true);
  assert.strictEqual(D.checkPin(s, '12345'), false);
});

test('a backed-up shop keeps its PIN (hash travels with settings)', () => {
  let s = D.createShop({ name: 'Test' });
  s = D.setPin(s, '4321');
  const restored = D.restoreState(JSON.parse(JSON.stringify(s)));
  assert.strictEqual(D.hasPin(restored), true);
  assert.strictEqual(D.checkPin(restored, '4321'), true);
  assert.strictEqual(D.checkPin(restored, '1234'), false);
  // and exports never show the digits
  assert.ok(!JSON.stringify(restored.settings).includes('4321'));
});