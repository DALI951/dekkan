/* DEKKAN CORE — shop (deps: money, cash, clone).
   Split mechanically from core/dekkan-core.js — bodies untouched. */
'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  if (typeof window !== 'undefined' && root.DEK && root.DEK.core) factory(root.DEK.core);
})(typeof self !== 'undefined' ? self : this, function (K) {
  const { money, cash, clone } = K;


// ---------- shop identity & options (the small-print settings) ----------

// Rename the shop / set the day's starting cash.
//   startCash can ONLY change while the day is empty (no entries yet) —
//   otherwise the cash identity (startCash + sum of moves) would be corrupted retroactively.
function updateShop(state, opts) {
  state = clone(state);
  if (!opts) return state;
  if (opts.name != null) {
    if (typeof opts.name !== 'string' || !opts.name.trim()) throw new Error('shop name invalid');
    state.shop.name = opts.name.trim();
  }
  if (opts.startCash != null) {
    if (!Number.isFinite(opts.startCash) || opts.startCash < 0) throw new Error('start cash invalid');
    if (state.day.entries.length > 0 || state.day.soldCost > 0) {
      throw new Error('day already has movement — start cash is locked for today');
    }
    state.day.startCash = money(opts.startCash);
  }
  return state;
}


// Turn shop options on/off (allowDiscount, allowRefund). UI shows/hides them.
function setSettings(state, patch) {
  state = clone(state);
  if (!patch) return state;
  if ('allowDiscount' in patch) {
    if (typeof patch.allowDiscount !== 'boolean') throw new Error('allowDiscount must be boolean');
    state.settings.allowDiscount = patch.allowDiscount;
  }
  if ('allowRefund' in patch) {
    if (typeof patch.allowRefund !== 'boolean') throw new Error('allowRefund must be boolean');
    state.settings.allowRefund = patch.allowRefund;
  }
  return state;
}

// ---------- customization writes (STRICT — the other half of state.custom) ----------
// ensureCustomState() REPAIRS a save it inherits (boot/import); this one is the
// only way a real choice gets in, and it refuses anything it cannot prove:
// a typo, an unknown section, an unknown option inside a known section, or a
// value out of range throws — and the caller's state is never touched.
// "One writer, one gate": wave 2+ screens call setCustom(patch) instead of
// poking state.custom, so no screen can invent a value the core would reject.
// the shape of a writable custom patch: section -> the options it accepts.
// Kept next to the writer it guards (core.ts owns the defaults + validation).
const CUSTOM_SECTIONS = {
  brand: ['tagline', 'address', 'phone', 'taxId', 'logoUrl'],
  money: ['code', 'symbol', 'position', 'decimals', 'thousands', 'digits'],
  date: ['format', 'time', 'timezone'],
  print: ['size', 'copies', 'autoPrint'],
  receipt: ['header', 'footer', 'showCashier', 'showTaxId', 'qr'],
  tabs: ['order', 'hidden'],
  theme: ['id', 'tokens']
};

function setCustom(state, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('custom: a patch must be an object');

  const unknown = Object.keys(patch).filter(k => k !== 'docLanguage' && !CUSTOM_SECTIONS[k]);
  if (unknown.length) throw new Error('custom: unknown section "' + unknown[0] + '"');
  Object.keys(patch).forEach(section => {
    if (section === 'docLanguage') return;
    const sub = patch[section];
    if (!sub || typeof sub !== 'object' || Array.isArray(sub)) throw new Error('custom: ' + section + ' must be an object');
    const bad = Object.keys(sub).filter(k => CUSTOM_SECTIONS[section].indexOf(k) === -1);
    if (bad.length) throw new Error('custom: ' + section + '.' + bad[0] + ' is not a setting');
  });

  const next = clone(state);
  if (!next.custom || typeof next.custom !== 'object') next.custom = K.defaultCustom();
  Object.keys(patch).forEach(section => {
    if (section === 'docLanguage') { next.custom.docLanguage = patch.docLanguage; return; }
    const sub = patch[section];
    if (!next.custom[section] || typeof next.custom[section] !== 'object') next.custom[section] = {};
    /* lists (tab order / hidden pages) are REPLACED, never merged element-wise */
    Object.keys(sub).forEach(k => {
      next.custom[section][k] = Array.isArray(sub[k]) ? sub[k].slice() : sub[k];
    });
  });

  const problems = K.customProblems(next.custom);
  if (problems.length) throw new Error('custom: ' + problems[0]);
  return next;
}

  K.updateShop = updateShop;
  K.setSettings = setSettings;
  K.setCustom = setCustom;
});
