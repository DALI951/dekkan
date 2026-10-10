/* DEKKAN ambient globals.
 *
 * The app is a classic global-script browser app (no bundler): every file
 * shares `window`/`self` and hangs its API off `window.DEK`, `window.Dekkan`,
 * `window.T`, etc. The node test harnesses load the same files inside a `vm`
 * sandbox, so these names are intentionally loose (`any`) during the
 * JS -> TS migration and get tightened module-by-module over time.
 */

interface Window {
  [key: string]: any;
}

declare var DEK: any;
declare var Dekkan: any;
declare var T: any;
declare var DEKKAN_FIREBASE: any;
declare var DEKKAN_FIREBASE_CONFIG: any;
