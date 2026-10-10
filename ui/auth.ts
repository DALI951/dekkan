// @ts-nocheck
// JS -> TS migration (first pass): this file is the dynamic DOM / service-worker /
// vm-harness layer (loose globals + event targets). Types get tightened incrementally.
/* DEKKAN auth — the account layer, on FIREBASE (Authentication + Firestore).
 * The UI shell (ui/app.js) decides WHEN to show the login wall; this file
 * only answers HOW: sign in/up with email+password or Google, sessions, and
 * the cloud state blob (one JSON string per owner, stored in Firestore at
 * `shops/{uid}`).
 *
 * Transport injection: index.html loads the Firebase compat SDK
 * (`window.firebase`); unit/UI tests inject `window.DEKKAN_FIREBASE` (a fake
 * with the same shape, see test/fake-firebase.js). If neither exists the
 * layer behaves like a device with no account: honest "offline" errors.
 *
 * Errors throw new Error(msg) with .code = an i18n key (auth.err.*) so the
 * shell can translate them — the transporter is language-free.
 */
'use strict';
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DEK = Object.assign(root.DEK || {}, factory());
})(typeof self !== 'undefined' ? self : this, function () {

  var FB = (typeof window !== 'undefined' && (window.DEKKAN_FIREBASE || window.firebase)) || null;

  var user = null;      // { id, email, shopName }
  var syncErr = null;   // why the last push/pull failed: 'offline' | 'server'
  var readyPromise = null, readyResolve = null;

  // the shell's boot waits for the FIRST resolved auth state (the SDK restores
  // a saved session a few ms after load — never show the wall over a live one)
  function ready() {
    if (!readyPromise) readyPromise = new Promise(function (res) { readyResolve = res; });
    return readyPromise;
  }

  function offline() {
    try {
      if (typeof navigator === 'undefined' || !navigator) return true;
      return navigator.onLine !== true;
    } catch (e) { return true; }
  }
  function fail(code) { var e = new Error(code); e.code = code; return e; }

  // firebase error codes -> friendly keys (the transporter is language-free).
  // `notAllowedKey` lets the Google flow say "google" when its provider is off
  // while email/password keeps the generic server key.
  function mapErr(e, notAllowedKey) {
    var c = String((e && e.code) || '');
    if (c === 'auth/invalid-email') return 'auth.err.invalidEmail';
    if (c === 'auth/weak-password') return 'auth.err.shortPass';
    if (c === 'auth/email-already-in-use') return 'auth.err.emailTaken';
    if (c === 'auth/user-not-found' || c === 'auth/wrong-password' || c === 'auth/invalid-credential' ||
        c === 'auth/invalid-login-credentials' || c === 'auth/user-disabled' || c === 'auth/too-many-requests') return 'auth.err.badCredentials';
    if (c === 'auth/network-request-failed' || c === 'auth/timeout' || c === 'unavailable' || c === 'deadline-exceeded') return 'auth.err.offline';
    if (c === 'auth/operation-not-allowed') return notAllowedKey || 'auth.err.server';
    if (c.indexOf('auth/popup') === 0) return 'auth.err.google';
    if (!c && offline()) return 'auth.err.offline';
    return 'auth.err.server';
  }

  function mapUser(fu) {
    if (!fu) return null;
    return {
      id: fu.uid,
      email: fu.email || '',
      shopName: String(fu.displayName || '').trim() || String(fu.email || '').split('@')[0]
    };
  }
  function setUser(fu) { user = mapUser(fu); }
  function clearUser() { user = null; }
  function currentFireUser() {
    if (user) return user;
    try {
      var cur = FB && FB.auth && FB.auth() && FB.auth().currentUser;
      return cur ? mapUser(cur) : null;
    } catch (e) { return null; }
  }

  // ---------- session ----------
  function init() {
    ready(); // the promise exists even when there is no SDK — see below
    if (!FB) {
      user = null;
      if (readyResolve) readyResolve();   // honest: no account layer, signed out
      return { loggedIn: false };
    }
    try {
      if (FB.initializeApp && typeof window !== 'undefined' && window.DEKKAN_FIREBASE_CONFIG &&
          !(FB.apps && FB.apps.length)) FB.initializeApp(window.DEKKAN_FIREBASE_CONFIG);
      FB.auth().onAuthStateChanged(function (fu) {
        if (fu) setUser(fu); else clearUser();
        if (readyResolve) readyResolve();
      });
    } catch (e) {
      if (readyResolve) readyResolve();
    }
    return { loggedIn: !!user };
  }
  function isLoggedIn() { return !!user; }
  function isExpired() { return false; }   // Firebase sessions never "expire" mid-use
  function syncError() { return syncErr; }
  function getUser() { return user; }

  // ---------- auth operations ----------
  function validateRegister(email, password, shopName) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw fail('auth.err.invalidEmail');
    if (!password || password.length < 6) throw fail('auth.err.shortPass');
    if (!shopName || shopName.trim().length < 2) throw fail('auth.err.shortName');
  }

  function register(email, password, shopName) {
    email = String(email || '').trim().toLowerCase();
    shopName = String(shopName || '').trim();
    try { validateRegister(email, password, shopName); } catch (e) { return Promise.reject(e); }
    if (!FB) return Promise.reject(fail(offline() ? 'auth.err.offline' : 'auth.err.server'));
    return FB.auth().createUserWithEmailAndPassword(email, password).then(function (cred) {
      var fu = cred.user;
      return fu.updateProfile({ displayName: shopName }).then(function () {
        setUser(fu);
        return user;
      }, function () {        // profile name is cosmetic — a signed-up user is a signed-up user
        setUser(fu);
        return user;
      });
    }).catch(function (e) { throw fail(mapErr(e)); });
  }

  function login(email, password) {
    email = String(email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return Promise.reject(fail('auth.err.invalidEmail'));
    if (!FB) return Promise.reject(fail(offline() ? 'auth.err.offline' : 'auth.err.server'));
    return FB.auth().signInWithEmailAndPassword(email, password).then(function (cred) {
      setUser(cred.user);
      return user;
    }).catch(function (e) { throw fail(mapErr(e)); });
  }

  // Sign in with Google: the compat SDK opens the Google popup itself.
  function loginWithGoogle() {
    if (!FB) return Promise.reject(fail('auth.err.google'));
    var Provider = FB.auth.GoogleAuthProvider;
    if (!Provider) return Promise.reject(fail('auth.err.google'));
    return FB.auth().signInWithPopup(new Provider()).then(function (cred) {
      setUser(cred.user);
      return user;
    }).catch(function (e) { throw fail(mapErr(e, 'auth.err.google')); });
  }

  function logout() {
    clearUser();
    if (FB) { try { FB.auth().signOut().catch(function () {}); } catch (e) {} }
    return Promise.resolve(null);
  }

  // ---------- the cloud state blob ----------
  function docRef(uid) {
    var db = FB.firestore();
    return db.doc('shops/' + uid);
  }

  // GET the owner's saved shop (one JSON blob) or null
  function fetchState() {
    if (!FB) { syncErr = offline() ? 'offline' : null; return Promise.resolve(null); }
    var u = currentFireUser();
    if (!u) { syncErr = null; return Promise.resolve(null); }
    try {
      return docRef(u.id).get().then(function (snap) {
        if (!snap.exists) { syncErr = null; return null; }   // nothing saved up yet
        var raw = snap.data() && snap.data().data;
        syncErr = null;
        try { return JSON.parse(raw); } catch (e) { syncErr = 'server'; return null; }
      }).catch(function () { syncErr = offline() ? 'offline' : 'server'; return null; });
    } catch (e) { syncErr = 'server'; return Promise.resolve(null); }
  }

  // store the whole state blob verbatim
  function pushState(state) {
    if (!FB) { syncErr = offline() ? 'offline' : null; return Promise.resolve(false); }
    var u = currentFireUser();
    if (!u) { syncErr = null; return Promise.resolve(false); }
    // SAL-004/TEN-002 (server-stops-trusting-the-client): the LAST gate before
    // upload — a blob that fails its own integrity checks never leaves the
    // device (and the own-server API would reject it with 409 anyway).
    try {
      var D = (typeof DEK !== 'undefined' && DEK && DEK.core) ? DEK.core : null;
      var problems = (D && D.stateProblems) ? D.stateProblems(state) : [];
      if (problems.length) { syncErr = 'server'; return Promise.resolve(false); }
    } catch (e) { syncErr = 'server'; return Promise.resolve(false); }
    try {
      var db = FB.firestore();
      var ts = (db.FieldValue && db.FieldValue.serverTimestamp)
        ? db.FieldValue.serverTimestamp() : Date.now();
      return docRef(u.id).set({ data: JSON.stringify(state), updatedAt: ts })
        .then(function () { syncErr = null; return true; })
        .catch(function () { syncErr = offline() ? 'offline' : 'server'; return false; });
    } catch (e) { syncErr = 'server'; return Promise.resolve(false); }
  }

  return {
    Auth: {
      init: init,
      ready: ready,
      isLoggedIn: isLoggedIn,
      isExpired: isExpired,
      syncError: syncError,
      getUser: getUser,
      register: register,
      login: login,
      loginWithGoogle: loginWithGoogle,
      logout: logout,
      fetchState: fetchState,
      pushState: pushState
    }
  };
});