/* DEKKAN languages — the app ASKS a language object how to speak.
 *
 * The twin of ui/themes.ts, on purpose: a theme is an object that knows the 41
 * colour tokens, a LANGUAGE is an object that knows its own text.
 *
 *   { id: 'fr', name: 'French', native: 'Français', dir: 'ltr', keys: { … } }
 *
 * Adding a language = adding ONE object (or one file that registers itself here).
 * The engine owns everything that used to be an `=== 'ar'` branch scattered in the
 * UI: the direction, the persisted choice, the pre-paint no-flash attributes, the
 * fallback chain, and the PARITY contract against the base language.
 *
 * Loaded BEFORE ui/lang.ts (the data) — the data registers itself through add().
 * Contract checked by test/langs.test.ts; parity checked by scripts/check-i18n.ts.
 */
'use strict';
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DEK = Object.assign(root.DEK || {}, factory());
})(typeof self !== 'undefined' ? self : this, function () {

  var STORE_KEY = 'dekkan.lang';       // the chosen language id
  var DIR_KEY = 'dekkan.langdir';      // its direction, so the pre-paint snippet needs no language list
  var BASE_ID = 'en';                  // the parity reference: a new language is complete when it matches this

  var LANGS = {};
  var currentId = BASE_ID;

  // ---------- registration ----------

  // what a language MUST carry to be registrable. Loud, never silent:
  // a half-registered language would ship a menu with blank words in it.
  function problems(l) {
    var out = [];
    if (!l || typeof l !== 'object') return ['language must be an object'];
    if (typeof l.id !== 'string' || !/^[a-z]{2}(-[A-Za-z0-9]+)?$/.test(l.id)) {
      out.push('id must look like a language tag (en, ar, fr, ar-TN) — got ' + String(l.id));
    }
    if (typeof l.name !== 'string' || !l.name.trim()) out.push('name is required (English name)');
    if (typeof l.native !== 'string' || !l.native.trim()) out.push('native name is required (how the language names itself)');
    if (l.dir !== 'ltr' && l.dir !== 'rtl') out.push("dir must be 'ltr' or 'rtl' — got " + String(l.dir));
    if (!l.keys || typeof l.keys !== 'object' || Array.isArray(l.keys)) out.push('keys object is required');
    return out;
  }

  function add(lang) {
    var p = problems(lang);
    if (p.length) throw new Error('language refused: ' + p[0]);
    if (LANGS[lang.id]) throw new Error('language already registered: ' + lang.id);
    LANGS[lang.id] = lang;
    return lang;
  }

  function all() {
    return Object.keys(LANGS).map(function (id) { return LANGS[id]; });
  }
  function list() { return Object.keys(LANGS); }
  function get(id) { return LANGS[id] || null; }
  function has(id) { return !!LANGS[id]; }
  function keys(id) { return (LANGS[id] && LANGS[id].keys) || null; }

  // ---------- speaking ----------

  // current language, then the base language, then the key itself.
  // A missing word is a bug (check-i18n refuses it) — this chain only keeps a
  // single sloppy key from rendering as `undefined` on a shopkeeper's screen.
  function t(id, key) {
    var k = keys(id);
    if (k && k[key] !== undefined) return k[key];
    var b = keys(BASE_ID);
    if (b && b[key] !== undefined) return b[key];
    return key;
  }

  function dir(id) { return (LANGS[id] && LANGS[id].dir) || 'ltr'; }

  // the parity contract: what this language is missing / has extra / left empty
  function parity(id) {
    var base = Object.keys(keys(BASE_ID) || {});
    var mine = keys(id) || {};
    var mineKeys = Object.keys(mine);
    var missing = base.filter(function (k) { return mineKeys.indexOf(k) === -1; });
    var extra = mineKeys.filter(function (k) { return base.indexOf(k) === -1; });
    var empty = mineKeys.filter(function (k) { return typeof mine[k] !== 'string' || !mine[k].trim(); });
    return { id: id, missing: missing, extra: extra, empty: empty, ok: !missing.length && !extra.length && !empty.length };
  }

  function parityAll() { return list().map(parity); }

  // ---------- the saved choice + the DOM ----------

  // a saved id is honoured; anything unknown (an old build, a hand-edited
  // localStorage) falls back to the base instead of showing a broken UI.
  function resolve(saved) {
    return (saved && LANGS[saved]) ? saved : BASE_ID;
  }

  function readStore() {
    if (typeof localStorage === 'undefined') return null;
    try { return localStorage.getItem(STORE_KEY); } catch (e) { return null; }
  }

  function remember(id) {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORE_KEY, id);
      localStorage.setItem(DIR_KEY, dir(id));
    } catch (e) { /* private mode: the app still works, the choice is just not kept */ }
  }

  function declare(id) {
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.lang = id;
      document.documentElement.dir = dir(id);
    }
  }

  function set(id) {
    if (!LANGS[id]) return false;
    currentId = id;
    declare(id);
    remember(id);
    return true;
  }

  // boot: adopt the saved language and declare its direction BEFORE the first
  // paint (the same no-flash trick the theme engine uses).
  function restore() {
    currentId = resolve(readStore());
    declare(currentId);
    return currentId;
  }

  var Langs = {
    base: BASE_ID,
    STORE_KEY: STORE_KEY,
    DIR_KEY: DIR_KEY,
    add: add,
    all: all,
    list: list,
    get: get,
    has: has,
    keys: keys,
    t: t,
    dir: dir,
    parity: parity,
    parityAll: parityAll,
    resolve: resolve,
    remember: remember,
    declare: declare,
    set: set,
    restore: restore,
    current: function () { return LANGS[currentId]; },
    direction: function () { return dir(currentId); },
    problems: problems
  };

  return { LANGS: LANGS, Langs: Langs };
});
