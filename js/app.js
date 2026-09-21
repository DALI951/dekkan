/* DEKKAN — the shop webapp (v4: theme engine + till-style report).
 * UI SHELL ONLY: builds window.DEK.app (the ctx for js/fmt.js, js/pages.js,
 * js/actions.js), wires every button/input/keyboard/key, and persists state.
 * Every business rule lives in core/dekkan-core.js.
 * Every user-visible string goes through T.t() (js/lang.js).
 * Every color comes from a theme token (js/themes.js) — no hardcoded colors here.
 *
 * The renderers live in js/pages.js, the click handlers in js/actions.js,
 * the display helpers in js/fmt.js — this file only glues them to the DOM.
 */
'use strict';
(function () {
  const D = window.Dekkan;
  const T = window.T;
  const DEK = window.DEK;
  const P = DEK.pages;
  const A = DEK.actions;
  const LS_KEY = 'dekkan.v1';
  const BK_KEY = 'dekkan.backup';
  const A_VERSION = '0.17.0';

  // ---------- helpers ----------
  function $(id) { return document.getElementById(id); }
  function toast(msg, isErr, ms) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.toggle('err', !!isErr);
    t.classList.remove('hidden');
    clearTimeout(t._h);
    t._h = setTimeout(function () { t.classList.add('hidden'); }, ms || 2600);
  }
  function themes() { return window.DEK && window.DEK.Themes; }

  // ---------- state ----------
  const C = window.DEK.app = {
    $: $, T: T, D: D, fmt: DEK.fmt, version: A_VERSION,
    toast: toast, themes: themes,
    LS_KEY: LS_KEY, BK_KEY: BK_KEY,
    basket: [],          // { id, qty }                 stock items
    freeItems: [],       // { name, price, qty }        no-stock items
    refundMode: false,
    refundProductId: null,
    editProductId: null,
    payDebtId: null,
    newDebtFlag: false,
    editEmployeeId: null,       // 'new' or an employee id while the staff form is open
    month: D.todayStr().slice(0, 7), // the month shown in the monthly review
    receiptEntryId: null,   // entry id of the sale currently shown on the receipt (for refunds)
    storageRead: false
  };

  // ---------- persistence ----------
  function save() {
    try {
      const json = JSON.stringify(C.state);
      localStorage.setItem(LS_KEY, json);
      localStorage.setItem(BK_KEY, json);
    } catch (e) {
      toast(T.t('toast.couldntSave'), true);
    }
  }
  function load() {
    try {
      const a = localStorage.getItem(LS_KEY);
      if (a) return migrate(JSON.parse(a));
      const b = localStorage.getItem(BK_KEY);
      if (b) return migrate(JSON.parse(b));
    } catch (e) { /* fresh start below */ }
    return D.createShop({ name: T.t('app.name') });
  }
  // saved states made before the customer registry existed (v2 shops)
  function migrate(s) {
    if (!s || !Array.isArray(s.customers)) {
      if (!s) s = {};
      s.customers = [];
    }
    if (!s.categories || !Array.isArray(s.categories.in) || !Array.isArray(s.categories.out)) {
      s.categories = { in: [], out: [] };
    }
    if (!Array.isArray(s.employees)) s.employees = [];
    return s;
  }
  C.state = load();
  C.save = save;
  C.load = load;

  // ---------- the two verbs every handler ends with ----------
  function run(fn, okMsg) {
    try {
      C.state = fn(C.state);
      save();
      render();
      if (okMsg) toast(okMsg);
    } catch (e) {
      toast(e.message, true);
    }
  }
  function render() { P.render(C); }
  C.run = run;
  C.render = render;

  // display helpers need the translator — hand it over before the first render
  DEK.fmt._setT(T);
  window.addEventListener('pagehide', save);

  // ---------- events (bound once) ----------
  document.addEventListener('click', function (ev) { A.onClick(C, ev); });

  // ----- the report: pick a past day or jump back to today -----
  const dp = $('dayPicker'), bt = $('btnDayToday');
  if (dp) dp.addEventListener('change', function () {
    C.reportDate = dp.value || '';
    C._lastReportDate = null;
    P.render(C);
  });
  if (bt) bt.addEventListener('click', function () {
    C.reportDate = '';
    C._lastReportDate = null;
    P.render(C);
  });

  // ----- owner lock: the keypad in front of the money actions -----
  const keypad = $('keypad');
  if (keypad) keypad.addEventListener('click', function (ev) {
    const k = ev.target.closest ? ev.target.closest('.key') : null;
    if (!k) return;
    P.pinKey(C, k.getAttribute('data-pin'));
  });
  const pinCancel = $('btnPinCancel');
  if (pinCancel) pinCancel.addEventListener('click', function () { P.closePin(C); });
  $('pinPanel').addEventListener('click', function (ev) {
    if (ev.target === $('pinPanel')) P.closePin(C);
  });
  const pinSet = $('btnPinSet'), pinClear = $('btnPinClear');
  if (pinSet) pinSet.addEventListener('click', function () { A.pinSet(C); });
  if (pinClear) pinClear.addEventListener('click', function () { A.pinClear(C); });

  // ----- the till: one checkout = one client = one receipt -----
  $('btnReceiptRefund').addEventListener('click', function () { A.receiptRefund(C); });
  $('btnReceiptClose').addEventListener('click', function () { P.hideReceipt(C); });
  $('btnReceiptClose2').addEventListener('click', function () { P.hideReceipt(C); });
  $('btnReceiptPrint').addEventListener('click', function () {
    if (window.print) window.print(); // the print CSS turns the overlay into a clean facture
  });
  $('btnMetricClose').addEventListener('click', function () { $('metricPanel').classList.add('hidden'); if (document.body) document.body.classList.remove('no-scroll'); });
  $('metricPanel').addEventListener('click', function (ev) {
    if (ev.target === $('metricPanel')) { $('metricPanel').classList.add('hidden'); if (document.body) document.body.classList.remove('no-scroll'); }
  });
  $('receipt').addEventListener('click', function (ev) {
    if (ev.target === $('receipt')) P.hideReceipt(C);
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Escape') return;
    if (!$('receipt').classList.contains('hidden')) { P.hideReceipt(C); return; }
    if (!$('metricPanel').classList.contains('hidden')) { $('metricPanel').classList.add('hidden'); if (document.body) document.body.classList.remove('no-scroll'); return; }
    const pf = $('payForm');
    if (pf && !pf.classList.contains('hidden')) pf.classList.add('hidden');
  });

  // Cancel on the record-sale form: drop the whole order, reset the till, back to products.
  $('btnCancelSell').addEventListener('click', function () { A.cancelSell(C); });
  $('btnSell').addEventListener('click', function () { A.doSell(C); });
  $('btnAddFree').addEventListener('click', function () { A.addFree(C); });

  // the till: what was handed over + who owes the rest (live, before the sale is recorded)
  ['paidCash', 'creditName', 'discPct', 'discAmt', 'freeName', 'freePrice', 'freeQty', 'sellSearch'].forEach(function (id) {
    const el = $(id);
    if (el) el.addEventListener('input', function () { P.renderSell(C); });
  });
  // the cashier field is a person, not a form value: once typed, keep it
  const s_csv = $('cashierName');
  if (s_csv) {
    s_csv.addEventListener('input', function () { if (s_csv.dataset) s_csv.dataset.touched = '1'; });
    s_csv.addEventListener('input', function () { P.renderSell(C); });
  }

  $('btnRefundMode').addEventListener('click', function () { A.toggleRefundMode(C); });
  $('btnDoRefund').addEventListener('click', function () { A.doRefund(C); });

  // stock form
  $('btnAddProduct').addEventListener('click', function () { A.newProduct(C); });
  $('btnCancelProduct').addEventListener('click', function () { A.cancelProduct(C); });
  $('btnSaveProduct').addEventListener('click', function () { A.saveProduct(C); });

  // debts form
  $('btnAddDebt').addEventListener('click', function () { A.openNewDebt(C); });
  $('btnCancelDebt').addEventListener('click', function () { P.setNewDebt(C, false); });
  $('btnSaveDebt').addEventListener('click', function () { A.saveDebt(C); });
  $('btnCancelPay').addEventListener('click', function () { A.cancelPay(C); });
  $('btnDoPay').addEventListener('click', function () { A.doPay(C); });

  // staff form
  $('btnAddEmployee').addEventListener('click', function () { A.newEmployee(C); });
  $('btnCancelEmployee').addEventListener('click', function () { A.cancelEmployee(C); });
  $('btnSaveEmployee').addEventListener('click', function () { A.saveEmployee(C); });
  var monthPicker = $('monthPicker');
  monthPicker.addEventListener('input', function () { C.month = monthPicker.value; render(); });

  // ----- Enter = the button on every form (the till never needs a mouse) -----
  A.enterRuns(C, ['freeName', 'freePrice', 'freeQty'], function () { A.press(C, 'btnAddFree'); });
  A.enterRuns(C, ['creditName', 'discPct', 'discAmt', 'paidCash'], function () { A.press(C, 'btnSell'); });
  A.enterRuns(C, ['payAmount'], function () { A.press(C, 'btnDoPay'); });
  A.enterRuns(C, ['dName', 'dAmount', 'dPhone', 'dNote'], function () { A.press(C, 'btnSaveDebt'); });
  A.enterRuns(C, ['pName', 'pBuy', 'pSell', 'pStock', 'pLow'], function () { A.press(C, 'btnSaveProduct'); });
  A.enterRuns(C, ['empName', 'empType', 'empSalary', 'empPhone', 'empNote'], function () { A.press(C, 'btnSaveEmployee'); });

  // cash box
  $('btnCashIn').addEventListener('click', function () { A.bookCash(C, 'in'); });
  $('btnCashOut').addEventListener('click', function () { A.bookCash(C, 'out'); });
  $('btnCatInAdd').addEventListener('click', function () { A.addCat(C, 'in'); });
  $('btnCatOutAdd').addEventListener('click', function () { A.addCat(C, 'out'); });
  A.enterRuns(C, ['cbInAmt', 'cbInSrc'], function () { A.press(C, 'btnCashIn'); });
  A.enterRuns(C, ['cbOutAmt', 'cbOutPurpose'], function () { A.press(C, 'btnCashOut'); });
  A.enterRuns(C, ['catInName'], function () { A.press(C, 'btnCatInAdd'); });
  A.enterRuns(C, ['catOutName'], function () { A.press(C, 'btnCatOutAdd'); });

  // report
  $('btnCheckCash').addEventListener('click', function () { A.doCheckCash(C); });
  $('countedCash').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') A.doCheckCash(C); });

  // settings
  $('btnSaveCfg').addEventListener('click', function () { A.saveCfg(C); });
  $('cfgDiscount').addEventListener('change', function () { A.toggleDiscount(C); });
  $('cfgRefund').addEventListener('change', function () { A.toggleRefund(C); });
  $('btnCloseDay').addEventListener('click', function () { A.closeDay(C); });
  $('btnUndoSale').addEventListener('click', function () { A.undoLastSale(C); });
  $('btnExport').addEventListener('click', function () { A.exportBackup(C); });
  $('btnImport').addEventListener('click', function () { A.importBackup(C); });
  $('importFile').addEventListener('change', function () {
    if (importFile.files && importFile.files[0]) A.onImportFile(C, importFile.files[0]);
    importFile.value = ''; // allow re-picking the same file later
  });
  $('btnReset').addEventListener('click', function () { A.resetAll(C); });

  // language toggle
  $('langAr').addEventListener('click', function () { T.set('ar'); });
  $('langEn').addEventListener('click', function () { T.set('en'); });
  window.addEventListener('dekkan:lang', render);
  document.addEventListener('dekkan:theme', function () { P.renderThemes(C); });

  // navigation (sidebar + bottom bar)
  const tabs = document.querySelectorAll('.tab, .navitem');
  tabs.forEach(function (t) {
    t.addEventListener('click', function () {
      location.hash = t.getAttribute('data-hash');
    });
  });
  function navigate() {
    const hash = location.hash || '#/sell';
    document.querySelectorAll('.page').forEach(function (p) { p.classList.add('hidden'); });
    const page = $('page-' + hash.replace('#/', '')) || $('page-sell');
    page.classList.remove('hidden');
    page.classList.add('show');
    tabs.forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-hash') === hash);
    });
    render();
  }
  window.addEventListener('hashchange', navigate);
  navigate();
})();
