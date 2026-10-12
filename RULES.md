# RULES.md — dekkan

> Project rules. **Binding for every session, on every machine** (injected automatically).
> Rules only — current state lives in `HANDOFF.md`.
> Filled from verified work on 2026-10-11 (Big Pickle). `UNSURE` = not confirmed by Dali.
> Restored 2026-10-11 (part 2): commit `aa0f676` accidentally overwrote this file with the
> seed template — the real contract was recovered from `9699780` and re-landed with the
> additions listed in "Decisions".

## What this project is
Dekkan — Arabic-first small-shop kit (POS/till): cash box, stock, debts, profit.
Client-side core is the tested truth; a small PHP API (`api/`) carries the optional cloud account.

## Stack
- Plain HTML/CSS/JS in the browser, no framework, no bundler. `index.html` + `ui/*.ts` (UMD factories) + `css/style.css`.
- `core/*.ts` = the domain core, UMD factories that read their deps off `K` at load — usable in the browser **and** in Node tests.
- Build = `tsc` only (emits `.js` next to `.ts`; **the `.js` files are gitignored, never committed**). The repo holds `.ts` sources only.
- API = PHP + MySQL (`api/*.php`). **`php` is NOT installed in the dev environment** → PHP changes are reviewed by reading, never executed locally.
- Tests = `node --test` (unit, runs `.ts` directly), `scripts/simulate.ts`, `scripts/check-i18n.ts`, Playwright (e2e, PC + Phone projects).

