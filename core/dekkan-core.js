/* DEKKAN CORE — the shop brain, assembled from the core/*.js modules.
 *
 *   node:    require('./core/dekkan-core.js')  ->  the full API (K)
 *   browser: <script src="core/dekkan-core.js"></script> FIRST (creates
 *            window.DEK.core), then the module files in this order:
 *            core/core.js, products.js, debts.js, sales.js, refunds.js,
 *            cashbox.js, report.js, shop.js  — each attaches its functions.
 *            window.Dekkan stays as the app's `D` (alias of window.DEK.core).
 */
'use strict';
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const K = {};
    ['core', 'products', 'debts', 'sales', 'refunds', 'cashbox', 'report', 'shop']
      .forEach(function (m) { require('./' + m + '.js')(K); });
    module.exports = K;
    return;
  }
  root.DEK = root.DEK || {};
  root.DEK.core = root.DEK.core || {};
  root.Dekkan = root.DEK.core;
})(typeof self !== 'undefined' ? self : this);