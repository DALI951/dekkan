/* DEKKAN CORE — the SHOP's own users (wave 6).
 *
 * Dali, 2026-10-12: "make an actual shop system where a cashier get logged in he
 * see only the caisse until the manager come in and open ... it require a name
 * and password for user, no google sign in in this and its required ... the
 * account get created when the employee is created".
 *
 * NOT the cloud account (ui/auth.ts = Firebase + Google, for syncing). This is
 * the counter: who is standing at the till today.
 *
 *   - state.accounts: [{ id, name, role, employeeId, salt, hash, iters, createdAt }]
 *     created TOGETHER with the employee (see core/employees.ts);
 *   - the password is never stored — only a salted PBKDF2-SHA256 hash, done in
 *     WebCrypto (so it works in the browser AND in node tests, no deps);
 *   - roles: 'manager' (the whole shop) and 'cashier' (the till, nothing else);
 *   - openShop() is "the manager comes in and opens": a manager's credentials
 *     only, a cashier's must never do it;
 *   - login() is the till's own door: name + password, no Google anywhere.
 *
 * Shop-floor honesty: this protects the counter from the wrong hands in the
 * shop (a curious cashier, a customer poking the tablet), not from someone who
 * walks off with the device and a soldering iron. The state file is the shop's.
 */
