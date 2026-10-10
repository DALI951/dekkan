/* DEKKAN CORE — the shop brain, assembled from the core/*.ts modules.
 *
 *   node (Node 24 runs .ts natively): require('./core/dekkan-core.ts')  ->  the full API (K)
 *   browser: the tsc build compiles these to core/*.js — load
 *            core/dekkan-core.js FIRST (creates window.DEK.core), then the
 *            module files in this order: core/core.js, products.js, debts.js,
 *            sales.js, refunds.js, employees.js, cashbox.js, report.js,
 *            shop.js, pin.js — each attaches its functions.
 *            window.Dekkan stays as the app's `D` (alias of window.DEK.core).
 */
'use strict';
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const K = {};
    ['core', 'products', 'debts', 'sales', 'refunds', 'employees', 'cashbox', 'report', 'shop', 'pin']
      .forEach(function (m) { require('./' + m + '.ts')(K); });
    module.exports = K;
    return;
  }
  root.DEK = root.DEK || {};
  root.DEK.core = root.DEK.core || {};
  root.Dekkan = root.DEK.core;
})(typeof self !== 'undefined' ? self : this);