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

  var STORE_KEY = 'dekkan.theme';
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

  function apply(id) {
    var t = THEMES[id];
    if (!t) return false;
    currentId = id;
    if (typeof document !== 'undefined' && document.documentElement) {
      var keys = Object.keys(t.tokens);
      for (var i = 0; i < keys.length; i++) {
        document.documentElement.style.setProperty(keys[i], t.tokens[keys[i]]);
      }
    }
    return true;
  }

  function persist(id) {
    if (typeof localStorage !== 'undefined') {
      try { localStorage.setItem(STORE_KEY, id); } catch (e) { /* private mode */ }
    }
  }

  var Themes = {
    DEFAULT: DEFAULT,
    baseTokens: function () { return BASE.slice(); },
    all: function () {
      return Object.keys(THEMES).map(function (id) { return THEMES[id]; });
    },
    get: function (id) { return THEMES[id] || null; },
    current: function () { return THEMES[currentId]; },
    set: function (id) {
      if (!THEMES[id]) return false;
      apply(id);
      persist(id);
      if (typeof document !== 'undefined' && typeof CustomEvent !== 'undefined') {
        document.dispatchEvent(new CustomEvent('dekkan:theme', { detail: { id: id } }));
      }
      return true;
    },
    restore: function () {
      var saved = null;
      if (typeof localStorage !== 'undefined') {
        try { saved = localStorage.getItem(STORE_KEY); } catch (e) {}
      }
      apply(THEMES[saved] ? saved : DEFAULT);
      return currentId;
    }
  };

  return { THEMES: THEMES, Themes: Themes, BASE: BASE };
});