'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  if (typeof window !== 'undefined' && root.DEK && root.DEK.core) factory(root.DEK.core);
})(typeof self !== 'undefined' ? self : this, function (K) {
  const { uid } = K;

  const ROLES = ['manager', 'cashier'];
  const NAME_MIN = 2;
  const NAME_MAX = 24;
  const PASS_MIN = 4;
  const ITERS = 120000;        // PBKDF2-SHA256 rounds: a real cost on a phone, no freeze
  const SALT_BYTES = 16;
  const TABS_OF = { manager: null, cashier: ['sell'] };   // null = every tab the shop has

  function cryptoBox() {
    const c = (typeof crypto !== 'undefined' && crypto) ||
      (typeof globalThis !== 'undefined' && globalThis.crypto);
    if (!c || !c.subtle || !c.getRandomValues) {
      throw new Error('accounts: this browser cannot hash a password safely (needs HTTPS)');
    }
    return c;
  }

  const hex = (bytes) => Array.prototype.map.call(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

  function randHex(n) {
    const buf = new Uint8Array(n);
    cryptoBox().getRandomValues(buf);
    return hex(buf);
  }

  async function pbkdf2(pass, salt, iters) {
    const c = cryptoBox();
    const enc = new TextEncoder();
    const key = await c.subtle.importKey('raw', enc.encode(String(pass)), { name: 'PBKDF2' }, false, ['deriveBits']);
    const bits = await c.subtle.deriveBits(
      { name: 'PBKDF2', salt: enc.encode(String(salt)), iterations: Number(iters), hash: 'SHA-256' },
      key, 256);
    return hex(new Uint8Array(bits));
  }

  function cleanName(name) {
    const n = String(name == null ? '' : name).trim();
    if (n.length < NAME_MIN) throw new Error('accounts: name must be at least ' + NAME_MIN + ' characters');
    if (n.length > NAME_MAX) throw new Error('accounts: name must be ' + NAME_MAX + ' characters or fewer');
    return n;
  }

  function cleanPass(pass) {
    const p = String(pass == null ? '' : pass);
    if (p.trim().length < PASS_MIN) {
      throw new Error('accounts: password must be at least ' + PASS_MIN + ' characters (not only spaces)');
    }
    return p;
  }

  // ---------- hashing ----------
  // The ONLY way a password becomes something we can store. A fresh salt unless
  // one is handed in (pass the old salt + iters to re-hash the same password).
  async function hashPassword(pass, opts) {
    const p = cleanPass(pass);
    const salt = (opts && opts.salt) || randHex(SALT_BYTES);
    const iters = Math.max(1000, Number((opts && opts.iters) || ITERS));
    const hash = await pbkdf2(p, salt, iters);
    return { salt: String(salt), hash: hash, iters: iters };
  }

  function sameHash(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  async function verifyPassword(pass, acct) {
    if (!acct || !acct.salt || !acct.hash) return false;
    const h = await pbkdf2(String(pass == null ? '' : pass), acct.salt, Number(acct.iters || ITERS));
    return sameHash(h, acct.hash);
  }

  // ---------- reading the counter staff ----------
  // The API hands out the SHAPE of a person, never his hash: the screen has no
  // business knowing it, and a leaked UI object then leaks nothing.
  function accounts(state) {
    const list = state && Array.isArray(state.accounts) ? state.accounts : [];
    return list.map(function (a) {
      return {
        id: a.id, name: a.name, role: a.role,
        employeeId: a.employeeId || null, createdAt: a.createdAt || null
      };
    });
  }

  function hasAccounts(state) {
    return (state && Array.isArray(state.accounts) ? state.accounts.length : 0) > 0;
  }

  const raw = (state) => (state && Array.isArray(state.accounts) ? state.accounts : []);

  function findAccount(state, name) {
    const low = String(name == null ? '' : name).trim().toLowerCase();
    return raw(state).find((a) => String(a.name).toLowerCase() === low) || null;
  }

  const managers = (state) => accounts(state).filter((a) => a.role === 'manager');

  // ---------- who sees what ----------
  function tabsFor(role) {
    const only = TABS_OF[role];
    const all = Array.isArray(K.CUSTOM_TABS) ? K.CUSTOM_TABS : ['sell'];
    if (!only) return all.slice();
    return all.filter((t) => only.indexOf(t) !== -1);
  }

  const canSee = (role, tab) => tabsFor(role).indexOf(tab) !== -1;

  // ---------- a login block that came with a new hire ----------
  // Validated and BOUND to the employee here, so employees.addEmployee can stay
  // pure and synchronous: the hashing already happened (hashPassword).
  function accountFor(state, block, employeeId) {
    if (!block || typeof block !== 'object') {
      throw new Error('accounts: this employee needs a login (name + password)');
    }
    const name = cleanName(block.name);
    const role = String(block.role == null ? '' : block.role);
    if (ROLES.indexOf(role) === -1) throw new Error('accounts: unknown role ' + (role || '(none)'));
    if (!block.salt || !block.hash) throw new Error('accounts: the login needs a salt and a hash (hashPassword)');
    if (!(Number(block.iters) >= 1000)) throw new Error('accounts: the login needs an iteration count');
    if (findAccount(state, name)) throw new Error('accounts: the name ' + name + ' is already taken');
    return {
      id: uid(), name: name, role: role, employeeId: employeeId || null,
      salt: String(block.salt), hash: String(block.hash), iters: Number(block.iters),
      createdAt: new Date().toISOString()
    };
  }

  // ---------- the door ----------
  function sessionOf(acct) {
    return { accountId: acct.id, name: acct.name, role: acct.role, employeeId: acct.employeeId || null };
  }

  async function login(state, name, pass) {
    if (!hasAccounts(state)) return { ok: false, why: 'auth.noUsers' };
    const acct = findAccount(state, name);
    const bad = { ok: false, why: 'auth.badCredentials' };   // the shop never tells you WHICH was wrong
    if (!acct) return bad;
    if (!(await verifyPassword(pass, acct))) return bad;
    return { ok: true, session: sessionOf(acct) };
  }

  // "the manager comes in and opens the shop": managers only.
  async function openShop(state, name, pass) {
    if (!hasAccounts(state)) return { ok: false, why: 'auth.noUsers' };
    const acct = findAccount(state, name);
    if (!acct) return { ok: false, why: 'auth.badCredentials' };
    if (!(await verifyPassword(pass, acct))) return { ok: false, why: 'auth.badCredentials' };
    if (acct.role !== 'manager') return { ok: false, why: 'auth.notManager' };
    return { ok: true, session: sessionOf(acct) };
  }

  // ---------- roles: a manager decision, never a cashier one ----------
  function setRole(state, accountId, role, actor) {
    assertManager(actor);
    if (ROLES.indexOf(role) === -1) throw new Error('accounts: unknown role ' + (role || '(none)'));
    const list = raw(state);
    const i = list.findIndex((a) => a.id === accountId);
    if (i === -1) throw new Error('accounts: no such user');
    if (list[i].role === role) return state;
    if (role !== 'manager' && !list.some((a, j) => j !== i && a.role === 'manager')) {
      throw new Error('accounts: the shop must keep one manager');
    }
    const next = list.slice();
    next[i] = Object.assign({}, next[i], { role: role });
    return Object.assign({}, state, { accounts: next });
  }

  function assertManager(actor) {
    if (!actor || actor.role !== 'manager') throw new Error('accounts: only a manager can do that');
  }

  // an employee leaving takes his login with him — but the shop keeps a manager
  function dropAccount(state, employeeId) {
    const list = raw(state);
    const going = list.filter((a) => a.employeeId === employeeId);
    if (!going.length) return state;
    const staying = list.filter((a) => a.employeeId !== employeeId);
    const keepsManager = staying.some((a) => a.role === 'manager');
    /* only a shop that HAS a manager must keep one (a shop that somehow never had
       one can still let its last cashier go — nobody gets locked out either way) */
    if (list.some((a) => a.role === 'manager') && !keepsManager) {
      throw new Error('accounts: the shop must keep one manager (create another one first)');
    }
    return Object.assign({}, state, { accounts: staying });
  }

  K.ROLES = ROLES;
  K.PASS_MIN = PASS_MIN;
  K.NAME_MIN = NAME_MIN;
  K.hashPassword = hashPassword;
  K.verifyPassword = verifyPassword;
  K.accounts = accounts;
  K.hasAccounts = hasAccounts;
  K.findAccount = findAccount;
  K.managers = managers;
  K.accountFor = accountFor;
  K.sessionOf = sessionOf;
  K.login = login;
  K.openShop = openShop;
  K.setRole = setRole;
  K.dropAccount = dropAccount;
  K.canSee = canSee;
  K.tabsFor = tabsFor;
});
