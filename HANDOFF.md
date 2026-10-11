# HANDOFF.md — dekkan

> State of the work for whoever picks this up next (other device, other chat, future you).
> Rewrite it, don't append. The body may be `Nothing pending.` — the file always exists.

Last updated: 2026-10-11 (part 2) — by Big Pickle (DESKTOP-OJME2E2)

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

## In progress
- Nothing pending. Project declared done pending Dali's own eyeball of the sweep
  screenshots + his answer on the host items below.

## Next step
1. Answer the `UNSURE` below (was `api/schema-p0.sql` ever run on the host?) so HANDOFF
   can record the truth instead of an open question.
2. Pick the next track with Dali: **(a)** Phase 0 / M00 user validation — 5 real shop
   interviews in Ben Arous (never done, the biggest real gap), or **(b)** Phase 2
   ship-polish features already queued in PLAN §5: #8 share/send backup, #9 Z-report
   end-of-day print, #10 best-sellers + dead-stock.

## Blocked / needs Dali (his hands — the dev box cannot do these)
- Run the `api/schema-p0.sql` ALTER on the live host (php is not installed here).
- Set `backupKey` + `backupRunKey` in the host's `api/config.php` and add the cron/CLI
  call to `api/backup.php?run=…`; then do one real restore drill from a produced dump.
- Create the Google OAuth client id and put it in `js/config.js` + `api/config.php`.

## Environment notes
- Machine: `DESKTOP-OJME2E2` (Win 10, PowerShell 5.1 — **not bash**), Node v26.5.0, npm 11.17.0. `php` absent.
- Repo root `C:\Users\Dali\Projects\dekkan` — branch `main` — remote `https://github.com/DALI951/dekkan` (PUBLIC).
- Battery at this HEAD: `npm run check` exit 0 · **292 unit** · **65 sim** · **i18n AR=EN=351** · **137 e2e** (PC+Phone).
- `npm run build` is required before e2e (the browser loads the emitted `.js`; those files are gitignored).
- Dev server still up: `node scripts/serve.js 4173` → http://127.0.0.1:4173 (local mode seeded).

## Watch out
- `index.html` is **CRLF** — re-normalize after any edit and verify zero bare LF.
- New core module → update all three boot lists (`index.html`, `test/ui.test.ts`, `scripts/simulate.ts`).
- New shipped file → add it to `scripts/deploy.py`'s `FILES` list.
- `scripts/seed-test.json` is intentionally untracked — leave it.
- Do not reintroduce independent stickies at `top:0` for the mobile header/tab strip (see RULES.md).
- `RULES.md` is a real contract — never re-seed it from the template over the real content.