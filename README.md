# DEKKAN — what is NOT built yet

Companion to [`PLAN.md`](PLAN.md) (the execution plan) and `docs/dekkan-plan-ultimate.xlsx` (the full
product blueprint: 145 features · 230 data fields · 29 workflows · 66 business rules · 43 acceptance
tests · 27 screens · 22 reports · 32 NFRs · 24-month roadmap).

This file lists everything from the workbook that is **not already implemented** in Dekkan v0.19.0.
Markers: `[missing]` = not built · `[partial]` = exists but does not meet the spec.

**Totals: 145 features → 80 missing · 39 partial · 26 done as specified.**

---

## A. Milestones (roadmap M00–M13)

- **M00 — Validate with real users** `[missing]` → 5–10 business interviews, one persona, pain statement. **Never done. The actual next step.**
- **M01 — Define MVP + wireframes reviewed by 2 target users** `[missing]` → built without ever showing a target user first.
- **M02 — Foundation** `[partial]` → auth done, but roles + server-side enforcement missing (tenant isolation exists only because each shop = its own account blob).
- **M03 — Catalogue** `[partial]` → no SKU, no units, no import.
- **M04 — Stock ledger** `[partial]` → the weak one: stock is a number you can overwrite; no movements ledger, no stock card.
- **M05 — Sales posting** `[partial]` → works, but all money math happens in the browser (server accepts whatever is pushed).
- **M06 — Payments/dashboard** `[partial]` → cash + partial payment + day report done; no split tender, no payment methods.
- **M07 — Hardening** `[partial]` → tests are strong; no automated backup, no restore drill, no monitoring, no ops docs.
- **M08 — Controlled pilot (one real shop, 30 days)** `[missing]`
- **M09 — Purchases & returns** `[missing]`
- **M10 — Production readiness** `[missing]`
- **M11 — Paid launch, 3 paying customers stretch** `[missing]`
- **M12 — Differentiate (validated niche feature)** `[missing]`
- **M13 — Scale / specialize / pivot review** `[missing]`

---

## B. Features by module (missing first, then partial)

