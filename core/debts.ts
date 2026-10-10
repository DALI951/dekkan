/* DEKKAN CORE — debts (deps: uid, money, cash, pushEntry, rollover, clone, idTrusted).
   Split mechanically from core/dekkan-core.js — bodies untouched. */
'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  if (typeof window !== 'undefined' && root.DEK && root.DEK.core) factory(root.DEK.core);
})(typeof self !== 'undefined' ? self : this, function (K) {
  const { uid, money, cash, pushEntry, rollover, clone, idTrusted } = K;


// ---------- customers (the registry behind the counter's memory) ----------

// Remember a customer name so the counter can suggest it later.
// A name is optional for a sale (walk-in customer) — we only EVER record
// names that were actually typed. The registry is kept MOST-RECENT-FIRST:
// a returning customer jumps back to the top of the suggestions.
function ensureCustomer(state, name, phone) {
  state = rollover(clone(state));
  const trimmed = String(name || '').trim();
  if (!trimmed) return state;
  const low = trimmed.toLowerCase();
  const hitIdx = state.customers.findIndex(function (c) { return c.name.toLowerCase() === low; });
  if (hitIdx >= 0) {
    const hit = state.customers[hitIdx];
    state.customers.splice(hitIdx, 1);
    if (phone && !hit.phone) hit.phone = String(phone);
    hit.lastSeenAt = new Date().toISOString();
    state.customers.unshift(hit);
  } else {
    state.customers.unshift({
      id: uid(),
      name: trimmed,
      phone: phone || null,
      createdAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString()
    });
  }
  return state;
}


// Every customer we've ever served, most recent first (for the datalist).
function customerNames(state) {
  return state.customers.map(function (c) { return c.name; });
}


// ---------- debts (the notebook, digitized) ----------

function getDebt(state, id) {
  const real = idTrusted(state, id);
  return state.debts.find(function (x) { return x.id === real; });
}


function getDebtByName(state, name) {
  const n = String(name).toLowerCase();
  return state.debts.find(function (x) { return x.name.toLowerCase() === n && !x.settled; });
}


function addDebt(state, opts) {
  state = rollover(clone(state));
  if (!opts || !opts.name || !opts.name.trim()) throw new Error('debt needs a customer name');
  const amount = money(opts.amount || 0);
  if (amount <= 0) throw new Error('debt amount must be positive');
  const d = getDebt(state, opts.debtId) || getDebtByName(state, opts.name);
  if (d) {
    d.total = money(d.total + amount);
    d.payments.push({ amount: amount, at: new Date().toISOString(), kind: 'debt', note: opts.note || null });
  } else {
    state.debts.push({
      id: uid(),
      name: opts.name.trim(),
      phone: opts.phone || null,
      total: amount,
      paid: 0,
      payments: [{ amount: amount, at: new Date().toISOString(), kind: 'debt', note: opts.note || null }],
      createdAt: new Date().toISOString(),
      settled: false
    });
  }
  return ensureCustomer(state, opts.name, opts.phone);
}


// Customer pays what they owe: cash IN, debt down. Handles partial payments.
function payDebt(state, debtId, opts) {
  state = rollover(clone(state));
  const d = getDebt(state, debtId);
  if (!d) throw new Error('debt not found');
  const remaining = money(d.total - d.paid);
  if (remaining <= 0) throw new Error('this debt is already settled');
  let amount = money((opts && opts.amount) || 0);
  if (amount <= 0) throw new Error('payment must be positive');
  const pay = Math.min(amount, remaining); // can't overpay -> the excess stays in the customer's pocket
  d.paid = money(d.paid + pay);
  d.payments.push({ amount: -pay, at: new Date().toISOString(), kind: 'pay', note: (opts && opts.note) || null });
  if (d.paid >= d.total) d.settled = true;
  pushEntry(state, 'debt-pay', pay, d.name, 'debt payment');
  return state;
}


function debtsOwed(state) {
  let total = 0;
  for (const d of state.debts) if (!d.settled) total += d.total - d.paid;
  return money(total);
}


// Remove a settled debt from the notebook (records-keeping: you can't delete what's owed).
function removeDebt(state, debtId) {
  state = rollover(clone(state));
  const d = getDebt(state, debtId);
  if (!d) throw new Error('debt not found');
  if (d.total - d.paid > 0) throw new Error('debt still has an open balance (use payDebt)');
  state.debts = state.debts.filter(function (x) { return x.id !== d.id; });
  return state;
}

  K.ensureCustomer = ensureCustomer;
  K.customerNames = customerNames;
  K.getDebt = getDebt;
  K.getDebtByName = getDebtByName;
  K.addDebt = addDebt;
  K.payDebt = payDebt;
  K.debtsOwed = debtsOwed;
  K.removeDebt = removeDebt;
});
