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

  K.updateShop = updateShop;
  K.setSettings = setSettings;
});
