# HANDOFF.md — dekkan

> State of the work for whoever picks this up next (other device, other chat, future you).
> Rewrite it, don't append. The body may be `Nothing pending.` — the file always exists.

Last updated: 2026-10-12 (part 2) — by Big Pickle (DESKTOP-OJME2E2)

## Done (this session)
- **Refunds-off switch now really turns the feature off** (`01e8b35`, pushed): turning off
  Settings > "Refunds allowed" takes the Refund button off the Sell page **and** off every
  ticket. Before: the core refused ("refunds are turned off") but the buttons stayed on
  screen and looked dead — Dali's report: *"when i check off returning i still can click it
  like it does nothing but the button is still there"*. Also: `toggleRefundMode` /
  `doRefund` / `receiptRefund` now refuse with a **translated** toast (`toast.refundsOff`,
  AR + EN) instead of a raw English string. New RED-first tests: `test/ui.test.ts`
  (harness `classList` upgraded from no-op to a real set — a no-op list cannot tell a
  hidden button from a dead one) + `e2e/refund-toggle.spec.ts` (PC + Phone journey).
- **RULES.md restored** (this commit): `aa0f676` accidentally overwrote the real contract
  with the empty seed template (the message even claimed a rule that got wiped with it).
  Recovered the full contract from `9699780`, re-landed it, and re-added the lost
  "never park keeper artifacts in `test-results/`" rule + today's refunds decision.
- Project commands landed: `.opencode/commands/battery.md` + `ship.md` (`64c70a5`).
- **UI/UX sweep CLOSED** (`64b2a00`, pushed) — measured the real DOM on all 9 pages
  (PC 1280 + Pixel 5), fixed two real layout bugs the whole battery was blind to + two
  polish items: desktop no longer paints the phone bar (was overlapping the sidebar
  brand and pushing every page 67px down); phone bar + tab strip are ONE `.mhead`
  sticky unit (strip no longer rides over the bar); phone stock rows stack and shrink;
  sidebar tagline wraps. 3 DOM-measurement regressions added, each verified to FAIL on
  the pre-fix CSS.
- Measured clean: no sideways scroll, zero page errors, every card fits (the till glow
  clipped by `.till{overflow:hidden}` is decorative, not a bug). Screenshots for Dali's
  eyeball: `C:\Users\Dali\Documents\dekkan-ux-screens\` (outside the repo on purpose).
- Earlier the same day: M04 reason codes (`a4fd3c5`) and the encrypted MySQL dump (`9955aeb`).

## Done (2026-10-12, part 2)
- **Language engine** (`4d27ce0`): `ui/langs.ts` is the theme engine applied to words — a language
  is `{id, name, native, dir, keys}` registered through `DEK.Langs`; `add()` refuses a malformed or
  duplicate language loudly, `t()` resolves current → base → key, `dir()` lives on the object (no
  `=== 'ar'` checks anywhere), `parity(id)` compares a language with the base, `resolve()` honours a
  saved choice and falls back on garbage, and the engine writes `dekkan.langdir` so the pre-paint
  snippet needs no language list. `ui/lang.ts` keeps its `T` facade (AR/EN key tables byte-identical),
  so no page changed. The Settings language list is GENERATED from the registry (`#langSeg`, ids
  `lang<Id>` so `#langAr`/`#langEn` still exist for e2e). `check-i18n` now enforces parity for EVERY
  registered language. Loader lists all updated (index.html, ui.test.ts boot list, ui-lang.test.ts,
  check-i18n sandbox, sw SHELL v42→v43, deploy.py FILES).
- **Wave 1 — `state.custom` foundation** (`e4f809e`): the customization shape as DATA (brand, money
  format, dates, print, receipt wording, tab order/hidden, docLanguage) with `defaultCustom()`,
  `customProblems()`, `ensureCustomState()` (repair on boot + import, never throws) and strict
  `setCustom()` (throws + writes nothing). `stateProblems()` reports `custom: …`. 14 RED-first tests
  in `test/custom.test.ts`. **Invisible on purpose** — waves 2–6 read this shape.
