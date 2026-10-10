# DEKKAN — PLAN TO PROCEED

**Spec:** `docs/dekkan-plan-ultimate.xlsx` — "Sales & Inventory Software — Complete Product Blueprint"
(14 sheets · 145 features · 230 data fields · 29 workflows · 66 business rules · 43 acceptance tests · 27 screens · 22 reports · 32 NFRs · 20 config decisions · 24-month roadmap).

**Rule from the workbook itself (Start_Here):** *Do not build the entire workbook at once.*
Filter to **P0/MVP**, one customer segment, one workflow. This file is that filter, applied to the
code as it exists at **v0.19.0** (2026-10-09). The workbook stays the spec — status columns in it
are updated as phases close.

---

## 0. Ground rules (from the workbook — apply to every release)

| Principle | Meaning here |
|---|---|
| Stock principle | On-hand comes from source-linked movements. Users never type over stock. |
| Money principle | One documented calculation + rounding policy; the server must not trust browser numbers. |
| Posting principle | Drafts touch nothing official; posted records are corrected by linked reversal, never silent delete. |
| Release gate | **No ship** if duplicate sales, overselling, totals mismatch, tenant leak, broken backup, or unrecoverable stock movement is possible. |
| Weekly OS | 5–10 h/week: ~1–2 h learning, 3–6 h building/testing, 1 h validation. Feature is done only with validation + tests + error states. |
| Customer contact | Talk to ≥1 real/prospective user every 2 weeks during validation/pilot/launch. Friends ≠ buyers. |

---

## 1. Where Dekkan stands on the roadmap

| Milebook | Workbook asks for | Dekkan status |
|---|---|---|
| M00 Validate | Interview 5–10 businesses, one persona + pain statement | **NOT DONE — biggest gap in the plan** |
| M01 Define MVP | Wireframes reviewed with 2 target users, P0 scope agreed | Implicit (built), never reviewed with real users |
| M02 Foundation | Repo, auth, roles, tenant isolation, error handling | **DONE differently**: per-account state blob = hard isolation; roles = PIN + cashier names, not RBAC |
| M03 Catalogue | Products, units, categories, SKU uniqueness, search | **PARTIAL**: products/categories/search exist; **no SKU field**, no supplier ref, no import |
| M04 Stock ledger | Opening stock, stock card, adjustments + reasons, negative guard | **MOSTLY DONE (2026-10-10)**: source-linked ledger (opening/sale/buy/refund/adjust/undo) + stock card screen live; adjustment **reason codes** still pending. Negative guard ✓ |
| M05 Sales posting | Draft cart, totals/discount, atomic post, receipt, idempotency | **DONE (client-side core)**: basket → checkout → receipt/facture, discounts clamped, refund path |
| M06 Payments & dashboard | Cash tender, daily reports, on-hand | **DONE**: till equation is derived (`start + Σentries`, cannot drift), day report, monthly review, by-cashier |
| M07 Hardening | Backups, restore drill, access tests, docs | **PARTIAL**: 222 unit + 65 sim + i18n + 114 E2E = strong tests; **no automated backup, no restore drill, no monitoring** |
| M08 Pilot | Real user repeats the workflow, concrete feedback | **NOT STARTED** |
| M09–M13 | Purchasing, production readiness, paid launch, growth | Future |

**Reading:** feature-wise Dekkan ≈ M05–M06 done in a local-first architecture; trust/ops-wise ≈ M07 half;
market-wise = M00 never happened. Phases below fix exactly that order.

---

## 2. Gap analysis — P0 (must close before any pilot)

Each item = workbook IDs · what it means for Dekkan · acceptance test to write RED-first.

