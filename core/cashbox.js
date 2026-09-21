/* DEKKAN CORE — cashbox (deps: uid, money, cash, pushEntry, rollover, clone).
   Split mechanically from core/dekkan-core.js — bodies untouched. */
'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  if (typeof window !== 'undefined' && root.DEK && root.DEK.core) factory(root.DEK.core);
})(typeof self !== 'undefined' ? self : this, function (K) {
  const { uid, money, cash, pushEntry, rollover, clone } = K;


// Shop expenses (rent, electricity, coffee for the owner...). Cash out.
//   note = WHY (the purpose); category = a reusable purpose-category name.
function expense(state, opts) {
  state = rollover(clone(state));
  if (!opts || !Number.isFinite(opts.amount) || opts.amount <= 0) throw new Error('expense amount must be positive');
  // you cannot take money out that the till does not physically hold
  const now = cash(state);
  if (money(opts.amount) > now) throw new Error('not enough cash in the till (' + money(now) + ')');
  pushEntry(state, 'expense', -money(opts.amount), null, opts.note || null, { cat: opts.category || null });
  return state;
}


// Money you put INTO the cash box from outside (your pocket, a loan). Cash in.
//   note = WHERE it came from (the source); category = a reusable source-category name.
function income(state, opts) {
  state = rollover(clone(state));
  if (!opts || !Number.isFinite(opts.amount) || opts.amount <= 0) throw new Error('income amount must be positive');
  pushEntry(state, 'income', money(opts.amount), null, opts.note || null, { cat: opts.category || null });
  return state;
}


// ---------- cash-box categories (reusable sources / purposes) ----------

function addCategory(state, opts) {
  state = rollover(clone(state));
  if (!opts || opts.side !== 'in' && opts.side !== 'out') throw new Error('category side must be "in" or "out"');
  const name = String(opts.name || '').trim();
  if (!name) throw new Error('category name is required');
  const pool = state.categories[opts.side];
  if (pool.some(function (c) { return c.name.toLowerCase() === name.toLowerCase(); })) {
    throw new Error('category already exists');
  }
  pool.push({ id: uid(), name: name });
  return state;
}


function removeCategory(state, opts) {
  state = rollover(clone(state));
  if (!opts || opts.side !== 'in' && opts.side !== 'out') throw new Error('category side must be "in" or "out"');
  const pool = state.categories[opts.side];
  const idx = pool.findIndex(function (c) { return c.id === opts.id; });
  if (idx === -1) throw new Error('category not found');
  pool.splice(idx, 1);
  return state;
}


// ---------- CASH CHECK: shopkeeper counts the drawer, we compare ----------

// counted = the real money physically in the drawer right now.
// The check is recorded (amount 0, so the cash identity is untouched),
// and the day report shows expected vs counted vs the difference.
function checkCash(state, opts) {
  state = rollover(clone(state));
  const counted = money(opts && opts.counted);
  if (!Number.isFinite(counted)) throw new Error('counted must be a number');
  const expected = cash(state);
  const diff = money(counted - expected);
  state.day.checks.push({ at: new Date().toISOString(), counted: counted, expected: expected, diff: diff, ok: diff === 0 });
  pushEntry(state, 'check', 0, null, 'counted ' + counted + ', diff ' + (diff >= 0 ? '+' : '') + diff);
  return state;
}

  K.expense = expense;
  K.income = income;
  K.addCategory = addCategory;
  K.removeCategory = removeCategory;
  K.checkCash = checkCash;
});