## Repo
- Root: `C:\Users\Dali\Projects\dekkan` (dekkan, two k's — not `dekan`)
- Remote: `https://github.com/DALI951/dekkan` — **PUBLIC**: nothing private/secrety ever lands here
- Branch: `main` only (no feature branches unless Dali asks) · never force-push

## Commands (exact — run from the repo root)
| Purpose | Command |
|---|---|
| the gate: typecheck + unit + sim + i18n | `npm run check` |
| typecheck only | `npm run typecheck` |
| unit tests | `npm test` |
| simulation checks | `npm run test:sim` |
| i18n parity (AR must equal EN) | `npm run test:i18n` |
| build (REQUIRED before e2e — the browser loads `.js`) | `npm run build` |
| e2e, both layouts | `npm run test:e2e` (= build + Playwright) |
| dev server for manual use | `npm run serve` → http://127.0.0.1:4173 |

**The gate:** `npm run check` must exit 0 before any commit. Never commit on a red gate.

## Conventions
- **RED-first**: write the failing test, then implement, then the gate, then commit **one item per commit**.
- Commits use Dali's author flags only, never a global git identity:
  `git -c user.name=DALI951 -c user.email=dali951@users.noreply.github.com commit`
  then push to `origin/main`. Commit messages with `>=`/`<=` must go through `git commit -F <file>` (PowerShell parses them as redirection).
- **Money/state**: every mutation is pure — clone, mutate the clone, return it; a failed op throws and changes **nothing**. Cash is always **derived** (`day.startCash + Σ entries`), never stored. The stock counter must always equal the ledger sum.
- **A new loaded file must join EVERY loader list** (a miss loads it in one place only, silently). Core: `index.html` script tags, `test/ui.test.ts` boot list, `scripts/simulate.ts` browser sandbox. UI: `index.html`, `test/ui.test.ts`, `sw.ts` SHELL (**+ bump `SW_VERSION`**), `scripts/deploy.py` FILES, and the vm sandboxes that load that layer (`scripts/check-i18n.ts`, `test/ui-lang.test.ts`).
- **Wave workflow (2026-10-12, Dali's order — binding):** ONE wave in flight, never two. Each wave is: (1) write the failing tests FIRST and run them to prove RED, (2) implement, (3) prove GREEN (`npm run check` + the wave's e2e when the wave is visible), (4) report to Dali — what changed, files + commit hashes, the exact commands he runs to judge it himself, and what is still open. A "foundation" wave ships invisibly on purpose; say so in the report instead of hiding it.
- **i18n parity is a hard rule**: every new key goes into AR **and** EN in the same commit; `check-i18n` reads `index.html` ids too.
- **Languages are registry data (2026-10-12):** one language = ONE object registered through `DEK.Langs` (`ui/langs.ts`, the language twin of the theme engine). Never add a language branch in `core/` or `pages/`; the engine owns dir/persist/resolution/parity. Every language must carry the exact same key set as the base (`en`) — enforced by `check-i18n`. Language ids map to Settings buttons `#lang<Id>` (`ar` → `#langAr`), so the generated markup keeps the e2e selectors working.
- **Customization is DATA in `state.custom` (2026-10-12):** every configurable value (brand, money format, dates, print, receipt wording, tabs, document language) lives there — never a code branch, never a hardcoded literal in the UI. It is repaired on load (`ensureCustomState`), strictly validated on write (`setCustom`, throws and writes nothing), exported with the backup, and validated by the integrity gate before it can be pushed. The 41 theme tokens stay the styling truth.
- `state.version` is 4 — a shape change means a migration path, not a version bump alone.
- Comment style in this repo (tightened by Dali 2026-10-12):
  - **NO comments inside a function body.** A function must read from its name and
    its parameters alone — rename or restructure instead of explaining.
  - Comments live **above** a function or block (why it exists, what invariant it
    keeps) or at the top of the file. Short, plain English, dated when it decides
    something.
  - JSDoc-style headers are fine; line-by-line narration inside a body is not.
  - This applies to `ui/`, `core/`, `scripts/` and new tests. Writing one is a bug.

## Do NOT
- **Never commit secrets/tokens/passwords.** `api/config.php` and `js/config.js` hold server/account config — real values live only on the host; only `config.example.php` ships.
- Never commit build output (`*.js`, `*.tsbuildinfo` are gitignored on purpose).
- Never weaken or delete a test to make it pass — fix the code, or delete the test with a written reason.
- Never force-push; never destroy uncommitted work without asking.
- Never ship a new file without adding it to `scripts/deploy.py`'s `FILES` list (otherwise it exists locally and 404s on the host).
- Never edit `index.html` into bare LF: **the file is CRLF**. After any edit, re-normalize and check (`bareLF=0`).
- Never make the phone header and the phone tab strip two independent stickies at `top:0` — they collide mid-scroll (fixed 2026-10-11 by wrapping both in one `.mhead` sticky unit). Desktop must hide `.mhead`/`.topbar`/`.topnav` entirely.
- **Never park keeper artifacts (screenshots, dumps) in `test-results/`** — Playwright wipes the dir at the start of every run (it ate the first sweep screenshots 2026-10-11). Keeper material lives in `C:\Users\Dali\Documents\dekkan-ux-screens\`.
- Leave `scripts/seed-test.json` untracked — it is deliberate (local seeding aid, not part of the app).

## Decisions (why — append-only)
- **2026-10-11 — English is the born-default UI language**; Arabic stays a first-class equal (`AR=EN` parity enforced). A fresh profile gets English LTR.
- **2026-10-11 — M04 adjustments need a closed reason code** (`count|damage|loss|other`): a real stock count change without a code refuses and writes nothing. Reason codes beat free text for reports.
- **2026-10-11 — Backups are encrypted at rest**: `api/backup.php` dumps the three `dekkan_*` tables, gzips, AES-256-CBC with `backupKey`, keeps `backupKeep` (14) files, logs to `backup.log`; the folder ships with a deny-all `.htaccess`.
- **2026-10-11 — Layout bugs are locked with DOM-measurement regressions**, not with eye-checks: `e2e/regressions.spec.ts` asserts the desktop never paints the phone head, the tab strip docks *under* the bar when scrolled (and that the page really scrolled), and that a stock row fits its card on a phone.
- **2026-10-11 — Settings toggles must take their UI with them**: `allowRefund=false` hides the refund buttons + panel entirely. A button that stays on screen and "does nothing" (the shopkeeper's words) is worse than no button — reported live on the Sell page. Mirrors the existing `allowDiscount` behaviour; the redirect in the UI can never reopen a hidden path.
- **2026-10-12 — the language engine is the theme engine, applied to words**: a language = `{id, name, native, dir, keys}` registered through `DEK.Langs`; `add()` refuses a malformed or duplicate language loudly; the engine resolves the saved choice, owns `documentElement.lang/dir` (+ `dekkan.langdir` for the pre-paint no-flash snippet) and reports parity against the base language. Adding French must be one object, not a hunt through `pages/`. Why: Dali asked for the same shape he already trusts for themes.
- **2026-10-12 — customization ships foundation-first (`state.custom`)**: wave 1 adds the settings SHAPE (defaults + repair on load + strict validated writes) with no visible change, because waves 2–6 (theme editor, brand/documents, editable lists, tabs/density, French) all read it. Shipping a UI first would have forced a rewrite of the shape later. The plan lives in `docs/customize-plan.md`; waves are picked by Dali, one at a time.

## Open questions for Dali
- `UNSURE` — deployment: where the host lives and who runs `api/schema-p0.sql` + sets `backupKey`/`backupRunKey`/cron (Dali's hands as of 2026-10-11).
- `UNSURE` — anything that must *never* happen here from past pain (beyond the do-nots above).