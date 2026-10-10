/* DEKKAN CORE — owner PIN. A 4-6 digit lock for the money-moving actions
   (refunds, undo, close day, import, reset, deletions). The PIN is never
   stored plaintext: we keep an FNV-1a hash + a random salt in settings, so
   a backup file or a glance at localStorage reveals nothing usable. This is
   shop-floor security (stop the casual fat-finger / curious cashier), not
   military-grade crypto — the hash is not password-hardened. */
'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  if (typeof window !== 'undefined' && root.DEK && root.DEK.core) factory(root.DEK.core);
})(typeof self !== 'undefined' ? self : this, function (K) {
  const { clone } = K;

  // FNV-1a 32-bit — small, deterministic, fine for a 4-6 digit lock.
  function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h.toString(36);
  }
  function salt() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
  function hashOf(pin, s) { return fnv1a('dekkan:' + s + ':' + pin); }

  function hasPin(state) {
    return !!(state && state.settings && state.settings.pinHash);
  }

  // set/change: pin must be 4-6 digits
  function setPin(state, pin) {
    state = clone(state);
    if (!/^\d{4,6}$/.test(String(pin))) throw new Error('PIN must be 4-6 digits');
    const s = salt();
    state.settings.pinHash = hashOf(String(pin), s);
    state.settings.pinSalt = s;
    return state;
  }

  function clearPin(state) {
    state = clone(state);
    delete state.settings.pinHash;
    delete state.settings.pinSalt;
    return state;
  }

  function checkPin(state, pin) {
    if (!hasPin(state)) return true; // no lock = nothing to enter
    if (!/^\d{4,6}$/.test(String(pin))) return false;
    const s = state.settings.pinSalt || '';
    return hashOf(String(pin), s) === state.settings.pinHash;
  }

  K.hasPin = hasPin;
  K.setPin = setPin;
  K.clearPin = clearPin;
  K.checkPin = checkPin;
});