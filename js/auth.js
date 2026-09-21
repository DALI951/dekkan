/* DEKKAN auth — the account layer.
 * Talks to the dekkan API (api/auth.php + api/state.php on the same origin)
 * and keeps the session in localStorage. The UI shell (js/app.js) decides
 * WHEN to show the login gate; this file only answers HOW.
 *
 * Errors throw new Error(msg) with .code = an i18n key (auth.err.*) so the
 * shell can translate them — the server itself is language-free.
 */
'use strict';
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DEK = Object.assign(root.DEK || {}, factory());
})(typeof self !== 'undefined' ? self : this, function () {

  var API = 'api/';
  var TOKEN_KEY = 'dekkan.token';
  var USER_KEY = 'dekkan.user';

  var token = null;
  var user = null; // { id, email, shopName }

  function ls() {
    return (typeof localStorage !== 'undefined') ? localStorage : null;
  }
  function read(key) {
    var s = ls();
    try { return s ? s.getItem(key) : null; } catch (e) { return null; }
  }
  function write(key, val) {
    var s = ls();
    try { if (s) s.setItem(key, val); } catch (e) { /* private mode */ }
  }
  function erase(key) {
    var s = ls();
    try { if (s) s.removeItem(key); } catch (e) { /* ignore */ }
  }

  function hasFetch() { return typeof fetch === 'function'; }

  // ---------- session ----------
  function setCredentials(rawToken, rawUser) {
    token = rawToken;
    user = rawUser || null;
    if (token) write(TOKEN_KEY, token); else erase(TOKEN_KEY);
    if (user) write(USER_KEY, JSON.stringify(user)); else erase(USER_KEY);
  }
  function clearCredentials() {
    token = null;
    user = null;
    erase(TOKEN_KEY);
    erase(USER_KEY);
  }
  function init() {
    var t = read(TOKEN_KEY);
    if (t) {
      token = t;
      try { user = JSON.parse(read(USER_KEY) || 'null'); } catch (e) { user = null; }
    } else {
      token = null; user = null;
    }
    return { loggedIn: !!token };
  }
  function isLoggedIn() { return !!token; }

  // ---------- API calls ----------
  function post(endpoint, body) {
    // body: plain object for auth.php, raw string for state.php
    var opts = {
      method: body && body.raw ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body && body.raw ? body.raw : JSON.stringify(body)
    };
    if (token) opts.headers.Authorization = 'Bearer ' + token;
    return fetch(endpoint, opts).then(function (res) {
      return res.json().then(function (data) {
        return { res: res, data: data };
      }, function () {
        return { res: res, data: null };
      });
    });
  }

  function fail(code) {
    var e = new Error(code);
    e.code = code;
    return e;
  }

  function validateRegister(email, password, shopName) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw fail('auth.err.invalidEmail');
    if (!password || password.length < 6) throw fail('auth.err.shortPass');
    if (!shopName || shopName.trim().length < 2) throw fail('auth.err.shortName');
  }

  // maps server codes to user-facing keys
  var CODE_MAP = {
    invalid_email: 'auth.err.invalidEmail',
    short_pass: 'auth.err.shortPass',
    short_name: 'auth.err.shortName',
    email_taken: 'auth.err.emailTaken',
    bad_credentials: 'auth.err.badCredentials',
    invalid_token: 'auth.err.badCredentials'
  };

  function runAuth(action, payload) {
    if (!hasFetch()) return Promise.reject(fail('auth.err.offline'));
    return post(API + 'auth.php?action=' + encodeURIComponent(action), payload)
      .then(function (r) {
        if (r.res.ok && r.data && r.data.ok) return r.data;
        var code = CODE_MAP[(r.data && r.data.error) || 'generic'] || 'auth.err.generic';
        throw fail(code);
      });
  }

  // ---------- public API ----------
  function register(email, password, shopName) {
    email = String(email || '').trim().toLowerCase();
    shopName = String(shopName || '').trim();
    validateRegister(email, password, shopName);
    return runAuth('register', { email: email, password: password, shopName: shopName })
      .then(function (data) {
        setCredentials(data.token, data.user);
        return data.user;
      });
  }

  function login(email, password) {
    email = String(email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return Promise.reject(fail('auth.err.invalidEmail'));
    return runAuth('login', { email: email, password: password })
      .then(function (data) {
        setCredentials(data.token, data.user);
        return data.user;
      });
  }

  function logout() {
    var was = token;
    clearCredentials();
    if (was && hasFetch()) {
      // best effort — the server row dies even if we are offline
      // the (already cleared) raw token rides in the header AND the body
      return fetch(API + 'auth.php?action=logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + was },
        body: JSON.stringify({ token: was })
      }).catch(function () { return null; });
    }
    return Promise.resolve(null);
  }

  // GET api/state.php — the owner's saved shop (one JSON blob) or null
  function fetchState() {
    if (!token || !hasFetch()) return Promise.resolve(null);
    var opts = { headers: { Authorization: 'Bearer ' + token } };
    return fetch(API + 'state.php', opts).then(function (res) {
      if (res.status === 404) return null;
      if (res.status === 401) { clearCredentials(); return null; }
      if (!res.ok) return null;
      return res.json().then(function (data) { return data; }, function () { return null; });
    }).catch(function () { return null; }); // offline — keep the local copy
  }

  // PUT api/state.php — store the whole state blob verbatim
  function pushState(state) {
    if (!token || !hasFetch()) return Promise.resolve(false);
    return post(API + 'state.php', { raw: JSON.stringify(state) })
      .then(function (r) {
        if (r.res.status === 401) { clearCredentials(); return false; }
        return !!(r.res.ok && r.data && r.data.ok);
      })
      .catch(function () { return false; });
  }

  return {
    Auth: {
      init: init,
      isLoggedIn: isLoggedIn,
      setCredentials: setCredentials,
      clearCredentials: clearCredentials,
      getUser: function () { return user; },
      register: register,
      login: login,
      logout: logout,
      fetchState: fetchState,
      pushState: pushState
    }
  };
});