### Foundation & settings — 5 missing, 5 partial
- `[missing]` Setup wizard · Tax profiles · Sequence concurrency · Business locations · Settings change log
- `[partial]` Business profile (name only — no address/phone/logo/footer) · Base currency (TND shown, not configurable) · Locale config (no date/decimal/thousand separator, no timezone) · Document numbering (daily client # only, no configurable prefixes) · Arabic/French readiness (Arabic + English done, French missing)

### Authentication & users — 6 missing
- `[missing]` Password reset · Invite user · Deactivate user · Session timeout/revocation · Login throttling · User activity history
- `[partial]` RBAC (PIN lock exists, but no server-enforced roles)

### Product catalogue — 12 missing, 3 partial
- `[missing]` Unique SKU · Barcode/alternate codes · Units of measure · Unit conversions · Variants · Bundles/kits · Supplier SKU & ref · Batch/lot/expiry · Serial tracking · Product import (CSV) · Bulk edit · Product image
- `[partial]` Service/non-stock item · Product export (JSON backup only, no CSV) · Archive product (delete exists; spec wants archive-with-history)

### Inventory & costing — 9 missing, 8 partial
- `[missing]` Available quantity · Adjustment reason list · Stock card screen · Stock count · Cycle count · Multi-location transfer · In-transit stock · Reservations · Expiry alerts
- `[partial]` Opening stock (just a number at create) · Immutable stock ledger · On-hand (directly editable = violates the spec) · Stock adjustment (no reason codes/approval) · Inventory valuation · Costing policy (buy-price basis, undocumented) · Reconciliation · Backdated entries guard

### Sales & checkout — 8 missing, 5 partial
- `[missing]` Price lists · Quotes/proforma · Sales orders · Multiple tender methods · Split tender · Exchange · Park/resume cart · Cash rounding
- `[partial]` Draft sale (basket dies on refresh) · Fast checkout (no keyboard/scanner-first flow) · Void/reversal (refund exists, no reason+approval) · Customer return · Customer notes

### Purchasing & suppliers — 10 missing
- `[missing]` Supplier record · Purchase order · Purchase approval · Goods receiving · Partial receiving · Supplier bill · Supplier return · Supplier payment/allocation · Landed costs · Supplier import
- `[partial]` Purchase price history only

### Customers & balances — 3 missing, 4 partial
- `[missing]` Customer import/export · Customer merge · Credit limit
- `[partial]` Customer record (name only) · Purchase history · Customer statement · Deposits/overpayments (change only, no credit balance)

### Payments, cash & expenses — 1 missing, 2 partial
- `[missing]` Unallocated payment
- `[partial]` Payment allocation · Reconciliation report

### Reports & analytics — 9 missing, 3 partial
- `[missing]` Sales by product · Sales by category · Customer ageing · Supplier balance · Payment method · Tax summary · Audit report · Report export (CSV/XLSX) · Dead stock
- `[partial]` Gross margin (day/month profit only) · Inventory on-hand · Stock movement

### Import, search & exports — 6 missing
- `[missing]` Advanced filters · Import preview · Import error report · Import batch idempotency · Stable exports · Large exports
- `[partial]` Global search (products only)

### Reliability & audit — 3 missing, 6 partial
- `[missing]` Restore drills · Error monitoring · Health checks
- `[partial]` Audit trail (no action log) · No hard delete (PIN-gated undo exists) · Transaction safety · Idempotency · Concurrent stock protection (single device only) · Backups (export + cloud save, but no schedule/retention/restore proof)
- done: Data migrations

### Later/optional (all `[missing]`)
Multi-branch · E-commerce sync · Accounting export · Customer/supplier portal · Offline POS · Public API · SaaS billing · AI/OCR import

---

## C. Screens (of 27) — not built

Setup wizard · Import wizard · Supplier list/detail · Purchase order · Goods receipt · Supplier bill/payment · Stock adjustment · Stock count · Stock transfer · Stock ledger · Payments/allocations · Reports center (only a day report exists) · User/roles admin · Settings/document sequence · Audit log · Backup/health · Sales return wizard

*(partly there: product detail, customer list/detail, payment dialog, sales list)*

## D. Reports (of 22) — not built

Sales by product · Sales by category · Inventory on-hand (as a report) · Stock card · Gross margin · Customer balance · Receivables ageing · Supplier balances · Payment collection · Tax summary · Purchases/receiving · Count variance · Audit events · Import batch outcome · Dead stock · Returns by reason · Discount/override

## E. Data model (25 entities / 230 fields) — not in Dekkan

Supplier · TaxProfile · Location · Role · UnitOfMeasure · ProductBarcode · StockMovement · StockBalance · ReturnDocument · DocumentSequence · AuditEvent · Attachment · PaymentAllocation · PurchaseOrder · GoodsReceipt · ProductVariant — plus the 168 extra fields for lots, serials, counts, transfers, price lists, cash sessions, expenses.

## F. Business rules (of 66) — not enforceable today

Server calculates amounts · tenant isolation at DB level · default-deny permissions · SKU/barcode uniqueness · quantity precision per unit · ledger is source of truth · no duplicate stock posting · adjustment reason · count delta · immutable posted movement · single valuation policy · draft isolation · atomic posting · checkout idempotency · recheck stock at commit · return cap/idempotency · disposition drives restock · all TAX rules (5) · unique document numbers under concurrency · closed periods · all import rules (3) · safe uploads · safe output/CSV-injection · audit sensitive actions · permission-safe exports · restore-tested backup · decimal arithmetic (Dekkan uses JS floats + round-3) · unsaved-changes guard

*Already safe: change is not revenue, original payment immutable, expected till equation, reprint read-only, totals reconcile, positive payment amount, no silent delete (mostly).*

## G. Acceptance tests (43) — not present as a suite

Missing: `SALE-002/003/004/006/007/008`, `STK-001/002/004/005/006`, `PROD-001/002/003`, `CUST-001/002`, `PUR-001/002/003`, `PAY-001/003`, `CASH-001/002`, `RET-001/002/003`, `RPT-001/002/003`, `SEC-001/002/003/004`, `IMP-001/002`, `DOC-001/002`, `DATA-001`, `UX-001`.

*(~8 have approximations in the current 401-test battery.)*

## H. Non-functional (of 32) — not met

Server-side authorization · secret management · secure uploads · XSS/CSV-injection · audit integrity · privacy/retention/deletion · backup policy · RPO/RTO · observability · performance targets (p95 <500 ms) · indexing · pagination · background jobs · full state handling · responsive spec · accessibility · ops documentation · browser matrix · health endpoint · local legal review · graceful degradation.

*Met: HTTPS, password hashing, automated coverage, migrations, RTL, per-business settings.*

## I. Config decisions (of 20) — still open

Pilot language (FR vs AR) · timezone Africa/Tunis · tax rates · numbering resets · CSV/XLSX format · receipt printer model · barcode scanner · offsite backup storage · legacy data migration · support process · legal/accounting review before charging money.

## J. Open decisions (DEC) — nothing formally closed

- `DEC-001` who is the customer (hypothesis only — never validated)
- `DEC-002` deployment shape
- `DEC-003` costing method (weighted avg vs FIFO)
- `DEC-005` tax rules
- `DEC-006` POS vs back-office (built as POS, never ratified)
- `DEC-007` locations
- `DEC-010` pricing

*Effectively decided by the build: DEC-004 negative stock = block, DEC-008 offline = local-first, DEC-009 OCR = deferred.*

---

**One-line summary:** the checkout/caisse core is real and tested; everything accounting-grade
(stock ledger, tax, suppliers, roles, backups, reports) plus every market step (interviews → pilot →
paying customers) is still unbuilt. The workbook expects 24 months at 5–10 h/week — Dekkan is roughly
at month 7 of it feature-wise, month 1 of it validation-wise.

**Next action:** see `PLAN.md` §6 — Phase 0 is M00: interview 5 real shops before writing more code.

---

## K. Development & build (TypeScript)

The app is written in TypeScript and **compiled in place**: `tsc` emits the runnable `.js`
next to each `.ts`. The emitted `.js` (and `sw.js`) are git-ignored — the repo tracks `.ts`
only. The browser `<script src="js/*.js">` tags and the test harness keep loading the
compiled output, so **build before running**.

- `npm run build` — type-check + emit every `.js` (`tsc`).
- `npm test` — build, then `node --test` the unit suite.
- `npm run test:sim` — build, then the full open-to-close day simulation.
- `npm run test:i18n` — build, then check Arabic/English key parity.
- `npm run test:e2e` — Playwright (PC + Phone projects).
- `npm run check` — build + unit + sim + i18n (the CI gate).
- `npm run serve` — build, then serve the app on `:4173`.

Notes: `e2e/` and `playwright.config.ts` run as TypeScript directly (excluded from `tsc`).
The dynamic DOM shell, the service worker and the vm-based test harness carry `// @ts-nocheck`
for this first pass — the domain core (`core/`) and most tests are fully type-checked and
get tightened incrementally.
