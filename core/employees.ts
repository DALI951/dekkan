/* DEKKAN CORE — employees (deps: uid, todayStr, money).
   The team lives on state.employees: [] of {id, name, type, salary, phone,
   note, hiredAt, active, firedAt?}. Monthly payroll is lexical on the same
   YYYY-MM-DD stamps the rest of the app uses (todayStr()). */
'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  if (typeof window !== 'undefined' && root.DEK && root.DEK.core) factory(root.DEK.core);
})(typeof self !== 'undefined' ? self : this, function (K) {
  const { uid, todayStr, money } = K;

  const num = v => typeof v === 'number' && isFinite(v);

  // a state with one more team member AND his login (wave 6: hiring and giving
  // the login are ONE action — an employee without one could never open the till)
  const book = (state, member, account) => Object.assign({}, state, {
    employees: (state.employees || []).concat(member),
    accounts: (state.accounts || []).concat(account)
  });

  function addEmployee(state, opts) {
    opts = opts || {};
    const name = String(opts.name == null ? '' : opts.name).trim();
    const type = String(opts.type == null ? '' : opts.type).trim();
    if (!name) throw new Error('employees: name required');
    if (!type) throw new Error('employees: type required');
    const salary = opts.salary == null ? 0 : opts.salary;
    if (!num(salary) || salary < 0) throw new Error('employees: salary must be a number >= 0');
    const member = {
      id: uid(), name: name, type: type, salary: money(salary),
      phone: String(opts.phone == null ? '' : opts.phone),
      note: String(opts.note == null ? '' : opts.note),
      hiredAt: todayStr(), active: true
    };
    /* the login is REQUIRED (Dali): name + role + the salted hash the screen
       already made with K.hashPassword. Bind it to the employee we just made. */
    const account = K.accountFor(state, opts.account, member.id);
    return book(state, member, account);
  }

  function updateEmployee(state, id, patch) {
    patch = patch || {};
    const i = (state.employees || []).findIndex(e => e.id === id);
    if (i === -1) throw new Error('employees: not found');
    const next = Object.assign({}, state.employees[i]);
    if (patch.name !== undefined) {
      const name = String(patch.name).trim();
      if (!name) throw new Error('employees: name required');
      next.name = name;
    }
    if (patch.type !== undefined) {
      const type = String(patch.type).trim();
      if (!type) throw new Error('employees: type required');
      next.type = type;
    }
    if (patch.salary !== undefined) {
      if (!num(patch.salary) || patch.salary < 0) throw new Error('employees: salary must be a number >= 0');
      next.salary = money(patch.salary);
    }
    if (patch.phone !== undefined) next.phone = String(patch.phone);
    if (patch.note !== undefined) next.note = String(patch.note);
    const emps = state.employees.slice();
    emps[i] = next;
    return Object.assign({}, state, { employees: emps });
  }

  function fireEmployee(state, id) {
    const i = (state.employees || []).findIndex(e => e.id === id);
    if (i === -1) throw new Error('employees: not found');
    /* his login leaves with him — and dropAccount refuses if he was the last
       manager, so nobody ever locks the shop out of itself */
    const next = K.dropAccount(state, id);
    const emps = next.employees.slice();
    emps[i] = Object.assign({}, emps[i], { active: false, firedAt: todayStr() });
    return Object.assign({}, next, { employees: emps });
  }

  // The payroll of one month: full salary for everyone hired by its end who is
  // still active OR was fired AT or AFTER its start (a whole month is owed even
  // if the last day was unworked — no prorating). YYYY-MM-DD strings compare
  // lexically, so '2026-02-31' is a safe stand-in for "end of any month".
  function salariesFor(state, ym) {
    if (!/^\d{4}-\d{2}$/.test(String(ym || ''))) return 0;
    const start = ym + '-01';
    const end = ym + '-31';
    let total = 0;
    ((state && state.employees) || []).forEach(function (e) {
      if (!e || !(e.salary >= 0)) return;
      if (e.hiredAt > end) return;               // joins after the month
      if (e.active === false && e.firedAt < start) return; // gone before it began
      total += e.salary;
    });
    return money(total);
  }

  K.addEmployee = addEmployee;
  K.updateEmployee = updateEmployee;
  K.fireEmployee = fireEmployee;
  K.salariesFor = salariesFor;
});