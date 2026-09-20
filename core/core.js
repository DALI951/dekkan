/* DEKKAN CORE — core (deps: sellAll).
   Split mechanically from core/dekkan-core.js — bodies untouched. */
'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  if (typeof window !== 'undefined' && root.DEK && root.DEK.core) factory(root.DEK.core);
})(typeof self !== 'undefined' ? self : this, function (K) {
  const { sellAll } = K;


// ---------- tiny helpers ----------

function uid() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}


// Local calendar date, YYYY-MM-DD (the day a caisse is judged on).
function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}


// Round money to 3 decimals (TND has millimes).
function money(n) {
  return Math.round(n * 1000) / 1000;
}


// ---------- state ----------

function createShop(opts) {
  opts = opts || {};
  const start = money(opts.startCash || 0);
  const now = new Date().toISOString();
  return {
    version: 3,
    shop: { name: opts.name || 'My Shop', currency: opts.currency || 'TND' },
    // Options the shopkeeper can turn on/off. The UI shows/hides them.
    settings: {
      allowDiscount: opts.allowDiscount !== undefined ? !!opts.allowDiscount : true,
      allowRefund: opts.allowRefund !== undefined ? !!opts.allowRefund : true
    },
    // every customer name ever used (sales + notebook) — the counter's memory
    customers: [],
    // cash-box categories: sources for money IN, purposes for money OUT
    categories: { in: [], out: [] },
    products: [],
    debts: [],
    days: [],
    // the OPEN day: entries (money moves) + checks (drawer counts) + soldCost (for profit)
    day: { date: todayStr(), openedAt: now, startCash: start, soldCost: 0, entries: [], checks: [] }
  };
}


// ---------- cash: the single source of truth ----------

function cash(state) {
  let total = state.day.startCash;
  for (const e of state.day.entries) total += e.amount;
  return money(total);
}


function pushEntry(state, kind, amount, ref, note, extra) {
  const entry = {
    id: uid(), kind, amount: money(amount), at: new Date().toISOString(), ref: ref || null, note: note || null,
    bill: null
  };
  if (extra) for (const k in extra) entry[k] = extra[k];
  state.day.entries.push(entry);
  return state;
}


// ---------- client numbers (the #1, #2, ... of today) ----------

// Count the numbered sales of TODAY. Each sellAll checkout = exactly ONE
// sale entry, so this count IS the day's client counter. If the open day
// is yesterday's, today simply hasn't sold anything yet.
function salesToday(state) {
  if (state.day.date !== todayStr()) return 0;
  let n = 0;
  for (const e of state.day.entries) if (e.kind === 'sale') n++;
  return n;
}


// The number the NEXT customer will get (#1 on a fresh day).
function nextClientNo(state) {
  return salesToday(state) + 1;
}


// The number of a specific sale entry (1-based within its day), or null.
function clientNoOf(state, entryId) {
  let n = 0;
  for (const e of state.day.entries) {
    if (e.kind !== 'sale') continue;
    n++;
    if (e.id === entryId) return n;
  }
  return null;
}


// ---------- day rollover ----------

// If the open day is not today, close it and open a fresh one.
// Closing cash of yesterday = starting cash of today. THE day boundary.
function closeOpenDay(state, closedAt) {
  const end = cash(state);
  state.days.push({
    date: state.day.date,
    openedAt: state.day.openedAt,
    closedAt: closedAt,
    startCash: state.day.startCash,
    endCash: end,
    soldCost: state.day.soldCost,
    entries: state.day.entries,
    checks: state.day.checks
  });
  state.day = { date: todayStr(), openedAt: closedAt, startCash: end, soldCost: 0, entries: [], checks: [] };
  return state;
}


function rollover(state) {
  if (state.day.date === todayStr()) return state;
  return closeOpenDay(state, new Date().toISOString());
}


// Force-close today even if it IS today (shop ends the day early -> new open day).
function closeDay(state) {
  state = clone(state);
  if (state.day.entries.length === 0 && state.day.soldCost === 0) return state; // nothing happened today, no empty day
  return closeOpenDay(state, new Date().toISOString());
}


// ---------- deep helpers ----------

function clone(state) {
  return JSON.parse(JSON.stringify(state));
}


// accept either the id string itself or { id } — small convenience
function idTrusted(state, id) {
  if (id && typeof id === 'object' && id.id) return id.id;
  return id;
}

  K.uid = uid;
  K.todayStr = todayStr;
  K.money = money;
  K.createShop = createShop;
  K.cash = cash;
  K.pushEntry = pushEntry;
  K.salesToday = salesToday;
  K.nextClientNo = nextClientNo;
  K.clientNoOf = clientNoOf;
  K.closeOpenDay = closeOpenDay;
  K.rollover = rollover;
  K.closeDay = closeDay;
  K.clone = clone;
  K.idTrusted = idTrusted;
});
