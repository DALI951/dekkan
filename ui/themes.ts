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


  // ---------- the shop's PALETTE: three colours in, the whole shop out ----------
  // A shopkeeper does not think in 42 tokens. He thinks: my brand colour, the colour
  // of my money, the colour of my walls. The rest - the ladder of surfaces, the
  // hairlines, the glows, the status colours - is DERIVED here, deterministically, so
  // the same three colours always build the same shop.
  //
  // Readability is not a suggestion either. Whatever he picks, the body text, the
  // muted text, the dim text and the accent have to clear a real WCAG contrast floor
  // against HIS wall, and the label that lands on an accent button has to clear its
  // own floor against that accent. Only then does the palette come out; otherwise we
  // walk LIGHTNESS - never the hue he chose - until the floors are met.
  var SEEDS = ['brand', 'money', 'ground'];
  var SEED_TOKEN = { brand: '--acc', money: '--coin2', ground: '--bg' };
  var TEXT_FLOOR = 7, MUT_FLOOR = 4.5, DIM_FLOOR = 3, ACC_FLOOR = 3, INK_FLOOR = 4.5;

  function normHex(v) {
    var s = String(v == null ? '' : v).trim().toLowerCase();
    return /^#[0-9a-f]{6}$/.test(s) ? s : null;
  }

  function hexRgb(h) {
    var s = normHex(h) || '#000000';
    return [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
  }

  function byte(n) {
    var s = Math.max(0, Math.min(255, Math.round(n))).toString(16);
    return s.length === 1 ? '0' + s : s;
  }

  function rgbHex(r, g, b) { return '#' + byte(r) + byte(g) + byte(b); }

  // pct > 0 leans toward white, pct < 0 toward black: the building block of every
  // surface, hover shade and edge in the palette.
  function shade(hex, pct) {
    var c = hexRgb(hex), t = pct > 0 ? 255 : 0, k = Math.abs(pct);
    return rgbHex(c[0] + (t - c[0]) * k, c[1] + (t - c[1]) * k, c[2] + (t - c[2]) * k);
  }

  function mix(a, b, t) {
    var x = hexRgb(a), y = hexRgb(b);
    return rgbHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
  }

  function rgba(hex, a) {
    var c = hexRgb(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }

  function luminance(hex) {
    var c = hexRgb(hex), out = [];
    for (var i = 0; i < 3; i++) {
      var s = c[i] / 255;
      out.push(s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4));
    }
    return 0.2126 * out[0] + 0.7152 * out[1] + 0.0722 * out[2];
  }

  function contrast(a, b) {
    var x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }

  // Walk a colour's lightness away from `on` until it clears the floor. Hue is
  // untouched, so the shopkeeper still recognises the colour he picked. A mid-tone
  // `on` cannot be escaped in one direction (a green button cannot carry white text),
  // so both directions are walked and the better one wins.
  function walk(from, on, toward, floor) {
    var out = from;
    for (var i = 0; i < 300 && contrast(out, on) < floor; i++) {
      var next = shade(out, toward * 0.05);
      if (next === out) break;
      out = next;
    }
    return out;
  }

  function readable(on, hex, floor) {
    if (contrast(hex, on) >= floor) return hex;
    var toward = luminance(hex) >= luminance(on) ? 1 : -1;
    var a = walk(hex, on, toward, floor);
    var b = walk(hex, on, -toward, floor);
    var best = contrast(a, on) >= contrast(b, on) ? a : b;
    if (contrast(best, on) >= floor) return best;
    // The walk is geometric, and rounding in shade() stalls a few units short of the
    // end. When even that cannot reach the floor (a mid-tone wall has no 7:1 text at
    // all), take the honest best a screen can do: the pure extreme.
    return contrast('#ffffff', on) >= contrast('#000000', on) ? '#ffffff' : '#000000';
  }

  function inkOn(hex) {
    return luminance(hex) > 0.45 ? mix(hex, '#000000', 0.84) : mix(hex, '#ffffff', 0.86);
  }

  function palette(seeds) {
    var s = (seeds && typeof seeds === 'object' && !Array.isArray(seeds)) ? seeds : {};
    var origin = THEMES[DEFAULT].tokens;
    var brand = normHex(s.brand) || origin['--acc'];
    var money = normHex(s.money) || origin['--coin2'];
    var ground = normHex(s.ground) || origin['--bg'];
    var light = luminance(ground) > 0.42;
    var lift = light ? [0.3, 0.62, 0.78, 0.9] : [0.035, 0.06, 0.095, 0.15];
    var bg2 = mix(ground, '#ffffff', lift[0]);
    var panel = mix(ground, '#ffffff', lift[1]);
    var panel2 = mix(ground, '#ffffff', lift[2]);
    var panel3 = mix(ground, '#ffffff', lift[3]);
    var wash = mix(mix(ground, light ? '#000000' : '#ffffff', light ? 0.86 : 0.9), brand, 0.06);
    var txt = readable(ground, wash, TEXT_FLOOR);
    var mut = readable(ground, mix(txt, ground, 0.42), MUT_FLOOR);
    var dim = readable(ground, mix(txt, ground, 0.56), DIM_FLOOR);
    var acc = readable(ground, brand, ACC_FLOOR);
    var ink = readable(acc, inkOn(acc), INK_FLOOR);
    var ok = light ? '#1f8f5c' : '#2ea368';
    var danger = light ? '#c53a33' : '#d8453f';
    var pri1 = light ? shade(acc, -0.02) : shade(acc, 0.05);
    var pri2 = light ? shade(acc, -0.18) : shade(acc, -0.1);
    return {
      '--bg': ground, '--bg2': bg2,
      '--glowa': rgba(acc, 0.06), '--glowb': rgba(acc, 0.04),
      '--panel': panel, '--panel2': panel2, '--panel3': panel3,
      '--line': rgba(txt, 0.08), '--line2': rgba(txt, 0.15),
      '--txt': txt, '--mut': mut, '--dim': dim,
      '--acc': acc, '--acc2': light ? shade(acc, -0.1) : shade(acc, 0.1), '--accdark': shade(acc, -0.2),
      '--accbg': rgba(acc, light ? 0.12 : 0.13), '--accborder': rgba(acc, 0.4),
      '--accover': rgba(acc, light ? 0.16 : 0.19), '--accglow': rgba(acc, 0.3),
      '--ok': ok, '--okbg': rgba(ok, 0.14), '--okhi': shade(ok, 0.14),
      '--danger': danger, '--dangerbg': rgba(danger, 0.13), '--dangerhi': shade(danger, 0.12),
      '--ink': ink,
      '--pri1': pri1, '--pri2': pri2, '--priedge': rgba(shade(acc, light ? -0.35 : 0.35), 0.5),
      '--coin1': shade(money, light ? -0.06 : 0.12), '--coin2': money, '--coin3': shade(money, -0.2),
      '--coinedge': rgba(shade(money, light ? -0.3 : 0.45), 0.6),
      '--coinring': rgba(inkOn(money), 0.5), '--coinshadow': rgba(shade(money, -0.42), 0.55),
      '--inbg': mix(ground, '#ffffff', light ? 0.9 : 0.15),
      '--inbgfocus': mix(ground, '#ffffff', light ? 1 : 0.19),
      '--switchknob': mix(ground, '#ffffff', light ? 0.35 : 0.78), '--switchfill': pri1,
      '--scrail': rgba(txt, 0.12), '--scrthumb': rgba(txt, 0.22),
      '--shadow': '0 12px 32px rgba(0,0,0,' + (light ? '.13' : '.45') + ')'
    };
  }

  // The three colours a token set was built from: what the pickers must show, and
  // what a shop with no palette of its own inherits from its base theme.
  function seedsOf(id, tokens) {
    var th = THEMES[id] || THEMES[DEFAULT];
    var raw = (tokens && typeof tokens === 'object' && !Array.isArray(tokens)) ? tokens : {};
    var out = {};
    SEEDS.forEach(function (k) {
      out[k] = normHex(raw[SEED_TOKEN[k]]) || normHex(th.tokens[SEED_TOKEN[k]]);
    });
    return out;
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
    importTheme: importTheme,
    SEEDS: SEEDS,
    SEED_TOKEN: SEED_TOKEN,
    palette: palette,
    seedsOf: seedsOf,
    isHex6: function (v) { return !!normHex(v); },
    shade: shade,
    mix: mix,
    rgba: rgba,
    luminance: luminance,
    contrast: contrast,
    inkOn: inkOn,
    readable: readable
  };

  return { THEMES: THEMES, Themes: Themes, BASE: BASE, SEEDS: SEEDS, SEED_TOKEN: SEED_TOKEN, palette: palette };
});