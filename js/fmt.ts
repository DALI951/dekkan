/* DEKKAN UI — fmt: pure display helpers (number/currency/esc/kind labels).
 * Split mechanically from js/app.js — bodies untouched.
 * T is injected at boot (js/app.js calls DEK.fmt._setT(window.T)) so these
 * stay closure-free and unit-testable without a DOM.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  if (typeof window !== 'undefined' && root.DEK) factory(root.DEK);
})(typeof self !== 'undefined' ? self : this, function (DEK) {
  'use strict';

  var T = null;
  function _setT(t) { T = t; }

  function fmt(n) { return Number(n).toFixed(3); }
  // money() is for SHOWING. For maths always use n3() (mirrors the core's rounding).
  function n3(n) { return Math.round(Number(n) * 1000) / 1000; }
  function money(n) { return fmt(n3(n)) + ' ' + T.t('curr'); }
  function entryTime(iso) {
    const d = new Date(iso);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function stockLeft(n) {
    const ar = T.lang === 'ar';
    return ar ? n + ' ' + T.t('stock.left') : n + ' ' + T.t('stock.leftEn');
  }
  function kindLabel(k) {
    const map = {
      sale: 'kind.sale', 'debt-pay': 'kind.debtPay', refund: 'kind.refund',
      buy: 'kind.buy', expense: 'kind.expense', income: 'kind.income', check: 'kind.check'
    };
    return T.t(map[k] || k);
  }

  DEK.fmt = { fmt: fmt, n3: n3, money: money, entryTime: entryTime, esc: esc, stockLeft: stockLeft, kindLabel: kindLabel, _setT: _setT };
});