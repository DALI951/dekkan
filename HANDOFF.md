# HANDOFF.md — dekkan

> State of the work for whoever picks this up next (other device, other chat, future you).
> Rewrite it, don't append. The body may be `Nothing pending.` — the file always exists.

Last updated: 2026-10-11 — by Big Pickle (DESKTOP-OJME2E2)

## Done (this session)
- **UI/UX sweep CLOSED** — measured the real DOM on all 9 pages (PC 1280 + Pixel 5), found and fixed two real
  layout bugs the whole battery was blind to, plus two polish items. Commit **`64b2a00`**, pushed.
  1. Desktop was painting the **phone bar**: the ≥900px hide lost the cascade to a later unscoped
     `.topbar{display:flex}` → the mobile header overlapped the sidebar brand and pushed every page 67px down.
  2. Phone: bar + tab strip were **two independent stickies at `top:0`** → the tab strip rode up OVER the bar
     and hid the shop name as soon as you scrolled. Now both live in one `.mhead` sticky unit.
  3. Phone stock rows: five things on one line crushed the product name to 34px and pushed a button past the
     card's left edge. Now the row stacks and the actions shrink, all five still on one line.
  4. Sidebar tagline was capped at 150px with `nowrap`, chopping the English "Till + stock + debts for your
     shop". It wraps now (155px of room).
- **3 new layout regressions** (`e2e/regressions.spec.ts`), PC/Phone aware, each **verified to FAIL on the
  pre-fix CSS** (replayed against `HEAD`'s stylesheet). The scroll test asserts the page really scrolled, so it
  can never pass vacuously.
- Measured clean: no page scrolls sideways, zero page errors, every card fits. The one remaining "overflow" is
  the till card's decorative `::before` glow, clipped on purpose by `.till{overflow:hidden}` — not a bug.
- Screenshots for Dali's own eyeball: **`C:\Users\Dali\Documents\dekkan-ux-screens\`** — `pc-*.png` + `phone-*.png`
  for all 9 pages, plus `phone-scrolled-header.png` (the fixed header mid-scroll). Kept **outside** the repo on
  purpose: `npm run test:e2e` wipes `test-results/` at the start of every run, which ate the first batch.
- Earlier the same day: M04 reason codes (`a4fd3c5`) and the encrypted MySQL dump (`9955aeb`).

## In progress
- Nothing pending.

## Next step
1. Pick the next track with Dali: **(a)** Phase 0 / M00 user validation — 5 real shop interviews in Ben Arous
   (never done, the biggest real gap), or **(b)** Phase 2 ship-polish features already queued in PLAN §5:
   #8 share/send backup, #9 Z-report end-of-day print, #10 best-sellers + dead-stock.

## Blocked / needs Dali (his hands — the dev box cannot do these)
- Run the `api/schema-p0.sql` ALTER on the live host (php is not installed here).
- Set `backupKey` + `backupRunKey` in the host's `api/config.php` and add the cron/CLI call to
  `api/backup.php?run=…`; then do one real restore drill from a produced dump.
- Create the Google OAuth client id and put it in `js/config.js` + `api/config.php`.

## Environment notes
- Machine: `DESKTOP-OJME2E2` (Win 10, PowerShell 5.1 — **not bash**), Node v26.5.0, npm 11.17.0. `php` absent.
- Repo root `C:\Users\Dali\Projects\dekkan` — branch `main` — remote `https://github.com/DALI951/dekkan` (PUBLIC).
- Battery at this HEAD: `npm run check` exit 0 · **291 unit** · **65 sim** · **i18n AR=EN=350** · **135 e2e** (PC+Phone).
- `npm run build` is required before e2e (the browser loads the emitted `.js`; those files are gitignored).

## Watch out
- `index.html` is **CRLF** — re-normalize after any edit and verify zero bare LF.
- New core module → update all three boot lists (`index.html`, `test/ui.test.ts`, `scripts/simulate.ts`).
- New shipped file → add it to `scripts/deploy.py`'s `FILES` list.
- `scripts/seed-test.json` is intentionally untracked — leave it.
- Do not reintroduce independent stickies at `top:0` for the mobile header/tab strip (see RULES.md).
