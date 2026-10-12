# HANDOFF.md — dekkan

> State of the work for whoever picks this up next (other device, other chat, future you).
> Rewrite it, don't append. The body may be `Nothing pending.` — the file always exists.

Last updated: 2026-10-12 (part 3) — by Big Pickle (DESKTOP-OJME2E2)

## Done (this session, newest first)

- **Wave 4 (part A) — the shop's own LISTS** (`c2b8fa3`, pushed): `state.custom.lists =
  {units, suppliers, refundReasons}`. Core owns the rules (`CUSTOM_LISTS`: units keep 1..24
  items, suppliers 0..50, refund reasons 0..12; an item is 1..24 chars for units, 1..60 for
  the others) and `listProblems()` refuses **BY NAME** (`lists.units` …). `ensureCustomState()`
  repairs a list it cannot read (trim, de-duplicate, drop junk, defaults for a list it cannot
  salvage) and stays a fixed point. `Settings > "Shop lists"` = one row per list (chips + one
  input + one message under that row; a refusal names the list and writes nothing). A product
  now REMEMBERS its unit (`addProduct`/`setProduct` validate it) and the unit rides the sale
  line so the ticket prints **"×1 kg"** instead of "×1". The lists reach the forms that use
  them: the product form's unit picker + native `<datalist>` hints for **suppliers** (buy form)
  and **refund reasons** (both refund fields) — the same pattern as the customer/cashier names.
  13 new i18n keys per language. Tests: `test/custom-lists.test.ts` (16, RED-first) +
  `e2e/lists.spec.ts` (18 = 9 journeys × PC + Phone). The e2e caught a real bug the unit tests
  could not: `P.listAdd is not a function` (the helper lives in `actions`, not `pages`).
- **Deployed: `dekkan.web.app` is LIVE** (Firebase hosting, project `dekkan`) — the long-standing
  404 is closed, verified serving the current build (the new lists card is on it). GitHub Pages
  redeploys itself from `main` on every push (`.github/workflows/pages.yml` → build + deploy).
- **Dali's comment rule applied to the WHOLE codebase** (`0dea5f0`, pushed): **no comments
  inside a function body** in any file, old code included; comments live above the function or at
  the top of the file. Applied mechanically with an auditable tool (temp `comment-sweep.js`): a
  character scan that tracks strings / template literals / regex literals (so a `//` in a URL or
  a `\//` escape is never a comment), comment lines grouped into contiguous blocks, each block
  attributed to the innermost function body, a "why" block HOISTED above its function as one
  `/* … */` paragraph, pure narration dropped (git history keeps it), trailing comments cut while
  the code stayed, eslint/istanbul/@ts-* directives never moved, and every touched file
  renormalized to its committed line endings. 49 files, 340 comment lines, 91 blocks. A
  `git diff -U0` AUDIT refuses any changed line that is not a comment — it caught two real bugs in
  the tool itself (a regex escape eaten as a comment; trailing comments deleting the code before them).
- **Wave 3 (A+B) — the shop's own PAPER** (`1b8cc0e`, pushed): money format (symbol / position /
  decimals / thousands / digits; `''` symbol = follow the interface language), 6 whitelisted date
  formats (`CUSTOM_DATE_FORMATS` in core, mirrored in `ui/fmt.ts` with a drift-guard test), the
  brand block (logo, shop, tagline, address, phone, tax id), header/footer wording, paper size
  58/80/A4 (a JS-managed `<style id="paperStyle">` — `@page` cannot be class-scoped), copies,
  auto-print, and a printed language that can differ from the screen's. Screen = ONE table
  (`DOC_FIELDS`, 19 fields) + live sample + a message line that NAMES a refusal. `receipt.showCashier`
  DROPPED (nothing in the UI knows who rang it — a switch that prints nothing is a lie);
  `receipt.qr` stays validated data (no fake QR). `test/money-format.test.ts` (13) +
  `e2e/documents.spec.ts` (20).
- **Wave 2 — the shop's own COLOURS** (`f5d23c1`, pushed): `ui/themes.ts` engine (a theme =
  `{id, tokens}` OVERRIDES on a base; state is authoritative, localStorage only the no-flash
  cache; an unreadable override is ignored on load but refused by name on write; imported JSON is
  untrusted text; Save writes only the tokens that DIFFER from the preset, Export writes all 42;
  a device-cache-only choice is adopted into state on boot). Settings theme editor + JSON panel,
  26 i18n keys, `test/theme-custom.test.ts` (15) + 4 vm-harness tests + `e2e/theme-editor.spec.ts` (20).
