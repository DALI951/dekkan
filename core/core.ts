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
      allowRefund: opts.allowRefund !== undefined ? !!opts.allowRefund : true,
      // Document-number prefixes (DOC-001/002, CFG-006): per document kind,
      // configurable — the DEFAULTS live here in config.
      docPrefix: { sale: 'F', refund: 'R', buy: 'A' },
      // Tax profiles (workbook CFG-005 / TAX-001..003): optional, configurable,
      // with effective dates + ONE rounding policy. The default below is the
      // Tunisian standard — it lives HERE in config, never in posting code.
      tax: opts.tax || defaultTaxConfig()
    },
    // GLOBAL per-kind document counters (never reset at midnight — only the
    // client # resets daily). Single writer per account => unique by construction.
    seq: { sale: 0, refund: 0, buy: 0 },
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
    bill: null,
    doc: null // DOC-001: set below for sale/refund/buy entries
  };
  if (extra) for (const k in extra) entry[k] = extra[k];
  // DOC number (DOC-001): factures/refunds/buys carry a per-kind GLOBAL
  // sequence + configurable prefix. Allocated HERE — the one chokepoint every
  // entry flows through — so no poster can forget or duplicate it.
  if (kind === 'sale' || kind === 'refund' || kind === 'buy') {
    state.seq = state.seq || { sale: 0, refund: 0, buy: 0 };
    const prefix = (state.settings && state.settings.docPrefix && state.settings.docPrefix[kind]) ||
      (kind === 'sale' ? 'F' : kind === 'refund' ? 'R' : 'A');
    state.seq[kind] = Number(state.seq[kind] || 0) + 1;
    entry.doc = { kind: kind, no: fmtDoc(prefix, state.seq[kind]) };
  }
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
  ensureTaxState(s);
  ensureDocState(s);
  ensureMovements(s);
  return s;
}


// ---------- TAX PROFILES (CFG-005, TAX-001..003) ----------
// Rates are config (never hard-coded in posting code), each with effective
// dates; posted lines keep a snapshot so a later rate change never rewrites
// history. `rounding` is the ONE rounding policy for the whole shop.
function defaultTaxConfig() {
  return {
    rounding: 'half-up',
    profiles: [
      { code: 'TVA', name: 'TVA 19%', rate: 0.19, from: '2000-01-01', to: null }
    ]
  };
}


// the profile in force for a given day (latest effective date wins)
function taxProfileFor(state, date) {
  const profiles = (state.settings && state.settings.tax && state.settings.tax.profiles) || [];
  if (!profiles.length) return null;
  const d = String(date || todayStr());
  let best = null;
  for (const p of profiles) {
    if (p.from && String(p.from) > d) continue;
    if (p.to && String(p.to) < d) continue;
    if (!best || String(p.from || '') > String(best.from || '')) best = p;
  }
  if (best) return best;
  // nothing is active on that date (all future-dated): the earliest configured one
  let fallback = profiles[0];
  for (const p of profiles) {
    if (String(p.from || '') < String(fallback.from || '')) fallback = p;
  }
  return fallback;
}


// the compact snapshot posted with every bill (code + rate, nothing else)
function currentTax(state) {
  const p = taxProfileFor(state, todayStr());
  return p ? { code: p.code, rate: p.rate } : null;
}


// repairs old saves that predate the tax config
function ensureTaxState(state) {
  if (!state.settings || typeof state.settings !== 'object') state.settings = {};
  if (!state.settings.tax || !Array.isArray(state.settings.tax.profiles) || state.settings.tax.profiles.length === 0) {
    state.settings.tax = defaultTaxConfig();
  }
  if (typeof state.settings.tax.rounding !== 'string') state.settings.tax.rounding = 'half-up';
  return state;
}


// ---------- DOCUMENT NUMBERING (DOC-001/002, CFG-006) ----------
// Per-kind GLOBAL sequences with prefix, e.g. "F-0001". The sequence never
// resets at midnight — only the DAILY client # does (nextClientNo). One
// store, one writer => sequential allocation is unique by construction.
function fmtDoc(prefix, n) {
  return String(prefix || '').toUpperCase() + '-' + String(n).padStart(4, '0');
}


// repairs old saves that predate the doc-numbering state
function ensureDocState(state) {
  state.seq = state.seq || { sale: 0, refund: 0, buy: 0 };
  if (!state.settings || typeof state.settings !== 'object') state.settings = {};
  state.settings.docPrefix = Object.assign({ sale: 'F', refund: 'R', buy: 'A' }, state.settings.docPrefix || {});
  for (const k of ['sale', 'refund', 'buy']) {
    if (typeof state.seq[k] !== 'number' || !Number.isFinite(state.seq[k])) state.seq[k] = 0;
  }
  return state;
}


