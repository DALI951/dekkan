# HANDOFF.md — dekkan

> State of the work for whoever picks this up next (other device, other chat, future you).
> Rewrite it, don't append. The body may be `Nothing pending.` — the file always exists.

Last updated: 2026-10-12 (part 4) — by Big Pickle (DESKTOP-OJME2E2)

## Done (this session, newest first)

- **Wave 4.5 — the paper you chose is the paper that prints, and the shop names itself** (`test/paper-brand.test.ts` 12, `e2e/paper-brand.spec.ts` 16 = 8 × PC+Phone, all green):
  - **The print bug, root-caused:** the engine wrote `@page{size:80mm auto}`, which is not valid CSS (`size` is
    `auto | <length>{1,2} | <page-size>`), so Chromium **threw the whole rule away** and printed on the default
    sheet — US Letter, measured here as 612×792pt. Dali reported it as "the sheet that appear not a4 and 80mm or
    the number we chose". Now a roll gets **two explicit lengths** and the height is **measured from the real
    ticket** laid out at the print width (the screen's `max-height` is not paper — lifting it was necessary; it had
    silently capped every ticket at 133mm). The style is re-applied when the choice changes (doc save/reset, cloud
    adopt), not only at boot. **Proof is a real PDF's `/MediaBox`** (a screenshot cannot prove a paper size):
    80mm → 227pt wide, 58mm → 164pt, A4 → 595×842pt, and a 2-line ticket really is taller than a 1-line one.
  - **The header brand is the shop's:** `#sideTitle` / `#shopName` show `state.shop.name`, the coin badge shows its
    first character, and the tagline under it is the shop's own when the shop wrote one (`custom.brand.tagline`).
    The app's own name is only the fallback. "Only the character changes" is asserted twice: computed-style equality
    before/after, and a before/after **pixel diff where only the brand box differs** (664px on PC, 3511 on phone —
    0.43% / 0.98% of the strip; nothing else moved).
  - Deployed to `dekkan.web.app` + modali + GitHub Pages; `SW_VERSION` = **v45**.
- **Wave 4 (part A) — the shop's own LISTS** (`c2b8fa3`): `state.custom.lists = {units, suppliers, refundReasons}`,
  validated in core BY NAME, repaired by `ensureCustomState`; Settings "Shop lists" card (chips + one input + one
  message per row); a product REMEMBERS its unit and it rides the sale line onto the ticket ("×1 kg"); supplier +
  refund-reason `<datalist>` hints. `test/custom-lists.test.ts` (16) + `e2e/lists.spec.ts` (18 = 9 × PC+Phone) —
  the e2e caught `P.listAdd is not a function` (the helper lives in `actions`, not `pages`).
- **Dali's comment rule applied to the WHOLE codebase** (`0dea5f0`): no comments inside a function body, old code
  included; applied with an auditable sweep tool + a `git diff -U0` audit that refuses any non-comment change (it
  caught two real bugs in the tool). 49 files, 340 comment lines, 91 blocks hoisted.
- **Wave 3 (A+B) — the shop's own PAPER** (`1b8cc0e`): money format (symbol/position/decimals/thousands/digits),
  6 whitelisted date formats, the brand block, header/footer wording, paper size, copies, auto-print, printed
  language ≠ screen language. `test/money-format.test.ts` (13) + `e2e/documents.spec.ts` (20).
- **Wave 2 — the shop's own COLOURS** (`f5d23c1`): `ui/themes.ts` engine, state is the authority, localStorage only
  the no-flash cache, refusals BY NAME, export/import. `test/theme-custom.test.ts` (15) + 4 vm tests + 20 e2e.
- **Language engine** (`4d27ce0`) + **wave 1 `state.custom`** (`e4f809e`). `docs/customize-plan.md` has the plan.
- **Live hosts:** `dekkan.web.app` (Firebase, deployed) · GitHub Pages (auto on push, `.github/workflows/pages.yml`)
  · modali via `$env:DEKKAN_SFTP_PASS='…'; python scripts/deploy.py` (deployed 2026-10-12; still shows the old
  build until the next run — it is deployed by hand, and the password is NOT on this box / never committed).
- `api/state.php` does NOT gate the `custom` block (checked), so the deferred wave-3-C PHP mirror is safe to leave.

## In progress

- **Nothing half-done in the tree.** Battery at the last commit: `npm run check` → **381 unit pass / 0 fail**,
  i18n en=439 ar=439, tsc clean; `e2e/paper-brand.spec.ts` 16/16; the full suite was running at the time of writing.

## Dali's queue (asked, not yet built — in the order he raised them)

