/* DEKKAN themes — the app ASKS a theme object how it should look.
 * Every color the UI uses is a CSS custom property; a theme = a full set
 * of those properties. Adding a new theme later = add one object here.
 * Loaded in <head> (before the app) so the saved theme applies with no flash.
 */
'use strict';
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DEK = Object.assign(root.DEK || {}, factory());
})(typeof self !== 'undefined' ? self : this, function () {

  var STORE_KEY = 'dekkan.theme';       // the chosen BASE theme id (no-flash cache)
  var TOKENS_KEY = 'dekkan.themetokens'; // its overrides, so the head script can paint the shop's own colors
  var DEFAULT = 'souk';

  // every theme MUST define exactly these tokens — checked by test/themes.test.js
  var BASE = [
    '--bg', '--bg2', '--glowa', '--glowb',
    '--panel', '--panel2', '--panel3',
    '--line', '--line2',
    '--txt', '--mut', '--dim',
    '--acc', '--acc2', '--accdark', '--accbg', '--accborder', '--accover', '--accglow',
    '--ok', '--okbg', '--okhi', '--danger', '--dangerbg', '--dangerhi', '--ink',
    '--pri1', '--pri2', '--priedge',
    '--coin1', '--coin2', '--coin3', '--coinedge', '--coinring', '--coinshadow',
    '--inbg', '--inbgfocus', '--switchknob', '--switchfill', '--scrail', '--scrthumb', '--shadow'
  ];

  var THEMES = {
    /* ---- Gold Souk: brass gold coin on espresso ink (the original identity) ---- */
    souk: {
      id: 'souk', nameKey: 'theme.souk', preview: ['#171310', '#e8b04b', '#f8d184'],
      tokens: {
        '--bg': '#0e0c0a', '--bg2': '#141108',
        '--glowa': 'rgba(232,176,75,.06)', '--glowb': 'rgba(232,176,75,.04)',
        '--panel': '#171310', '--panel2': '#1d1813', '--panel3': '#262019',
        '--line': 'rgba(245,220,180,.08)', '--line2': 'rgba(245,220,180,.15)',
        '--txt': '#f2ead9', '--mut': '#b3a48d', '--dim': '#87785f',
        '--acc': '#e8b04b', '--acc2': '#f4c668', '--accdark': '#b97f24',
        '--accbg': 'rgba(232,176,75,.12)', '--accborder': 'rgba(232,176,75,.4)',
        '--accover': 'rgba(232,176,75,.18)', '--accglow': 'rgba(232,176,75,.3)',
        '--ok': '#2ea368', '--okbg': 'rgba(46,163,104,.14)', '--okhi': '#46d493',
        '--danger': '#d8453f', '--dangerbg': 'rgba(216,69,63,.13)', '--dangerhi': '#e5706b',
        '--ink': '#241a08',
        '--pri1': '#f0bc5a', '--pri2': '#d99a35', '--priedge': 'rgba(255,236,190,.5)',
        '--coin1': '#f8d184', '--coin2': '#e8b04b', '--coin3': '#a97a28',
        '--coinedge': 'rgba(255,236,190,.65)', '--coinring': 'rgba(36,26,8,.5)',
        '--coinshadow': 'rgba(110,72,18,.55)',
        '--inbg': '#262019', '--inbgfocus': '#2b2419',
        '--switchknob': '#d1c8b4', '--switchfill': '#f0bc5a',
        '--scrail': 'rgba(245,220,180,.12)', '--scrthumb': 'rgba(245,220,180,.22)',
        '--shadow': '0 12px 32px rgba(0,0,0,.45)'
      }
    },

    /* ---- Midnight Mint: deep green ledger, mint money. Fresh for cafés ---- */
    mint: {
      id: 'mint', nameKey: 'theme.mint', preview: ['#0e271e', '#2fce8a', '#7cf0b8'],
      tokens: {
        '--bg': '#06140f', '--bg2': '#081b13',
        '--glowa': 'rgba(53,214,142,.07)', '--glowb': 'rgba(53,214,142,.04)',
        '--panel': '#0a1e16', '--panel2': '#0e271e', '--panel3': '#143327',
        '--line': 'rgba(190,240,215,.08)', '--line2': 'rgba(190,240,215,.14)',
        '--txt': '#e6f6ee', '--mut': '#8fb8a6', '--dim': '#63917d',
        '--acc': '#2fce8a', '--acc2': '#5ce6a8', '--accdark': '#179c60',
        '--accbg': 'rgba(47,206,138,.14)', '--accborder': 'rgba(47,206,138,.4)',
        '--accover': 'rgba(47,206,138,.2)', '--accglow': 'rgba(47,206,138,.28)',
        '--ok': '#2fce8a', '--okbg': 'rgba(47,206,138,.14)', '--okhi': '#5ce6a8',
        '--danger': '#e0564e', '--dangerbg': 'rgba(224,86,78,.13)', '--dangerhi': '#f2827a',
        '--ink': '#032b1b',
        '--pri1': '#3ade92', '--pri2': '#17a268', '--priedge': 'rgba(190,255,225,.5)',
        '--coin1': '#7cf0b8', '--coin2': '#2fce8a', '--coin3': '#0f8a54',
        '--coinedge': 'rgba(210,255,235,.6)', '--coinring': 'rgba(3,43,27,.5)',
        '--coinshadow': 'rgba(4,70,42,.6)',
        '--inbg': '#143327', '--inbgfocus': '#15402f',
        '--switchknob': '#b8e6d1', '--switchfill': '#3ade92',
        '--scrail': 'rgba(190,240,215,.12)', '--scrthumb': 'rgba(190,240,215,.22)',
        '--shadow': '0 12px 32px rgba(0,0,0,.5)'
      }
    },

    /* ---- Indigo Night: deep navy treasury, indigo coin. Calm & official ---- */
    royal: {
      id: 'royal', nameKey: 'theme.royal', preview: ['#151d38', '#818cf8', '#b6c0ff'],
      tokens: {
        '--bg': '#0a0e1c', '--bg2': '#101530',
        '--glowa': 'rgba(148,163,255,.07)', '--glowb': 'rgba(148,163,255,.04)',
        '--panel': '#10162b', '--panel2': '#151d38', '--panel3': '#1c2445',
        '--line': 'rgba(200,210,255,.08)', '--line2': 'rgba(200,210,255,.15)',
        '--txt': '#eef0ff', '--mut': '#a8aed8', '--dim': '#727aa8',
        '--acc': '#818cf8', '--acc2': '#a5b4fc', '--accdark': '#5b66d6',
        '--accbg': 'rgba(129,140,248,.14)', '--accborder': 'rgba(129,140,248,.4)',
        '--accover': 'rgba(129,140,248,.2)', '--accglow': 'rgba(129,140,248,.3)',
        '--ok': '#34d399', '--okbg': 'rgba(52,211,153,.14)', '--okhi': '#6ee7b7',
        '--danger': '#f87171', '--dangerbg': 'rgba(248,113,113,.13)', '--dangerhi': '#fca5a5',
        '--ink': '#0c1030',
        '--pri1': '#8b95f9', '--pri2': '#5b66d6', '--priedge': 'rgba(220,225,255,.5)',
        '--coin1': '#b6c0ff', '--coin2': '#818cf8', '--coin3': '#525bd1',
        '--coinedge': 'rgba(215,222,255,.65)', '--coinring': 'rgba(12,16,48,.55)',
        '--coinshadow': 'rgba(24,28,90,.6)',
        '--inbg': '#1c2445', '--inbgfocus': '#232d57',
        '--switchknob': '#c8cef2', '--switchfill': '#8b95f9',
        '--scrail': 'rgba(200,210,255,.12)', '--scrthumb': 'rgba(200,210,255,.24)',
        '--shadow': '0 12px 32px rgba(0,0,0,.5)'
      }
    }
  };

  var currentId = DEFAULT;
  var currentOverrides = {};   // the shop's own colors ON TOP of the base theme

  // ---------- what a color value is allowed to be (same rule as test/themes.test.ts) ----------
  var CSS_COLOR = /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|transparent|currentColor)$/;
  var SHADOW_COLOR = /(rgba?\(|#[0-9a-fA-F]{3,8})/;   // --shadow is a whole shadow string, not a color

  function isColor(name, v) {
    if (typeof v !== 'string' || !v.trim()) return false;
    return /shadow$/.test(name) ? SHADOW_COLOR.test(v) : CSS_COLOR.test(v);
  }

  function paint(tokens) {
    if (typeof document === 'undefined' || !document.documentElement) return;
    var keys = Object.keys(tokens);
    for (var i = 0; i < keys.length; i++) {
      document.documentElement.style.setProperty(keys[i], tokens[keys[i]]);
    }
  }

  // every theme that enters the app — a preset, a template, a JSON import — must
  // pass this. The SAME rule test/themes.test.ts enforces at build time, now
  // enforced at runtime for colors that arrive from a shopkeeper's clipboard.
  function problems(theme) {
    var out = [];
    if (!theme || typeof theme !== 'object' || Array.isArray(theme)) return ['theme must be an object'];
    if (typeof theme.id !== 'string' || !/^[a-z0-9-]{2,24}$/.test(theme.id)) out.push('theme.id must be a short slug (a-z, 0-9, -)');
    if (typeof theme.nameKey !== 'string' || !theme.nameKey.trim()) out.push('theme.nameKey is required (a theme needs a name)');
    if (!Array.isArray(theme.preview) || theme.preview.length !== 3 ||
      !theme.preview.every(function (c) { return /^#[0-9a-fA-F]{6}$/.test(c); })) {
      out.push('theme.preview must be exactly 3 hex colors');
    }
    var toks = theme.tokens;
    if (!toks || typeof toks !== 'object' || Array.isArray(toks)) { out.push('theme.tokens must be an object'); return out; }
    var missing = BASE.filter(function (k) { return toks[k] === undefined; });
    if (missing.length) out.push('missing token(s): ' + missing.slice(0, 4).join(', '));
    var extra = Object.keys(toks).filter(function (k) { return BASE.indexOf(k) === -1; });
    if (extra.length) out.push('unknown token(s): ' + extra.slice(0, 4).join(', '));
    Object.keys(toks).forEach(function (k) {
      if (!isColor(k, toks[k])) out.push('token ' + k + ' is not a CSS color: ' + String(toks[k]).slice(0, 24));
    });
    return out;
  }

  function add(theme) {
    var p = problems(theme);
    if (p.length) throw new Error('theme refused: ' + p[0]);
    if (THEMES[theme.id]) throw new Error('theme already registered: ' + theme.id);
    THEMES[theme.id] = theme;
    return theme;
  }

  // Split a token bag into the values that can be painted and the ones that
  // cannot be read. ONE place decides what a usable override is, so the screen
  // (which names the bad ones) and the engine (which ignores them) never disagree.
  function checkTokens(tokens) {
    var good = {}, ignored = [];
    var raw = (tokens && typeof tokens === 'object' && !Array.isArray(tokens)) ? tokens : {};
    Object.keys(raw).forEach(function (k) {
      if (BASE.indexOf(k) === -1 || !isColor(k, raw[k])) { ignored.push(k); return; }
      good[k] = raw[k];
    });
    return { good: good, ignored: ignored };
  }

  function remember(id, overrides) {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORE_KEY, id);
      localStorage.setItem(TOKENS_KEY, JSON.stringify(overrides || {}));
    } catch (e) { /* private mode: the theme still applies for this session */ }
  }

  // What THIS browser last painted (the head script's copy, possibly from a build
  // that predates custom.theme). Read-only: the state stays the authority, and the
  // boot adopts a device-only choice instead of resetting the shop's look.
  function cachedTheme() {
    var id = null, toks = null;
    if (typeof localStorage !== 'undefined') {
      try { id = localStorage.getItem(STORE_KEY); toks = localStorage.getItem(TOKENS_KEY); } catch (e) {}
    }
    var overrides = {};
    if (toks) {
      try {
        var parsed = JSON.parse(toks);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) overrides = parsed;
      } catch (e) { overrides = {}; }
    }
    return { id: THEMES[id] ? id : null, tokens: overrides };
  }

  // Read back what the shop declared: base theme + its own colors.
  // An override that cannot be read is IGNORED and REPORTED — a phone must never
  // open into an unreadable screen because of one bad value.
  function applyTheme(theme) {
    var wanted = (theme && typeof theme === 'object' && !Array.isArray(theme)) ? theme : {};
    var id = THEMES[wanted.id] ? wanted.id : DEFAULT;
    paint(THEMES[id].tokens);            // the base first...
    currentId = id;

    var raw = (wanted.tokens && typeof wanted.tokens === 'object' && !Array.isArray(wanted.tokens)) ? wanted.tokens : {};
    var split = checkTokens(raw);
    paint(split.good);                    // ...then the shop's own colors
    currentOverrides = split.good;
    remember(id, split.good);
    return { id: id, overrides: Object.keys(split.good).length, ignored: split.ignored };
  }

  function set(id) {
    if (!THEMES[id]) return false;
    applyTheme({ id: id, tokens: {} });   // picking a preset drops the shop's tweaks (they can re-tweak)
    if (typeof document !== 'undefined' && typeof CustomEvent !== 'undefined') {
      document.dispatchEvent(new CustomEvent('dekkan:theme', { detail: { id: id } }));
    }
    return true;
  }

  function restore() {
    var saved = cachedTheme();
    applyTheme({ id: saved.id, tokens: saved.tokens });
    return currentId;
  }

  // ---------- the editor's live preview (no save until the shopkeeper says so) ----------
  function preview(tokens) {
    var good = checkTokens(tokens).good;
    paint(good);
    return Object.keys(good).length;
  }

  function revert() {
    applyTheme({ id: currentId, tokens: currentOverrides });
    return currentId;
  }

  // ---------- export / import: a theme is a file a shopkeeper can share ----------
  function exportTheme(theme) {
    var wanted = (theme && typeof theme === 'object' && !Array.isArray(theme)) ? theme : { id: currentId, tokens: currentOverrides };
    var id = THEMES[wanted.id] ? wanted.id : currentId;
    var tokens = {};
    BASE.forEach(function (k) { tokens[k] = THEMES[id].tokens[k]; });   // stand-alone: the WHOLE set
    var ov = (wanted.tokens && typeof wanted.tokens === 'object' && !Array.isArray(wanted.tokens)) ? wanted.tokens : {};
    Object.keys(ov).forEach(function (k) { if (BASE.indexOf(k) !== -1 && isColor(k, ov[k])) tokens[k] = ov[k]; });
    return JSON.stringify({ name: 'Dekkan ' + id, id: id, tokens: tokens }, null, 2);
  }

  // Untrusted text in, either a usable override set or the reasons it was refused.
  // NEVER applies anything by itself: the caller decides (the screen shows the reasons).
  function importTheme(text) {
    var raw;
    try { raw = JSON.parse(String(text)); } catch (e) { return { ok: false, problems: ['that is not valid JSON'] }; }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, problems: ['a theme must be a JSON object'] };
    if (!raw.id || !THEMES[String(raw.id)]) return { ok: false, problems: ['unknown base theme: ' + String(raw.id)] };
    if (!raw.tokens || typeof raw.tokens !== 'object' || Array.isArray(raw.tokens)) return { ok: false, problems: ['theme.tokens must be an object'] };
    var bad = [];
    Object.keys(raw.tokens).forEach(function (k) {
      if (BASE.indexOf(k) === -1) bad.push('unknown token ' + k);
      else if (!isColor(k, raw.tokens[k])) bad.push('token ' + k + ' is not a CSS color: ' + String(raw.tokens[k]).slice(0, 24));
    });
    if (bad.length) return { ok: false, problems: bad };
    return { ok: true, theme: { id: String(raw.id), tokens: Object.assign({}, raw.tokens) }, name: typeof raw.name === 'string' ? raw.name : '' };
  }


  var Themes = {
    DEFAULT: DEFAULT,
    BASE: BASE,
    baseTokens: function () { return BASE.slice(); },
    problems: problems,
    add: add,
    checkTokens: checkTokens,
    all: function () {
      return Object.keys(THEMES).map(function (id) { return THEMES[id]; });
    },
    get: function (id) { return THEMES[id] || null; },
    current: function () { return THEMES[currentId]; },
    currentId: function () { return currentId; },
    // the shop's OWN colors (never the base's) — what the editor loads
    overrides: function () { return Object.assign({}, currentOverrides); },
    isCustomized: function () { return Object.keys(currentOverrides).length > 0; },
    set: set,
    applyTheme: applyTheme,
    restore: restore,
    cachedTheme: cachedTheme,
    preview: preview,
    revert: revert,
    exportTheme: exportTheme,
    importTheme: importTheme
  };

  return { THEMES: THEMES, Themes: Themes, BASE: BASE };
});