- Battery at this HEAD: `npm run check` exit 0 → **318 unit** · **65 sim** · **i18n en=351 ar=351** ·
  **137 e2e** (PC + Phone). index.html still CRLF (bare LF = 0).

## In progress
- **2026-10-12 verification pass + customization plan (`docs/customize-plan.md`).** Dali asked
  "list everything left and how customizable can this get — maximum". The repo is green
  (`f63cd9b`, gate exit 0) and **no P0 engineering remains**; the pass found the open items are
  ops + polish + one missing language, not core work. Verified live (no code changed):
  **GitHub Pages = current** (`.mhead` + `#btnGoogle` + sw v42), **modali = STALE** (sw v39, no
  `.mhead`, no `#btnGoogle` — missing the 2026-10-10/11 trust pack, login wall and layout fixes),
  **`dekkan.web.app` = 404 "Site Not Found"** (never deployed). `A_VERSION` still `0.19.0`.
  The plan doc holds Part A (everything open, grouped) and Part B (6 customization layers, what
  must never be customizable, the honest "how far" numbers, and a 6-wave build order).
  **Awaiting Dali's pick of the next wave** — nothing else is in flight.

## Next step
1. **Dali tests wave 1 + the language engine himself**, then picks wave 2 (theme editor + theme
   JSON import/export) or names another wave. One wave in flight at a time (RULES.md).
2. He also still owes an answer on the `UNSURE` below (`api/schema-p0.sql` on the host?) and on
   the two stale/dead hosts in "Blocked".

## Blocked / needs Dali (his hands — the dev box cannot do these)
- **modali is serving a STALE build** (sw v39, no `.mhead`, no `#btnGoogle`) — needs
  `$env:DEKKAN_SFTP_PASS=…; python scripts/deploy.py` from the repo root, or it stays behind.
- **`dekkan.web.app` returns 404** — deploy it or drop `firebase.json`/`.firebaserc`.
- Run the `api/schema-p0.sql` ALTER on the live host (php is not installed here).
- Set `backupKey` + `backupRunKey` in the host's `api/config.php` and add the cron/CLI
  call to `api/backup.php?run=…`; then do one real restore drill from a produced dump.
- Create the Google OAuth client id and put it in `js/config.js` + `api/config.php`.

## Environment notes
- Machine: `DESKTOP-OJME2E2` (Win 10, PowerShell 5.1 — **not bash**), Node v26.5.0, npm 11.17.0. `php` absent.
- Repo root `C:\Users\Dali\Projects\dekkan` — branch `main` — remote `https://github.com/DALI951/dekkan` (PUBLIC).
- Battery at this HEAD: `npm run check` exit 0 · **318 unit** · **65 sim** · **i18n en=351 ar=351** · **137 e2e** (PC+Phone).
- `npm run build` is required before e2e (the browser loads the emitted `.js`; those files are gitignored).
- Dev server still up: `node scripts/serve.js 4173` → http://127.0.0.1:4173 (local mode seeded).

## Watch out
- `index.html` is **CRLF** — re-normalize after any edit and verify zero bare LF.
- **A new loaded file must join EVERY loader list** (RULES.md): `index.html`, `test/ui.test.ts`, `sw.ts` SHELL (+ `SW_VERSION`), `scripts/deploy.py` FILES, and the vm sandboxes that load that layer (`scripts/check-i18n.ts`, `test/ui-lang.test.ts`). A miss loads it in one place only, silently.
- New shipped file → add it to `scripts/deploy.py`'s `FILES` list.
- `scripts/seed-test.json` is intentionally untracked — leave it.
- Do not reintroduce independent stickies at `top:0` for the mobile header/tab strip (see RULES.md).
- `RULES.md` is a real contract — never re-seed it from the template over the real content.