1. **Colours must be a 3-COLOUR GENERATOR, not a token editor** (his words: "the user chose 3 colors and a new
   palet get created depending on the 3 chosen colors, not edit the own app themes that shouldn t be customiwale").
   → Rework wave 2's Settings card: the app's own themes become READ-ONLY presets; the shop's look is generated
   from 3 picked colours (brand / money / background) into the full 42-token set, with a live preview and a reset
   to the app's own theme. The token-by-token editor and the raw JSON panel go. Keep `state.custom.theme =
   {id, tokens}` (wave-2 rules + refusals stay), derive the pickers from the current tokens (`--acc`, `--coin2`,
   `--bg`).
2. **Customer name is broken + must be required when the sale leaves a debt** ("i cant type costumer name and its
   not required anymore when typing less than needed in pay"): `#creditName` must be typeable, and a partial payment
   (paid < total) must REQUIRE a name. Investigate `renderSell`/`doSell` in `ui/pages.ts` + `ui/actions.ts`.
3. **A real shop account system with roles** ("a cashier get logged in he see only the caisse until the manager come
   in and open… it require a name and password for user no google sign in in this… the account get created when the
   employee is created"): employee accounts (name + password, created with the employee), a role on each account
   (cashier / manager), a login gate that REQUIRES credentials, and a UI that narrows to what the role may do
   (cashier = the till only). No Google sign-in in this path. This is a big one — it needs its own wave + tests.
4. **Sign-in modal UI/UX + Google sign-in doesn't work**: the wall's design needs a real pass (labels, spacing,
   error banner, mobile), and Google needs `auth/unauthorized-domain`-style honesty + a popup→redirect fallback
   (`signInWithRedirect` + `getRedirectResult`), because the app now runs on modali/web.app/127.0.0.1 — which must
   also be listed under Firebase's **Authorized domains**. `test/auth-google.test.ts` already exists.
5. **Settings buttons must be normal size, not screen-wide** (the `.btn.full`/block buttons in the Settings cards).
6. **Save his passwords properly** — he pasted a host credential into the chat and asked for "a password manager app"
   (a local encrypted vault; the credential must NEVER go into memory or any repo — AGENTS.md rule 8).

## Next step

1. Pick the queue up at the top; each item = RED-first test → implement → verify → one commit → push (RULES.md).
2. Wave 3 part C (PHP mirror of the custom-block checks in `api/state.php`) stays deliberately DEFERRED: no `php`
   runtime here and the values are cosmetic (the app repairs what it cannot read) — untested PHP that could 409 a
   valid push is the worse trade.

## Blocked / needs Dali (his hands — this box cannot do these)

- **modali**: `$env:DEKKAN_SFTP_PASS='…'; python scripts/deploy.py` (repo root). The password is not on this box.
- Run the `api/schema-p0.sql` ALTER on the live host (php is not installed here).
- Set `backupKey` + `backupRunKey` in the host's `api/config.php`, add the cron call to `api/backup.php?run=…`, then
  do one real restore drill from a produced dump.
- Firebase console: **enable Google as a sign-in provider** and add `modali.powerpme.com`, `dekkan.web.app`,
  `dali951.github.io` + `127.0.0.1` to **Authorized domains** — otherwise Google sign-in fails on every host.
- `ui/app.ts` `A_VERSION` still reads `0.19.0` while the About card shows `0.4.0` — one number needed.

## Environment notes

- Machine `DESKTOP-OJME2E2` (Win 10, PowerShell 5.1 — **not bash**), Node v26.5.0, npm 11.17.0. `php` absent,
  `python` 3.14.6 + paramiko 5.0.0 present (that is what `scripts/deploy.py` needs).
- Repo root `C:\Users\Dali\Projects\dekkan` — branch `main` — remote `https://github.com/DALI951/dekkan` (PUBLIC).
- `npm run build` is required before e2e (the browser loads the emitted `.js`; they are gitignored).
- Dev server for probes: `node scripts/serve.js 4173` → `http://127.0.0.1:4173`.
- Inline `node -e` with quotes gets mangled by PowerShell 5.1 — write a temp script under
  `C:\Users\Dali\AppData\Local\Temp\opencode\` instead (that is also where `probe-paper.js`,
  `probe-two-sales.js`, `pixel-diff.js` and `bump-sw.js` live).

## Watch out

- `index.html` / `css/style.css` / `ui/lang.ts` are **CRLF**; `RULES.md` and the `.ts` sources are **LF**. Never
  patch with `Get-Content`/`Set-Content` (BOM + mojibake) — node file surgery, and re-check line endings.
- **A new loaded file must join EVERY loader list**: `index.html`, `test/ui.test.ts`, `sw.ts` SHELL (+ `SW_VERSION`),
  `scripts/deploy.py` FILES, and the vm sandboxes that load that layer. Bump `SW_VERSION` on every deploy.
- A new screen ALSO needs an e2e spec — the vm harness cannot run generated DOM, and that is how `P is not defined`,
  `fmt is not defined`, `Langs.list()`, `P.listAdd` and `document.querySelector is not a function` were caught.
- The vm fake `document` is MINIMAL (`getElementById`/`createElement` only): a renderer that reaches for anything else
  (`querySelector`…) must guard for it. `applyPaper`'s measurement does.
- `page.pdf({preferCSSPageSize:true})` is the only honest way to test paper size; `window.print()` is a no-op in
  headless Chromium, so a spec can click the real Print button and then read the PDF.
- `scripts/seed-test.json` is intentionally untracked — leave it. `.firebase/` is gitignored (deploy cache).
- `RULES.md` is a real contract — never re-seed it from the template over the real content.