// ---------- STATE INTEGRITY (SAL-004, TEN-002, NFR-002) ----------
// The minimum-viable server-side trust boundary: a pushed blob is validated
// BEFORE it is stored (stock counters ⇔ movements, bills ⇔ entries, debts
// well-formed, pin shape intact, version current). Used by the client as the
// last gate before upload AND by the own-server API (api/state.php) which
// rejects a dirty blob with 409 — nothing is ever written verbatim anymore.
function stateProblems(state) {
  if (!state || typeof state !== 'object') return ['state is not an object'];
  const out = [];
  if (state.version !== 4) out.push('state.version must be 4 (found ' + String(state.version) + ')');
  if (!state.shop || typeof state.shop !== 'object' || typeof state.shop.name !== 'string') out.push('shop.name missing');
  if (!state.settings || typeof state.settings !== 'object') out.push('settings missing');
  if (!Array.isArray(state.products)) out.push('products must be an array');
  if (!Array.isArray(state.movements)) out.push('movements must be an array');
  if (!Array.isArray(state.employees)) out.push('employees must be an array');
  if (!Array.isArray(state.debts)) out.push('debts must be an array');
  if (!state.day || typeof state.day !== 'object' || !Array.isArray(state.day.entries)) out.push('day.entries missing');

  const pinHash = state.settings && state.settings.pinHash;
  if (pinHash != null && typeof pinHash !== 'string') out.push('pinHash must be a string, not ' + typeof pinHash);

  // entries: known kinds, finite amounts, unique ids, bills reconcile
  const KINDS = { sale: 1, refund: 1, expense: 1, income: 1, check: 1, buy: 1, 'debt-pay': 1 };
  const seen = {};
  const entries = (state.day && Array.isArray(state.day.entries)) ? state.day.entries : [];
  for (const e of entries) {
    if (!e || typeof e !== 'object') { out.push('day has a non-object entry'); continue; }
    if (seen[e.id]) out.push('duplicate entry id: ' + e.id); else seen[e.id] = 1;
    if (!KINDS[e.kind]) out.push('unknown entry kind: ' + String(e.kind));
    if (typeof e.amount !== 'number' || !Number.isFinite(e.amount)) out.push('entry amount not finite: ' + String(e.id));
    if (e.bill && typeof e.bill === 'object') {
      if (typeof e.bill.net !== 'number' || !Number.isFinite(e.bill.net) || e.bill.net < 0) out.push('bill.net invalid: ' + String(e.id));
      if (e.kind === 'sale' && Math.abs(e.bill.net - Math.abs(e.amount)) > 0.001) out.push('sale amount != bill.net: ' + String(e.id));
      if (Array.isArray(e.bill.lines)) {
        for (const ln of e.bill.lines) if (!Number.isFinite(ln.total)) out.push('bill line total not finite: ' + String(e.id));
      }
    }
  }

  // debts: a debt can only grow by sales and shrink by payments
  for (const d of state.debts) {
    if (!d || typeof d !== 'object') { out.push('debts holds a non-object'); continue; }
    if (typeof d.total !== 'number' || !Number.isFinite(d.total) || d.total < 0) out.push('debt total invalid: ' + String(d && d.name));
    if (typeof d.paid !== 'number' || !Number.isFinite(d.paid) || d.paid < 0) out.push('debt paid invalid: ' + String(d && d.name));
    if (d.paid > d.total + 0.001) out.push('debt paid exceeds total: ' + String(d && d.name));
  }

  // products: stock counters must reconcile with the movement ledger
  const byId = {};
  for (const m of state.movements) {
    if (!m || typeof m.productId !== 'string' || typeof m.qty !== 'number' || !Number.isFinite(m.qty)) {
      out.push('malformed movement');
      continue;
    }
    byId[m.productId] = (byId[m.productId] || 0) + m.qty;
  }
  for (const p of state.products) {
    if (typeof p.stock !== 'number' || !Number.isFinite(p.stock)) { out.push('product stock invalid: ' + String(p && p.name)); continue; }
    if (p.stock < 0) out.push('negative stock: ' + String(p.name));
    if (p.stock !== (byId[p.id] || 0)) out.push('stock counter != movement ledger: ' + String(p.name) + ' (' + p.stock + ' vs ' + (byId[p.id] || 0) + ')');
  }
  return out;
}


// ---------- RBAC LIGHT (SEC-001) ----------
// Owner vs Cashier, enforced SERVER-side (the PIN stays the in-app action
// gate). The rule lives HERE so both the PHP API and the client can share it:
// a cashier may run the till day-to-day but can never touch the lock —
// settings.pinHash / settings.pinSalt (change, wipe, or add are all denied).
const OWNER_ONLY_FIELDS = { pinHash: 1, pinSalt: 1 };

function canApply(role, oldState, newState) {
  if (!role || role === 'owner') return { ok: true };
  if (role !== 'cashier') return { ok: false, reason: 'unknown role ' + String(role) };
  if (!oldState || !newState) return { ok: false, reason: 'missing state' };
  if (!oldState.settings || !newState.settings) return { ok: false, reason: 'cashier may not wipe settings' };
  for (const f in OWNER_ONLY_FIELDS) {
    if (oldState.settings[f] !== newState.settings[f]) {
      return { ok: false, reason: 'owner-only field changed: ' + f };
    }
  }
  return { ok: true };
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
  K.defaultTaxConfig = defaultTaxConfig;
  K.taxProfileFor = taxProfileFor;
  K.currentTax = currentTax;
  K.ensureTaxState = ensureTaxState;
  K.fmtDoc = fmtDoc;
  K.ensureDocState = ensureDocState;
  K.stateProblems = stateProblems;
  K.canApply = canApply;
});
