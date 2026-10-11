# Restore drill — "upload success ≠ recoverability"

**Item:** P0-10 · **IDs:** `REL-001`, `NFR-012`, `CFG-015`, test `DATA-001`
**Last run:** 2026-10-11

A backup is only worth anything if the shop comes **back**. A file that uploads,
syncs, or parses is *not* proof — it is a claim. This drill turns the claim into
evidence: export a real shop, restore it, and reconcile every number.

## The rule

> A backup that has not been *restored and reconciled* does not count as a backup.

The app enforces the "recoverable" half in code: `core/core.ts` `restoreState()`
runs the **same integrity gate the server runs on push** (`stateProblems`) and
**throws** if the state does not reconcile. So a corrupt-but-parseable file can
never silently replace the live shop.

## The drill (manual, on a real device)

1. **Export.** Settings → Export backup. A file `dekkan-backup-YYYY-MM-DD.json`
   downloads (this is exactly `JSON.stringify(state, null, 2)`).
2. **Note the numbers** the shopkeeper sees right now:
   - the till (`cash = startCash + Σ entries`)
   - tonight's report total
   - each product's on-hand (Stock page)
   - the open debts
3. **Restore.** Settings → Import backup → pick the file → confirm → owner PIN.
4. **Reconcile.** Every number from step 2 must be **identical**. The stock card
   of any product must still show source-linked movements.
5. **Prove the gate.** Hand-edit a copy of the file (change one sale `amount`
   without the bill, or duplicate an entry id) and import it. It must be
   **refused** with a "bad backup" toast and the live shop must be **untouched**.

## The automated drill

`test/drill.test.ts` (`DATA-001`) does steps 1–5 on a real multi-day shop:
export → parse → `restoreState` → reconcile till / day report / month / stock /
customers / debts, then proves a tampered file (that still parses) is refused.

Run: `npm test` (part of `npm run check`).

## Not yet (server side, needs the host)

PLAN P0-10 also asks for an **automated encrypted MySQL dump** (schedule +
retention) for the own-server API (`api/*.php`). That lives on the host and is
**not** implemented here — the app is local-first + Firebase today. Tracked as
open in `PLAN.md`.
