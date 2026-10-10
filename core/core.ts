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
    version: 4,
    shop: { name: opts.name || 'My Shop', currency: opts.currency || 'TND' },
    // Options the shopkeeper can turn on/off. The UI shows/hides them.
    settings: {
      allowDiscount: opts.allowDiscount !== undefined ? !!opts.allowDiscount : true,
      allowRefund: opts.allowRefund !== undefined ? !!opts.allowRefund : true
    },
    // every customer name ever used (sales + notebook) — the counter's memory
    customers: [],
    // every cashier name ever used, most recent first (who rang each sale)
    cashiers: [],
    // cash-box categories: sources for money IN, purposes for money OUT
    categories: { in: [], out: [] },
    products: [],
    debts: [],
    // the STOCK LEDGER (see stockMove): every shelf change, append-only + source-linked
    movements: [],
    employees: [],
    days: [],
    // the OPEN day: entries (money moves) + checks (drawer counts) + soldCost (for profit)
    // + soldByProduct/soldFree (the per-day refund budgets, by product id / free-item name)
    day: { date: todayStr(), openedAt: now, startCash: start, soldCost: 0, entries: [], checks: [], soldByProduct: {}, soldFree: {} }
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
  state.day = { date: todayStr(), openedAt: closedAt, startCash: end, soldCost: 0, entries: [], checks: [], soldByProduct: {}, soldFree: {} };
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


// ---------- backup import ----------

// Validate a parsed backup and hand back a safe, usable state.
// The SAME migration pass that app.js.load() runs on boot, so a backup from
// an older version still lands as a working state. Throws on anything that
// is not a shop backup — the UI must NOT touch the live state in that case.
function restoreState(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('not a shop backup');
  const s = clone(raw);
  if (!Array.isArray(s.products)) throw new Error('products missing');
  if (!Array.isArray(s.debts)) throw new Error('debts missing');
  if (!Array.isArray(s.days)) throw new Error('days missing');
  if (!s.day || !Array.isArray(s.day.entries)) throw new Error('open day missing');
  if (!Array.isArray(s.customers)) s.customers = [];
  if (!Array.isArray(s.cashiers)) s.cashiers = [];
  if (!s.categories || !Array.isArray(s.categories.in) || !Array.isArray(s.categories.out)) {
    s.categories = { in: [], out: [] };
  }
  if (!Array.isArray(s.employees)) s.employees = [];
  ensureMovements(s);
  return s;
}


// accept either the id string itself or { id } — small convenience
function idTrusted(state, id) {
  if (id && typeof id === 'object' && id.id) return id.id;
  return id;
}


// ---------- the STOCK LEDGER (append-only, source-linked) ----------
// The workbook rule: on-hand comes from source-linked movements; users never
// type over stock. Every change to a product's count is ONE immutable movement:
//   kind: 'opening' | 'buy' | 'sale' | 'refund' | 'adjust' | 'undo'
//   qty : signed whole units (+ into the shelf, - out of it)
//   ref : the thing that caused it (a sale/refund/buy entry id), when there is one
// product.stock stays the fast counter; the movements are the audit trail.
// stockIntegrity() proves they agree; reconcileStock() rebuilds the counter.

function stockMove(state, productId, qty, kind, ref, note) {
  const q = Math.floor(qty);
  if (!Number.isFinite(q) || q === 0) throw new Error('stock move must be a non-zero whole number');
  state.movements = state.movements || [];
  state.movements.push({
    id: uid(), at: new Date().toISOString(), productId: productId,
    qty: q, kind: kind || 'adjust', ref: ref != null ? ref : null, note: note != null ? note : null
  });
  return state;
}


function stockMovementsFor(state, productId) {
  return (state.movements || []).filter(function (m) { return m.productId === productId; });
}


// on-hand recomputed purely from the movements (0 when none were recorded)
function stockFromMovements(state, productId) {
  let n = 0;
  for (const m of (state.movements || [])) if (m.productId === productId) n += m.qty;
  return n;
}


// the audit: every product whose counter disagrees with its ledger ([] = healthy)
function stockIntegrity(state) {
  const bad = [];
  for (const p of (state.products || [])) {
    const fromMoves = stockFromMovements(state, p.id);
    if (fromMoves !== p.stock) bad.push({ id: p.id, name: p.name, stock: p.stock, fromMovements: fromMoves });
  }
  return bad;
}


// rebuild the counter from the ledger (products that have movements only)
function reconcileStock(state) {
  state = clone(state);
  for (const p of state.products) {
    const has = (state.movements || []).some(function (m) { return m.productId === p.id; });
    if (has) p.stock = stockFromMovements(state, p.id);
  }
  return state;
}


// Give any product that has NO ledger a single 'opening' movement equal to its
// saved count, so an old save (or a hand-imported backup) becomes a valid ledger.
// Safe to call on every load: products that already have movements are untouched.
function ensureMovements(state) {
  if (!Array.isArray(state.movements)) state.movements = [];
  for (const p of (state.products || [])) {
    if (!p || p.id == null) continue;
    const has = state.movements.some(function (m) { return m.productId === p.id; });
    if (!has && Number.isFinite(p.stock) && Math.floor(p.stock) !== 0) {
      state.movements.push({
        id: uid(), at: new Date().toISOString(), productId: p.id,
        qty: Math.floor(p.stock), kind: 'opening', ref: null, note: null
      });
    }
  }
  return state;
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
  K.restoreState = restoreState;
  K.idTrusted = idTrusted;
  K.stockMove = stockMove;
  K.stockMovementsFor = stockMovementsFor;
  K.stockFromMovements = stockFromMovements;
  K.stockIntegrity = stockIntegrity;
  K.reconcileStock = reconcileStock;
  K.ensureMovements = ensureMovements;
});
