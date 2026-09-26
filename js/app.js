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
  const A_VERSION = '0.19.0';

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
    storageRead: false,
    sync: 'none',        // 'none' | 'ok' | 'local' | 'error' | 'expired' — what the cloud is doing
    syncAt: 0            // when it last succeeded (ms)
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
    schedulePush();
  }
  // the cloud copy rides on every local save, quietly, debounced
  let pushTimer = null;
  function schedulePush() {
    const A = C.auth;
    if (!A || !A.isLoggedIn() || typeof fetch !== 'function') return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () {
      A.pushState(C.state).then(function (ok) {
        if (ok) { C.sync = 'ok'; C.syncAt = Date.now(); rememberSync(); }
        else if (A.isExpired()) C.sync = 'expired';
        else C.sync = 'error';
      }).catch(function () { C.sync = 'error'; });
    }, 1200);
  }
  // when the cloud last answered, so Settings can tell him the truth after a reload
  function rememberSync() {
    try { localStorage.setItem('dekkan.syncAt', String(C.syncAt || 0)); } catch (e) { /* ignore */ }
  }
  try { C.syncAt = parseInt(localStorage.getItem('dekkan.syncAt') || '0', 10) || 0; } catch (e) { C.syncAt = 0; }
  function load() {
    try {
      const a = localStorage.getItem(LS_KEY);
      if (a) return migrate(JSON.parse(a));
      const b = localStorage.getItem(BK_KEY);
      if (b) return migrate(JSON.parse(b));
    } catch (e) { /* fresh start below */ }
    return D.createShop({ name: T.t('app.name') });
  }
  // An old, hand-edited or cloud-copied state must never be able to take a page
  // down: `state.debts.filter` on a shop saved before the notebook existed threw
  // a white screen on the Debts page. Fill the shape, keep the data.
  function migrate(s) {
    if (!s) s = {};
    if (!Array.isArray(s.customers)) s.customers = [];
    if (!s.categories || !Array.isArray(s.categories.in) || !Array.isArray(s.categories.out)) {
      s.categories = { in: [], out: [] };
    }
    if (!Array.isArray(s.employees)) s.employees = [];
    if (!Array.isArray(s.products)) s.products = [];
    if (!Array.isArray(s.days)) s.days = [];
    if (!Array.isArray(s.debts)) s.debts = [];
    if (!s.settings || typeof s.settings !== 'object') s.settings = {};
    if (typeof s.settings.allowDiscount !== 'boolean') s.settings.allowDiscount = true;
    if (typeof s.settings.allowRefund !== 'boolean') s.settings.allowRefund = true;
    if (!s.shop || typeof s.shop !== 'object') s.shop = { name: T.t('app.name'), startCash: 0 };
    if (!s.day || typeof s.day !== 'object') s.day = newDay();
    else {
      if (!Array.isArray(s.day.entries)) s.day.entries = [];
      if (!Array.isArray(s.day.checks)) s.day.checks = [];
      if (!Array.isArray(s.day.cashbox)) s.day.cashbox = [];
      if (!s.day.soldByProduct || typeof s.day.soldByProduct !== 'object') s.day.soldByProduct = {};
      if (!s.day.soldFree || typeof s.day.soldFree !== 'object') s.day.soldFree = {};
      if (!s.day.date) s.day.date = D.todayStr();
      if (typeof s.day.startCash !== 'number' || !isFinite(s.day.startCash)) s.day.startCash = 0;
      if (typeof s.day.soldCost !== 'number' || !isFinite(s.day.soldCost)) s.day.soldCost = 0;
    }
    return s;
  }
  // a day that opens right now (used when a state arrives with no open day)
  function newDay() {
    return { date: D.todayStr(), openedAt: Date.now(), startCash: 0, soldCost: 0, entries: [], checks: [], soldByProduct: {}, soldFree: {} };
  }
  C.state = load();
  C.save = save;
  C.load = load;

  // the account layer (js/auth.js): session + cloud sync — available to every render
  const AUTH = window.DEK.Auth;
  AUTH.init();
  C.auth = AUTH;

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
  // Both events: a phone date picker fires "input" while you are still choosing,
  // a desktop select fires "change" when it closes.
  const dp = $('dayPicker'), bt = $('btnDayToday');
  const onDayChange = function () {
    C.reportDate = dp.value || '';
    C._lastReportDate = null;
    P.render(C);
  };
  if (dp) { dp.addEventListener('change', onDayChange); dp.addEventListener('input', onDayChange); }
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

  // ---------- the account: cloud backup (opt-in, from Settings) ----------
  // js/auth.js talks to the API; this block decides when the form is up.
  // THE RULE (2026-09-26): the shop NEVER ambushes you with a login form.
  // It opens straight into the till, signed in or not. The account lives in one
  // Settings card, and a cloud copy can never replace a till that has money in
  // it without asking first.
  let gateMode = 'login'; // 'login' | 'register'

  function gateError(msg) {
    const el = $('gateError');
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle('hidden', !msg);
  }
  function openAccount(mode) {
    if (!$('gate')) return;
    if (mode) gateMode = mode;
    fillGate();
    $('gate').style.display = '';
    $('gate').classList.remove('hidden');
    const first = $('gateEmail');
    if (first && first.focus) setTimeout(function () { try { first.focus(); } catch (e) {} }, 30);
  }
  function hideGate() {
    if (!$('gate')) return;
    $('gate').style.display = 'none';
    $('gate').classList.add('hidden');
    gateError('');
  }
  function showRow(id, on) {
    const el = $(id);
    if (el && el.classList) el.classList.toggle('hidden', !on);
  }
  function fillGate() {
    const reg = gateMode === 'register';
    $('gateTitle').textContent = T.t('auth.title');
    $('gateSub').textContent = T.t('auth.sub');
    showRow('gateNameRow', reg);
    if ($('gateName').style) $('gateName').style.display = reg ? '' : 'none';
    showRow('gatePass2Row', reg);
    $('gateSubmit').textContent = T.t(reg ? 'auth.submitRegister' : 'auth.submitLogin');
    $('gateSwitch').textContent = T.t(reg ? 'auth.switchToLogin' : 'auth.switchToRegister');
    $('gateSkip').textContent = T.t('auth.close');
    $('gatePass').setAttribute('autocomplete', reg ? 'new-password' : 'current-password');
  }
  function gateBusy(on) { $('gateSubmit').disabled = !!on; }

  // how much this device actually has to lose: money already moved in it
  function hasMoves(s) {
    if (!s) return false;
    if ((s.day && s.day.entries && s.day.entries.length) ||
      (s.day && s.day.checks && s.day.checks.length)) return true;
    for (let i = 0; i < ((s.days || []).length); i++) {
      const d = s.days[i];
      if ((d.entries && d.entries.length) || (d.checks && d.checks.length)) return true;
    }
    return false;
  }
  // take the cloud copy as the live shop — but NEVER without a backup of what it replaced
  function adoptCloud(remote) {
    try { localStorage.setItem('dekkan.premerge', JSON.stringify(C.state)); } catch (e) { /* full */ }
    C.state = migrate(remote);
    C.basket = [];
    C.freeItems = [];
    C.refundMode = false;
    C.refundProductId = null;
    C.receiptEntryId = null;
    C.reportDate = '';
    C._lastReportDate = null;
    C.newDebtFlag = false;
    C.payDebtId = null;
    C._lastPushAt = Date.now();
    C.sync = 'ok';
    save();
    render();
  }
  // the honest cloud handshake. A copy that differs from a till WITH moves is a
  // question, not a takeover: he is asked, and the local copy is stashed either way.
  function mergeCloud(remote) {
    if (!remote || !remote.days) return false;
    if (JSON.stringify(remote) === JSON.stringify(C.state)) { C.sync = 'ok'; return true; }
    if (!hasMoves(C.state)) { adoptCloud(remote); toast(T.t('auth.synced')); return true; }
    if (confirm(T.t('auth.mergeAsk'))) {
      adoptCloud(remote);
      toast(T.t('auth.synced'));
    } else {
      C.sync = 'local';
      save();
      toast(T.t('auth.mergeKept'), true);
    }
    return true;
  }
  // boot + after a sign-in: pull the cloud copy and deal with it honestly
  function pullCloud() {
    if (!AUTH.isLoggedIn()) return Promise.resolve(false);
    return AUTH.fetchState().then(function (remote) {
      if (AUTH.isExpired()) {           // the token died server-side — SAY SO, never vanish
        C.sync = 'expired';
        render();
        return false;
      }
      if (remote && remote.days) {
        mergeCloud(remote);
        if (C.sync !== 'local') { C._lastPushAt = Date.now(); C.sync = 'ok'; }
        render();
        return true;
      }
      C.sync = AUTH.syncError() ? 'error' : 'none';
      schedulePush();                     // first sign-in: get this shop up there
      render();
      return false;
    }).catch(function () { C.sync = 'error'; render(); return false; });
  }

  function gateSubmit() {
    const email = $('gateEmail').value.trim().toLowerCase();
    const pass = $('gatePass').value;
    const name = $('gateName').value.trim();
    const pass2 = $('gatePass2') ? $('gatePass2').value : '';
    gateError('');
    if (gateMode === 'register' && pass !== pass2) {   // typed it twice, wrong the second time
      gateError(T.t('auth.err.passMismatch'));
      return;
    }
    gateBusy(true);
    const p = gateMode === 'register' ? AUTH.register(email, pass, name) : AUTH.login(email, pass);
    p.then(function (user) {
      gateBusy(false);
      if (!user) { gateError(T.t('auth.err.server')); return; }
      hideGate();
      toast(T.t('auth.welcome'));
      render();
      return pullCloud();
    }).catch(function (e) {
      gateBusy(false);
      gateError(T.t((e && e.code) || 'auth.err.server'));
    });
  }

  // boot: no gate, ever. A saved session just quietly pulls its cloud copy.
  hideGate();
  if (AUTH.isLoggedIn()) pullCloud();
  else { C.sync = 'none'; C.syncAt = 0; }

  const gateForm = $('gateForm');
  if (gateForm) gateForm.addEventListener('submit', function (ev) { ev.preventDefault(); gateSubmit(); });
  const gateSwitch = $('gateSwitch');
  if (gateSwitch) gateSwitch.addEventListener('click', function () {
    gateMode = gateMode === 'register' ? 'login' : 'register';
    gateError('');
    fillGate();
  });
  const gateSkip = $('gateSkip');
  if (gateSkip) gateSkip.addEventListener('click', hideGate);
  const btnAccountOpen = $('btnAccountOpen');
  if (btnAccountOpen) btnAccountOpen.addEventListener('click', function () { openAccount(); });
  // show / hide the password — you cannot check 6 characters you cannot see
  const btnEye = $('btnGateEye');
  if (btnEye) btnEye.addEventListener('click', function () {
    const f = $('gatePass');
    const on = f.type === 'password';
    f.type = on ? 'text' : 'password';
    btnEye.textContent = on ? '\u{1F648}' : '\u{1F441}';
    btnEye.setAttribute('aria-label', on ? 'hide password' : 'show password');
    f.focus();
  });
  const btnSignOut = $('btnSignOut');
  if (btnSignOut) btnSignOut.addEventListener('click', function () {
    AUTH.logout().then(function () {
      C.sync = 'none';
      toast(T.t('toast.signedOut'));
      render();
    });
  });
  C.openAccount = openAccount;
})();