1. **Stock ledger + stock card** — `STK-001/007`, `RPT-006` ✅ DONE (2026-10-10, commits `586e2cf` + `33d731e`)
   Every stock change becomes an immutable, source-linked movement (`opening|sale|buy|refund|adjust|undo`); on-hand is
   derived; stock card screen per product (opening → movements → running balance) opens from the Stock page.
   `stockIntegrity()` audits counter vs ledger, `reconcileStock()` rebuilds, legacy saves get an opening movement.
   Tests: `test/stock.test.ts` 9/9, `e2e/stock-card.spec.ts` PC+Phone, battery 239 unit + 65 sim + 334 i18n + 120 e2e.
   **Not yet:** adjustment *reason codes* (stockMove accepts an optional note; the UI doesn't prompt for one yet).
2. **Tax profiles** — `CFG-005`, `TAX-001..003`
   Configurable TVA code/rate/effective dates + one rounding policy; posted lines keep a rate
   snapshot. Tunisian defaults live in **config**, never hard-coded. → Test: posted receipt keeps its rate after settings change.
3. **Document numbering** — `DOC-001/002`, `CFG-006`
   Configurable prefixes/sequences per document type (facture, refund, buy); unique under
   concurrency (server-allocated when multi-device). Today: client # resets daily — good, extend it.
   → Test: `DOC-001` concurrent post = no duplicate number.
4. **SKU + unique SKU** — `CAT-001`
   Add SKU field (case/whitespace normalization), uniqueness per shop, search by SKU. → Test: `PROD-001`.
5. **Server stops blindly trusting the client** — `SAL-004`, `TEN-002`, `NFR-002`
   Today `PUT state` stores the blob verbatim. Minimum viable: API **validates integrity on push**
   (sum of entries ⇒ cash, stock ⇒ movements, totals reconcile, pin hash untouched, blob belongs to
   the token's user) and rejects with 409. Ideal (later): move posting itself to the API.
   → Test: forged state (cash ≠ entries, foreign user id) rejected, nothing written.
6. **RBAC light** — Permissions sheet
   Owner vs Cashier enforced **server-side** (PIN stays as the in-app action gate). Full 8-role
   matrix is P1 — only after real teams appear. → Test: `SEC-001`-style cross-user access denied.
7. **Supplier record** — Purchasing P0 (`PUR-001` area)
   `buyStock` gains a supplier (name + optional contact). Receipt-vs-bill split is P1.
   → Test: buy records supplier; history lists buys per supplier.
8. **Draft sale survives** — `SAL-001`
   Persist the in-progress basket (refresh/offline/tab-switch must not eat a half-built order).
   → Test: `SALE-002` draft touches no stock/cash/report.
9. **Refund/return discipline** — `RET-001/003`, `SAL-009/010`
   Refund already restocks from the *stored bill* (can't exceed what was sold) and is PIN-gated.
   Close the rest: mandatory reason, keep "no silent delete" + "reprint is read-only" as tests.
   → Tests: `RET-001`, `RET-003`, `SALE-007`.
10. **Backup + restore drill** — `REL-001`, `NFR-012`, `CFG-015`
    Automated encrypted MySQL dump (schedule + retention) and **one documented restore test**
    — "upload success ≠ recoverability". → Test: `DATA-001` restore reconciles sample totals.
11. **Walk-in customer rule, written down** — `CUST-001`
    Anonymous sale = client # of the day (already true). Freeze it as an explicit test so it
    never regresses into "one customer record per anonymous sale".

**Not P0 but already decided good:** AR/EN + RTL (workbook puts it P2 — we ship it at MVP),
local-first offline safety (matches `DEC-008` deferred), derived cash ledger (stronger than
`CASH-001` requires), test culture (satisfies `NFR-023`).

---

## 3. P1 — Launch pack (only after a pilot user asks)

- CSV/XLSX **import wizard** with mapping/preview/row errors (`IMP-001..003`) + product/customer export (`CFG-007`)
- Barcode scanner as keyboard input (`CFG-009`)
- Stock count session with variance approval (`STK-006`)
- Goods receipt **separate from** supplier bill (`PUR-001/002`) — stock moves on receipt only
- Split tender + payment allocation (`PAY-002`)
- Login throttling, password reset, session revocation (Auth P1 rows)
- Audit log screen (`SCR-026`)
- Reports toward the 22: sales-by-product, sales-by-category, inventory on-hand, gross margin
  (needs `DEC-003`), customer balance, till close — plus feature queue #10 best-sellers/dead-stock
- Restore drills on a cadence, error monitoring with request IDs (`NFR-014`)

## 4. P2 — Ignore until a paying customer asks

OCR/AI document import, payment gateway, multi-location/transfers, lots/serials/serials, price
lists, reservations, quotes/orders, public API, SaaS billing, offline POS, e-commerce sync.
*(The workbook says the same thing in its own words.)*

---

## 5. Decisions to close (Decisions_Glossary) — record the WHY, don't let code guess

| ID | Question | Proposed position |
|---|---|---|
| DEC-002 | Deployment | Shared host + PWA now; revisit after customers exist |
| DEC-003 | Costing method | **Weighted average** (matches small-shop reality) — confirm before any margin report ships |
| DEC-004 | Negative stock | Block (already enforced by the core) — ratified |
| DEC-005 | Tax rules | Configurable rates; **validate with an accountant before charging anyone** |
| DEC-006 | POS vs back-office | Already de-facto **POS + caisse** — ratify after interviews |
| DEC-008 | Offline | Keep local-first + debounced sync (already built) |
| DEC-010 | Pricing | Test **10–20 TND/month** at pilot |

---

## 6. Execution phases

| Phase | Name | Contents | Done when |
|---|---|---|---|
| **0** | **Validate (M00/M01)** | 5 interviews in Ben Arous shops, one written persona + pain statement; close DEC-006/DEC-010 | Notes of 5 real conversations exist; segment chosen |
| **1** | **P0 trust pack** | Gap list §2 items 1–11, RED-first: acceptance test from the workbook first, then code | All P0 tests green; release gate passes |
| **2** | **Ship polish** | Already-queued features: #8 share/send backup, #9 Z-report end-of-day print, #10 best-sellers + dead-stock; PWA install + APK | Live demo on a phone without dev tools |
| **3** | **Pilot (M08)** | One real shop, 30 days, real data (owner-permitted), biweekly feedback; every bug becomes a regression test | Pilot user repeats the daily workflow unprompted |
| **4** | **Launch pack** | P1 subset the pilot actually used (likely: import/export, barcode, stock count, reports) | Onboarding a new shop = <1 h with docs |
| **5** | **Paid launch (M11)** | Pricing test, support process (`CFG-020`), stretch target **3 paying customers** | Money moves; retention reviewed monthly |

School/exam load shrinks phases, never reorders them. One segment, one workflow — requests outside
this plan go to the backlog, not the code.

---

## 7. Acceptance tests — the workbook's 43 as our suite

P0 subset to implement RED-first inside Phase 1:
`SALE-001..008`, `STK-001..005`, `PROD-001/002`, `CUST-001`, `PAY-002`, `RPT-001`,
`SEC-001`, `DOC-001`, `DATA-001`, `IMP-001`.

Already covered or partially covered by the existing battery (222 unit + 65 sim + i18n 315 + 114 E2E):
`SALE-001` (checkout tests), `SALE-005` (totals), `SALE-007/008` (tickets store the facture; refunds
traceable), `STK-003` (oversell guards), `PAY-002` (partial payment), `CASH-001` (derived till).

**House rule (unchanged):** every feature ships with validation, error states, and its test —
a happy-path demo is not "done".
