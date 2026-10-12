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

/* Tax profiles (workbook CFG-005 / TAX-001..003): optional, configurable,
   with effective dates + ONE rounding policy. The default below is the
   Tunisian standard — it lives HERE in config, never in posting code.

   The shop's OWN look, wording and formats (docs/customize-plan.md). DATA,
   never a code branch: waves 2–6 (theme editor, brand + documents, lists,
   tabs/density, French) only READ this. See defaultCustom/customProblems.

   GLOBAL per-kind document counters (never reset at midnight — only the
   client # resets daily). Single writer per account => unique by construction.

   the STOCK LEDGER (see stockMove): every shelf change, append-only + source-linked */
function createShop(opts) {
  opts = opts || {};
  const start = money(opts.startCash || 0);
  const now = new Date().toISOString();
  return {
    version: 4,
    shop: { name: opts.name || 'My Shop', currency: opts.currency || 'TND' },
    settings: {
      allowDiscount: opts.allowDiscount !== undefined ? !!opts.allowDiscount : true,
      allowRefund: opts.allowRefund !== undefined ? !!opts.allowRefund : true,
      docPrefix: { sale: 'F', refund: 'R', buy: 'A' },
      tax: opts.tax || defaultTaxConfig()
    },
    custom: opts.custom || defaultCustom(),
    seq: { sale: 0, refund: 0, buy: 0 },
    customers: [],
    cashiers: [],
    categories: { in: [], out: [] },
    products: [],
    debts: [],
    movements: [],
    employees: [],
    days: [],
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
    doc: null
  };
  if (extra) for (const k in extra) entry[k] = extra[k];
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
/* A backup from before the customization block (or from a build that never had
   it) must still come back as a WORKING shop: repair, don't reject.

   DATA-001 ("upload success != recoverability"): a file that PARSES is not
   proof of a shop that can come back. Run the SAME integrity gate the server
   runs on push (stateProblems) BEFORE this state can replace the live shop —
   a structurally-broken backup is refused, never allowed to become the only
   copy. stateProblems is hoisted, so calling it here is safe. */
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
  ensureCustomState(s);
  const problems = stateProblems(s);
  if (problems.length) throw new Error('backup fails integrity: ' + problems[0]);
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


// ---------- CUSTOMIZATION (state.custom) — wave 1 of docs/customize-plan.md ----------
// Every configurable value of the shop is DATA here (brand, money format, dates,
// print, receipt wording, tab order, document language) — never a branch in the
// UI. Why a shape-first wave: waves 2–6 all READ this block, so freezing the shape
// (with its defaults, repair and validation) first is what keeps them from being
// rewrites. Nothing reads it visually yet — that is on purpose.
//
// Two paths, deliberately different:
//   * ensureCustomState() = REPAIR (boot / import / old save). Never throws; fixes
//     what it can read, keeps every valid choice, fills the rest from the defaults.
//   * setCustom() (in shop.ts) = STRICT WRITE. A typo, an unknown option or an
//     out-of-range value throws and changes NOTHING.
const CUSTOM_TABS = ['sell', 'stock', 'debts', 'clients', 'report', 'employees', 'monthly', 'cashbox', 'settings'];
const CUSTOM_BRAND_KEYS = ['tagline', 'address', 'phone', 'taxId', 'logoUrl'];
const CUSTOM_THOUSANDS = ['', ' ', ',', '.'];
const CUSTOM_DECIMALS_MAX = 3;   // millimes: TND has 3, most currencies 2, some 0
// The date formats a shop can put on its paper. ui/fmt.ts keeps the same list (it
// has no imports); test/money-format.test.ts asserts the two never drift apart.
const CUSTOM_DATE_FORMATS = ['YYYY-MM-DD', 'YYYY/MM/DD', 'DD/MM/YYYY', 'MM/DD/YYYY', 'DD-MM-YYYY', 'DD.MM.YYYY'];

function defaultCustom() {
  return {
    brand: { tagline: '', address: '', phone: '', taxId: '', logoUrl: '' },
    money: { code: 'TND', symbol: '', position: 'after', decimals: 3, thousands: '', digits: 'latin' },
    date: { format: 'YYYY-MM-DD', time: '24h', timezone: '' },
    print: { size: '80mm', copies: 1, autoPrint: false },
    receipt: { header: '', footer: '', showCashier: true, showTaxId: false, qr: false },
    tabs: { order: CUSTOM_TABS.slice(), hidden: [] },
    theme: { id: 'souk', tokens: {} },
    docLanguage: ''
  };
}


// Everything wrong with a custom block, most-wrong-first. The gate reports the
// first problem, so a state can never be half-customized on a shopkeeper's phone.
/* theme: a base theme id + the shop's own color overrides. Core validates the
   SHAPE (presentation validity — is this really a CSS color? — is the UI's job
   in ui/themes.ts, which falls back to the base color for a value it cannot
   read). What core refuses here is junk that could not be a theme at all. */
function customProblems(c) {
  const out = [];
  if (!c || typeof c !== 'object' || Array.isArray(c)) return ['custom must be an object'];
  const SECTIONS = ['brand', 'money', 'date', 'print', 'receipt', 'tabs', 'theme'];
  Object.keys(c).forEach(k => {
    if (k !== 'docLanguage' && SECTIONS.indexOf(k) === -1) out.push('unknown section "' + k + '"');
  });
  const isText = (v, max) => typeof v === 'string' && v.length <= max;

  const b = c.brand;
  if (!b || typeof b !== 'object' || Array.isArray(b)) out.push('brand must be an object');
  else CUSTOM_BRAND_KEYS.forEach(k => {
    const max = k === 'address' ? 200 : (k === 'logoUrl' ? 500 : 120);
    if (!isText(b[k], max)) out.push('brand.' + k + ' must be text (max ' + max + ')');
  });

  const m = c.money;
  if (!m || typeof m !== 'object' || Array.isArray(m)) out.push('money must be an object');
  else {
    if (!isText(m.code, 8) || !m.code.trim()) out.push('money.code must be a short text code (TND, EUR…)');
    if (!isText(m.symbol, 6)) out.push("money.symbol must be text (max 6; '' = the language's own word)");
    if (m.position !== 'before' && m.position !== 'after') out.push('money.position must be before|after');
    if (!Number.isInteger(m.decimals) || m.decimals < 0 || m.decimals > CUSTOM_DECIMALS_MAX) {
      out.push('money.decimals must be a whole number 0..' + CUSTOM_DECIMALS_MAX);
    }
    if (CUSTOM_THOUSANDS.indexOf(m.thousands) === -1) out.push("money.thousands must be one of '' | ' ' | ',' | '.'");
    if (m.digits !== 'latin' && m.digits !== 'arabic') out.push('money.digits must be latin|arabic');
  }

  const d = c.date;
  if (!d || typeof d !== 'object' || Array.isArray(d)) out.push('date must be an object');
  else {
    if (CUSTOM_DATE_FORMATS.indexOf(d.format) === -1) out.push('date.format must be one of ' + CUSTOM_DATE_FORMATS.join('|'));
    if (d.time !== '24h' && d.time !== '12h') out.push('date.time must be 24h|12h');
    if (!isText(d.timezone, 64)) out.push('date.timezone must be text (max 64)');
  }

  const p = c.print;
  if (!p || typeof p !== 'object' || Array.isArray(p)) out.push('print must be an object');
  else {
    if (['58mm', '80mm', 'A4'].indexOf(p.size) === -1) out.push('print.size must be 58mm|80mm|A4');
    if (!Number.isInteger(p.copies) || p.copies < 1 || p.copies > 5) out.push('print.copies must be a whole number 1..5');
    if (typeof p.autoPrint !== 'boolean') out.push('print.autoPrint must be true|false');
  }

  const r = c.receipt;
  if (!r || typeof r !== 'object' || Array.isArray(r)) out.push('receipt must be an object');
  else {
    ['header', 'footer'].forEach(k => { if (!isText(r[k], 300)) out.push('receipt.' + k + ' must be text (max 300)'); });
    ['showCashier', 'showTaxId', 'qr'].forEach(k => { if (typeof r[k] !== 'boolean') out.push('receipt.' + k + ' must be true|false'); });
  }

  const t = c.tabs;
  if (!t || typeof t !== 'object' || Array.isArray(t)) out.push('tabs must be an object');
  else {
    const order = t.order;
    if (!Array.isArray(order) || !order.length) {
      out.push('tabs.order must list at least one page');
    } else {
      const seen = {};
      order.forEach(id => {
        if (CUSTOM_TABS.indexOf(id) === -1) out.push('unknown page "' + id + '" in tabs.order');
        else if (seen[id]) out.push('tabs.order cannot contain "' + id + '" twice');
        seen[id] = 1;
      });
      if (!Array.isArray(t.hidden)) out.push('tabs.hidden must be an array');
      else t.hidden.forEach(id => {
        if (order.indexOf(id) === -1) out.push('tab "' + id + '" is hidden but not in the order');
      });
    }
  }

  if (typeof c.docLanguage !== 'string' || c.docLanguage.length > 8) out.push('docLanguage must be a short language id ("" = follow the app)');

  const th = c.theme;
  if (!th || typeof th !== 'object' || Array.isArray(th)) out.push('theme must be an object');
  else {
    const extraKeys = Object.keys(th).filter(k => k !== 'id' && k !== 'tokens');
    if (extraKeys.length) out.push('theme has an unknown setting: ' + extraKeys[0]);
    if (typeof th.id !== 'string' || !/^[a-z0-9-]{2,24}$/.test(th.id)) out.push('theme.id must be a short slug (a-z, 0-9, -)');
    if (!th.tokens || typeof th.tokens !== 'object' || Array.isArray(th.tokens)) out.push('theme.tokens must be an object');
    else {
      const keys = Object.keys(th.tokens);
      if (keys.length > 80) out.push('theme.tokens has too many entries (' + keys.length + ')');
      for (const k of keys) {
        if (k.indexOf('--') !== 0) { out.push('theme token "' + k + '" must start with -- (it is a CSS custom property)'); break; }
        const v = th.tokens[k];
        if (typeof v !== 'string' || !v.trim() || v.length > 64) { out.push('theme.tokens.' + k + ' must be a non-empty string (max 64)'); break; }
      }
    }
  }
  return out;
}


// Repair (never throws) — the same spirit as ensureTaxState/ensureDocState:
// an old or thin save must open as a WORKING shop, and a value the shop really
// chose must survive. Anything unreadable falls back to the default.
/* a valid order = known pages only, never twice. ONE unreadable entry means
   the order came from another build — keeping the readable leftovers would
   silently hide pages the owner never hid, so we start over from every page.

   a hidden list written against an order we could not read is not trustworthy
   either — repairing the visible pages and keeping a stale hidden list would
   hide a page the shopkeeper never chose to hide.

   theme: keep the base id + every readable override, drop the rest (a broken
   single color must not cost the shop the eleven colors it did set)

   anything the strict path would refuse goes back to its default (one pass, so
   a repaired state is a fixed point: repairing it again changes nothing) */
function ensureCustomState(state) {
  const def = defaultCustom();
  const raw = (state.custom && typeof state.custom === 'object' && !Array.isArray(state.custom)) ? state.custom : {};
  const c: any = { brand: {}, money: {}, date: {}, print: {}, receipt: {}, tabs: {}, theme: {}, docLanguage: def.docLanguage };

  CUSTOM_BRAND_KEYS.forEach(k => { c.brand[k] = (raw.brand && typeof raw.brand[k] === 'string') ? raw.brand[k] : def.brand[k]; });
  Object.keys(def.money).forEach(k => { c.money[k] = (raw.money && raw.money[k] !== undefined) ? raw.money[k] : def.money[k]; });
  Object.keys(def.date).forEach(k => { c.date[k] = (raw.date && raw.date[k] !== undefined) ? raw.date[k] : def.date[k]; });
  Object.keys(def.print).forEach(k => { c.print[k] = (raw.print && raw.print[k] !== undefined) ? raw.print[k] : def.print[k]; });
  Object.keys(def.receipt).forEach(k => { c.receipt[k] = (raw.receipt && raw.receipt[k] !== undefined) ? raw.receipt[k] : def.receipt[k]; });

  const order = (raw.tabs && Array.isArray(raw.tabs.order)) ? raw.tabs.order : null;
  c.tabs.order = def.tabs.order.slice();
  let orderReset = true;
  if (order && order.length) {
    const seen = {};
    const clean = order.filter(id => {
      if (CUSTOM_TABS.indexOf(id) === -1 || seen[id]) return false;
      seen[id] = 1;
      return true;
    });
    if (clean.length === order.length && clean.length) { c.tabs.order = clean; orderReset = false; }
  }
  const hidden = (raw.tabs && Array.isArray(raw.tabs.hidden)) ? raw.tabs.hidden : [];
  if (orderReset) hidden.length = 0;
  c.tabs.hidden = hidden.filter(id => c.tabs.order.indexOf(id) !== -1);
  if (typeof raw.docLanguage === 'string' && raw.docLanguage.length <= 8) c.docLanguage = raw.docLanguage;

  const rt = (raw.theme && typeof raw.theme === 'object' && !Array.isArray(raw.theme)) ? raw.theme : {};
  c.theme = { id: def.theme.id, tokens: {} };
  if (typeof rt.id === 'string' && /^[a-z0-9-]{2,24}$/.test(rt.id)) c.theme.id = rt.id;
  if (rt.tokens && typeof rt.tokens === 'object' && !Array.isArray(rt.tokens)) {
    Object.keys(rt.tokens).forEach(k => {
      const v = rt.tokens[k];
      if (k.indexOf('--') === 0 && typeof v === 'string' && v.trim() && v.length <= 64) c.theme.tokens[k] = v;
    });
  }

  customProblems(c).forEach(msg => {
    const key = msg.split(' ')[0];
    if (/^money\./.test(key)) c.money[key.slice(6)] = def.money[key.slice(6)];
    else if (/^date\./.test(key)) c.date[key.slice(5)] = def.date[key.slice(5)];
    else if (/^print\./.test(key)) c.print[key.slice(6)] = def.print[key.slice(6)];
    else if (/^receipt\./.test(key)) c.receipt[key.slice(8)] = def.receipt[key.slice(8)];
    else if (/^brand\./.test(key)) c.brand[key.slice(6)] = def.brand[key.slice(6)];
    else if (/^tabs\.order/.test(msg)) c.tabs.order = def.tabs.order.slice();
    else if (/^tabs\.hidden/.test(msg)) c.tabs.hidden = [];
    else if (/^theme/.test(msg)) c.theme = { id: def.theme.id, tokens: {} };
    else if (/^docLanguage/.test(msg)) c.docLanguage = def.docLanguage;
  });
  state.custom = c;
  return state;
}


// ---------- STATE INTEGRITY (SAL-004, TEN-002, NFR-002) ----------
// The minimum-viable server-side trust boundary: a pushed blob is validated
// BEFORE it is stored (stock counters ⇔ movements, bills ⇔ entries, debts
// well-formed, pin shape intact, version current). Used by the client as the
// last gate before upload AND by the own-server API (api/state.php) which
// rejects a dirty blob with 409 — nothing is ever written verbatim anymore.
/* the customization block must be sane before this state can replace the live
   shop: a half-readable format would print money the shopkeeper never chose.

   debts: a debt can only grow by sales and shrink by payments

   products: stock counters must reconcile with the movement ledger */
function stateProblems(state) {
  if (!state || typeof state !== 'object') return ['state is not an object'];
  const out = [];
  if (state.version !== 4) out.push('state.version must be 4 (found ' + String(state.version) + ')');
  if (!state.shop || typeof state.shop !== 'object' || typeof state.shop.name !== 'string') out.push('shop.name missing');
  if (!state.settings || typeof state.settings !== 'object') out.push('settings missing');
  customProblems(state.custom).forEach(msg => out.push('custom: ' + msg));
  if (!Array.isArray(state.products)) out.push('products must be an array');
  if (!Array.isArray(state.movements)) out.push('movements must be an array');
  if (!Array.isArray(state.employees)) out.push('employees must be an array');
  if (!Array.isArray(state.debts)) out.push('debts must be an array');
  if (!state.day || typeof state.day !== 'object' || !Array.isArray(state.day.entries)) out.push('day.entries missing');

  const pinHash = state.settings && state.settings.pinHash;
  if (pinHash != null && typeof pinHash !== 'string') out.push('pinHash must be a string, not ' + typeof pinHash);

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

  for (const d of state.debts) {
    if (!d || typeof d !== 'object') { out.push('debts holds a non-object'); continue; }
    if (typeof d.total !== 'number' || !Number.isFinite(d.total) || d.total < 0) out.push('debt total invalid: ' + String(d && d.name));
    if (typeof d.paid !== 'number' || !Number.isFinite(d.paid) || d.paid < 0) out.push('debt paid invalid: ' + String(d && d.name));
    if (d.paid > d.total + 0.001) out.push('debt paid exceeds total: ' + String(d && d.name));
  }

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
//
// A manual edit (kind 'adjust') must say WHY: the reason is a CODE from a closed
// vocabulary (the workbook's M04 "adjustments + reasons"), carried on the movement
// itself — the product record stays a catalogue, the ledger stays the audit trail.

const STOCK_REASONS = ['count', 'damage', 'loss', 'other'];

function isStockReason(code) {
  return typeof code === 'string' && STOCK_REASONS.indexOf(code) !== -1;
}


function assertStockReason(code) {
  if (!isStockReason(code)) throw new Error('toast.stockReason');
  return code;
}


function stockMove(state, productId, qty, kind, ref, note, reason) {
  const q = Math.floor(qty);
  if (!Number.isFinite(q) || q === 0) throw new Error('stock move must be a non-zero whole number');
  state.movements = state.movements || [];
  state.movements.push({
    id: uid(), at: new Date().toISOString(), productId: productId,
    qty: q, kind: kind || 'adjust', ref: ref != null ? ref : null,
    note: note != null ? note : null, reason: isStockReason(reason) ? reason : null
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
        qty: Math.floor(p.stock), kind: 'opening', ref: null, note: null, reason: null
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
  K.STOCK_REASONS = STOCK_REASONS;
  K.isStockReason = isStockReason;
  K.assertStockReason = assertStockReason;
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
  K.CUSTOM_TABS = CUSTOM_TABS;
  K.CUSTOM_DATE_FORMATS = CUSTOM_DATE_FORMATS;
  K.defaultCustom = defaultCustom;
  K.customProblems = customProblems;
  K.ensureCustomState = ensureCustomState;
  K.canApply = canApply;
});
