// @ts-nocheck
// JS -> TS migration (first pass): this file is the dynamic DOM / service-worker /
// vm-harness layer (loose globals + event targets). Types get tightened incrementally.
/* DEKKAN fake Firebase — an in-memory stand-in for the compat SDK
 * (window.firebase) with exactly the surface js/auth.js uses. Tests set
 * `st.user` (signed-in identity) and `st.docs` (firestore docs) before the
 * app boots, then drive register/login/google/logout through it and assert
 * on the decisions auth.js makes.
 *
 * Usage: global.window.DEKKAN_FIREBASE = fakeFirebase(st);
 */
'use strict';

function fakeFirebase(st) {
  const state = st || {};
  const authListeners = [];
  if (state.user) state.user.uid = state.user.uid || 'u7';

  function currentAuthUser() {
    return state.user ? mapUser(state.user) : null;
  }
  function mapUser(u) {
    return Object.assign({}, u); // { uid, email, displayName }
  }
  function emitAuth() {
    const u = currentAuthUser();
    authListeners.forEach(cb => { try { cb(u); } catch (e) {} });
  }
  function rejectNetwork() {
    return Promise.reject(Object.assign(new Error('network'), { code: 'auth/network-request-failed' }));
  }

  const calls = { register: [], login: [], google: [], logout: [], set: [], update: [] };

  function auth() {
    return {
      currentUser: currentAuthUser(),
      onAuthStateChanged(cb) {
        authListeners.push(cb);
        setTimeout(() => cb(currentAuthUser()), 0); // async, like the real SDK
        return () => { const i = authListeners.indexOf(cb); if (i >= 0) authListeners.splice(i, 1); };
      },
      createUserWithEmailAndPassword(email, password) {
        calls.register.push({ email, password });
        if (state.failNetwork) return rejectNetwork();
        if (state.knownEmails && state.knownEmails.indexOf(email) !== -1)
          return Promise.reject(Object.assign(new Error('exists'), { code: 'auth/email-already-in-use' }));
        const u = { uid: 'u' + (Object.keys(state.docs || {}).length + 100), email, displayName: '' };
        state.user = u;
        state.knownEmails = state.knownEmails || [];
        state.knownEmails.push(email);
        u.updateProfile = function (p) {
          calls.update.push(p);
          if (p && p.displayName) state.user.displayName = p.displayName;
          return Promise.resolve();
        };
        emitAuth();
        return Promise.resolve({ user: u });
      },
      signInWithEmailAndPassword(email, password) {
        calls.login.push({ email, password });
        if (state.failNetwork) return rejectNetwork();
        if (!state.acceptLogin) return Promise.reject(Object.assign(new Error('bad'), { code: 'auth/invalid-credential' }));
        const u = { uid: 'u7', email, displayName: state.user && state.user.displayName ? state.user.displayName : 'Boss' };
        state.user = u;
        emitAuth();
        return Promise.resolve({ user: u });
      },
      signInWithPopup() {
        calls.google.push({});
        if (state.failNetwork) return rejectNetwork();
        if (state.googleBlocked) return Promise.reject(Object.assign(new Error('blocked'), { code: 'auth/popup-blocked' }));
        if (!state.allowGoogle) return Promise.reject(Object.assign(new Error('disabled'), { code: 'auth/operation-not-allowed' }));
        const u = { uid: 'ug1', email: state.googleEmail || 'g@shop.tn', displayName: state.googleName || 'Google Boss' };
        state.user = u;
        emitAuth();
        return Promise.resolve({ user: u });
      },
      signOut() {
        calls.logout.push({});
        state.user = null;
        emitAuth();
        return Promise.resolve();
      }
    };
  }

  auth.GoogleAuthProvider = function GoogleAuthProvider() { this.scopes = []; }; // static, like the real compat SDK

  function firestore() {
    const docs = state.docs || (state.docs = {});
    return {
      FieldValue: { serverTimestamp: () => ({ fakeTs: Date.now() }) },
      doc(path) {
        return {
          get() {
            if (state.failGet) return Promise.reject(Object.assign(new Error('unavailable'), { code: 'unavailable' }));
            const raw = docs[path];
            return Promise.resolve({ exists: !!raw, data: () => ({ data: raw }) });
          },
          set(obj) { calls.set.push({ path, obj }); docs[path] = obj.data; return state.failSet ? Promise.reject(Object.assign(new Error('unavailable'), { code: 'unavailable' })) : Promise.resolve(); },
          update(obj) { calls.update.push({ path, obj }); Object.assign(docs[path] || (docs[path] = {}), obj); return Promise.resolve(); },
          delete() { delete docs[path]; return Promise.resolve(); }
        };
      }
    };
  }

  return { auth, firestore, _calls: calls, _state: state };
}

module.exports = { fakeFirebase };