/* DEKKAN UI — fmt: pure display helpers (number/currency/esc/kind labels).
 * Split mechanically from ui/app.js — bodies untouched.
 * T is injected at boot (ui/app.js calls DEK.fmt._setT(window.T)) so these
 * stay closure-free and unit-testable without a DOM.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  if (typeof window !== 'undefined' && root.DEK) factory(root.DEK);
})(typeof self !== 'undefined' ? self : this, function (DEK) {
  'use strict';

  var T = null;
  function _setT(t) { T = t; }

  // ---------- the shop's own formats (wave 3) ----------
  // Every default here REPRODUCES what the app printed before this existed: three
  // decimals, no grouping, the currency word of the interface language, ISO dates,
  // 24h times. A shop changes what it wants; a shop that changes nothing sees no
  // difference at all. The state owns the choice (state.custom) and hands it over
  // once per render — these helpers stay closure-free and unit-testable.
  var DEF_MONEY = { code: 'TND', symbol: '', position: 'after', decimals: 3, thousands: '', digits: 'latin' };
  var DEF_DATE = { format: 'YYYY-MM-DD', time: '24h', timezone: '' };
  var MONEY = Object.assign({}, DEF_MONEY);
  var DATE = Object.assign({}, DEF_DATE);
  var DOC_LANG = '';          // the language a DOCUMENT prints in ('' = the interface's)
  var AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

  function _setCustom(c) {
    var m = (c && typeof c.money === 'object' && c.money) ? c.money : {};
    var d = (c && typeof c.date === 'object' && c.date) ? c.date : {};
    MONEY = Object.assign({}, DEF_MONEY, m);
    DATE = Object.assign({}, DEF_DATE, d);
    DOC_LANG = (c && typeof c.docLanguage === 'string') ? c.docLanguage : '';
  }

  function numerals(s) {
    if (MONEY.digits !== 'arabic') return s;
    return String(s).replace(/[0-9]/g, function (ch) { return AR_DIGITS.charAt(Number(ch)); });
  }

  // the language of the paper, not of the screen: a shop can run the app in French
  // and print receipts in Arabic (or the other way round)
  function docT(key) {
    var L = (typeof window !== 'undefined' && window.DEK && window.DEK.Langs) || null;
    if (DOC_LANG && L && L.has(DOC_LANG) && L.t) return L.t(DOC_LANG, key);
    return T.t(key);
  }

  var DATE_FORMATS = ['YYYY-MM-DD', 'YYYY/MM/DD', 'DD/MM/YYYY', 'MM/DD/YYYY', 'DD-MM-YYYY', 'DD.MM.YYYY'];

  // the date as the SHOP writes it. An unreadable format prints the plain ISO date
  // rather than inventing one (the paper must never lie).
  function docDate(iso) {
    var s = String(iso == null ? '' : iso);
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (!m) return s.slice(0, 10);
    if (DATE_FORMATS.indexOf(DATE.format) === -1) return m[1] + '-' + m[2] + '-' + m[3];
    return DATE.format.replace('YYYY', m[1]).replace('MM', m[2]).replace('DD', m[3]);
  }

  function fmt(n) { return Number(n).toFixed(3); }
  // money() is for SHOWING. For maths always use n3() (mirrors the core's rounding).
  function n3(n) { return Math.round(Number(n) * 1000) / 1000; }
  function money(n) {
    var v = n3(n);
    var dec = (typeof MONEY.decimals === 'number' && MONEY.decimals >= 0 && MONEY.decimals <= 3) ? MONEY.decimals : 3;
    var parts = Math.abs(v).toFixed(dec).split('.');
    if (MONEY.thousands) parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, MONEY.thousands);
    var out = (v < 0 ? '-' : '') + parts.join('.');
    out = numerals(out);
    var sym = MONEY.symbol || docT('curr');   // '' = the language's own word
    return MONEY.position === 'before' ? sym + ' ' + out : out + ' ' + sym;
  }
  function entryTime(iso) {
    const d = new Date(iso);
    const mi = String(d.getMinutes()).padStart(2, '0');
    const h = d.getHours();
    if (DATE.time === '12h') {
      const h12 = (h % 12) || 12;
      return String(h12).padStart(2, '0') + ':' + mi + ' ' + (h < 12 ? 'AM' : 'PM');
    }
    return String(h).padStart(2, '0') + ':' + mi;
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

  DEK.fmt = { fmt: fmt, n3: n3, money: money, entryTime: entryTime, esc: esc, stockLeft: stockLeft, kindLabel: kindLabel, _setT: _setT, _setCustom: _setCustom, docT: docT, docDate: docDate, DATE_FORMATS: DATE_FORMATS };
});