- **Language engine** (`4d27ce0`) and **wave 1 `state.custom`** (`e4f809e`): see `docs/customize-plan.md`
  and the `RULES.md` Decisions list. The engine writes `dekkan.langdir`; wave 1 shipped invisibly on purpose.

## In progress
- **Nothing.** Wave 4 part A is closed, committed and pushed. Battery at this HEAD: `npm run check`
  exit 0 → **369 unit** · **65 sim** · **i18n en=439 ar=439** (parity enforced) · tsc clean; the new
  `e2e/lists.spec.ts` 18/18. A full-suite re-run was in flight at the time of writing (previous
  HEAD was 179 passed / 3 skipped).

## Next step
1. **Dali tests wave 4 himself** (Settings → قوائم الدكان: add a unit "carton", create a product
   with kg, sell it, look at the ticket) and then picks the next wave.
2. Wave order left (`docs/customize-plan.md` B.4): **4 part B** = custom FIELDS (extra labelled
   fields on a product/client/employee, one flagged to print on the receipt) · **5** = tabs order /
   landing page / density via a page registry (the third engine of the same shape) · **6** = wire
   `ui/langs-fr.ts` into every loader list + top up the FR delta + templates. One wave in flight (RULES.md).
3. Wave 3 part C is deliberately DEFERRED: the PHP mirror of the custom-shape checks in
   `api/state.php`. It cannot be tested here (`php` is not installed) and the values are cosmetic —
   the app already repairs what it cannot read, so shipping untested PHP that could 409 a valid
   push is the worse trade. Do it where a PHP runtime exists.

## Blocked / needs Dali (his hands — the dev box cannot do these)
- **modali is STALE** (sw v39, no `.mhead`, no `#btnGoogle`): `$env:DEKKAN_SFTP_PASS='…'; python
  scripts/deploy.py` from `C:\Users\Dali\Projects\dekkan`. The password is not on this box and must
  never be committed. (`dekkan.web.app` + GitHub Pages are both current now.)
- Run the `api/schema-p0.sql` ALTER on the live host (php is not installed here).
- Set `backupKey` + `backupRunKey` in the host's `api/config.php`, add the cron/CLI call to
  `api/backup.php?run=…`, then do one real restore drill from a produced dump.
- Create the Google OAuth client id and put it in `js/config.js` + `api/config.php`.
- `ui/app.ts` `A_VERSION` still reads `0.19.0` while the About card shows `0.4.0` — pick one number.

## Environment notes
- Machine `DESKTOP-OJME2E2` (Win 10, PowerShell 5.1 — **not bash**), Node v26.5.0, npm 11.17.0. `php` absent.
- Repo root `C:\Users\Dali\Projects\dekkan` — branch `main` — remote `https://github.com/DALI951/dekkan` (PUBLIC).
- `npm run build` is required before e2e (the browser loads the emitted `.js`; those files are gitignored).
- Deploy: GitHub Pages = automatic on push. Firebase = `firebase deploy --only hosting` (project `dekkan`,
  authenticated on this box; the local `.firebase/` cache is now gitignored).

## Watch out
- `index.html` / `css/style.css` / `ui/lang.ts` are **CRLF**; `RULES.md` and the `.ts` sources are **LF**.
  Whichever you edit, re-normalize to what the committed blob has and verify (a file-surgery script in node,
  never `Get-Content`/`Set-Content`, never the `edit` tool on a whole file).
- **A new loaded file must join EVERY loader list** (RULES.md): `index.html`, `test/ui.test.ts`, `sw.ts`
  SHELL (+ `SW_VERSION`), `scripts/deploy.py` FILES, and the vm sandboxes that load that layer.
- A new screen ALSO needs an e2e spec: the vm harness cannot run generated DOM, and that is how
  `P is not defined`, `fmt is not defined`, `Langs.list()`, and now `P.listAdd` were caught.
- Deploying to Firebase uploads the repo root (`"public": "."`) minus `firebase.json`'s ignore list — remember
  the built `.js` are gitignored but must exist on disk at deploy time.
- `scripts/seed-test.json` is intentionally untracked — leave it.
- `RULES.md` is a real contract — never re-seed it from the template over the real content.
