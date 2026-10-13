# HANDOFF.md — dekkan

> State of the work for whoever picks this up next (other device, other chat, future you).
> Rewrite it, don't append. The body may be `Nothing pending.` — the file always exists.

Last updated: 2026-10-13 — by Big Pickle (DESKTOP-OJME2E2)

## Done (this session, newest first)

- **Queue item 4 — the sign-in wall answers the tap, and Google has a way in** (`ui/auth.ts`, `ui/app.ts`,
  `index.html`, `css/style.css`): a blocked popup now falls back to the whole-page route (`signInWithRedirect`) and
  `init()` → `getRedirectResult()` signs the returning shopkeeper in; `auth/unauthorized-domain` is named honestly
  (`auth.err.domain`) instead of "wrong password"; a disabled Google provider points at the way that DOES work
  (`auth.googleNotSet` hint under the button). The wall itself got its UI pass: real LABELS per field (a placeholder
  disappears as you type), `dir="ltr"` on the email input, one `gateBusy()` locking BOTH buttons (a second tap used to
  open a second popup), a spinner on the Google button, and an informational (never red) notice while the page leaves
  for Google. Guards: `test/auth-google.test.ts` (8, incl. the rewritten popup-blocked contract) +
  `test/ui.test.ts` (4 new wall tests).
- **Wave 6 — THE SHOP'S OWN USERS** (roles, hire-with-login, the counter's door) — `core/accounts.ts` +
  `test/accounts.test.ts` (12), `e2e/team-login.spec.ts` (10 = 5 × PC+Phone):
  - `state.accounts = [{id,name,role,employeeId,salt,hash,iters,createdAt}]`. The password is NEVER stored: PBKDF2-SHA256,
    16-byte salt, 120k rounds, via WebCrypto (works in the browser **and** in node — no dependency). Without `crypto.subtle`
    (plain-http origin) it refuses by name ("needs HTTPS") instead of storing something weak.
  - **Hiring IS giving the login**: `K.addEmployee(state, {...fields, account})` REQUIRES the account (`K.accountFor`
    validates name 2–24, password ≥ 4, role in `manager|cashier`), binds it by `employeeId`, and `fireEmployee` takes the
    login with the person. `dropAccount` refuses if the shop would be left with no manager — a shop can never lock itself out.
  - The counter's door is `#shopGate` (its own modal, **no Google button**, shop-language errors) — deliberately separate
    from the cloud/backup wall (`#gate`). A cashier logs in → the till and nothing else (`K.canSee`/`K.tabsFor` hide the other
    rails and a typed address bounces back to the caisse); the manager's own credentials open the whole shop.
  - The chip (`#shopUserSide` / `#shopUserPhone`) names the PERSON + role ("Hedi · Cashier") and offers the only two buttons
    that matter: lock, and (for a cashier) "Manager opens". With users but nobody signed in the same chip reads
    "Nobody signed in · Sign in" — so the owner can hand the tablet over locked. Session lives in `sessionStorage`
    (a reload keeps it, closing the browser closes the shop).
  - UI: the hire form gained required login name + password + role (the FIRST user of a shop is pre-picked as manager);
    editing a hire keeps the login (empty password = unchanged) and a manager may switch the role from the same form;
    the team list shows each login. `test/ui.test.ts`'s vm sandbox now hands in `crypto`, `TextEncoder`, `sessionStorage`.
  - `SW_VERSION` = **v47**. `core/accounts.js` joined `index.html`, `core/dekkan-core.ts`, `test/ui.test.ts`, `sw.ts` SHELL,
    `scripts/deploy.py` FILES.
- **Wave 5 — the shop's 3 COLOURS generate a whole new palette** (`465701a`): pickers for `brand`/`money`/`ground` → the
  engine derives all 42 tokens (WCAG floors enforced), the app's own themes are READ-ONLY presets, the token editor and the
  raw JSON panel are gone. `test/theme-palette.test.ts` (13) + `e2e/palette.spec.ts` (22). Settings buttons are buttons,
  not screen-wide bars (`.row.wrap > *` in `#page-settings`).
- **Wave 4.5 — the paper you chose is the paper that prints, and the shop names itself**: `@page{size:80mm auto}` was invalid
  CSS → Chromium dropped the rule and printed on Letter; now two explicit lengths + a MEASURED ticket height, proven by a real
  PDF `/MediaBox`. Header brand = `state.shop.name` (+ first char in the badge). `test/paper-brand.test.ts` (12) +
  `e2e/paper-brand.spec.ts` (16).
- **Comment rule applied to the WHOLE codebase** (`0dea5f0`) — no comments inside a function body, old code included.
- **Waves 1–4** (`e4f809e`, `4d27ce0`, `f5d23c1`, `1b8cc0e`, `c2b8fa3`): `state.custom` foundation, language engine,
  theme engine, paper/documents, shop lists. Plan in `docs/customize-plan.md`.
- **Customer-name bug (his item 2) did NOT reproduce on current main** — typing works and a partial payment already refuses
  without a name (core stores the name on the entry's `note` and on the debt). His build was the stale deployed one
  (waves 3–5 were undeployed). `e2e/sell-customer.spec.ts` (12 = 6 × PC+Phone) is now the permanent guard.
- **Live hosts:** `dekkan.web.app` (Firebase) · GitHub Pages (auto on push, `.github/workflows/pages.yml`) · modali via
  `$env:DEKKAN_SFTP_PASS='…'; python scripts/deploy.py` (the password is NOT on this box / never committed).

## In progress

- **Nothing half-done in the tree.** Battery at HEAD: `npm run check` → **414 unit pass / 0 fail**, simulation 65/65,
  i18n `en=479 ar=479`, tsc clean; full Playwright suite (PC + Phone) green.

## Dali's queue (asked, not yet built — in the order he raised them)

1. **Password manager** — Dali explicitly deferred this out of dekkan ("forget about the passwoard manager i will do it
   somewhere else here focus on dekkan only"). An abandoned stub lives in `C:\Users\Dali\Projects\vault` (safe to delete).
   Nothing else is outstanding from his queue as of 2026-10-13 (waves 1–6 + item 4 are in).

## Next step

1. Commit + deploy the session's work (GitHub Pages follows the push; `dekkan.web.app` needs
   `npx firebase deploy --only hosting`).
2. The Firebase console work below is Dali's hands — until then Google sign-in fails everywhere with `auth.err.domain`.
3. Wave 3 part C (PHP mirror of the `custom` checks in `api/state.php`) stays deliberately DEFERRED: no `php` runtime here
   and the values are cosmetic (the app repairs what it cannot read).

## Blocked / needs Dali (his hands — this box cannot do these)

- **Firebase console:** enable **Google** as a sign-in provider and add `modali.powerpme.com`, `dekkan.web.app`,
  `dali951.github.io` + `127.0.0.1` to **Authorized domains** — otherwise Google sign-in fails on every host.
- **modali deploy:** `$env:DEKKAN_SFTP_PASS='…'; python scripts/deploy.py` (repo root). The password is not on this box.
- Run the `api/schema-p0.sql` ALTER on the live host (no `php` here).
- Set `backupKey` + `backupRunKey` in the host's `api/config.php`, add the cron call to `api/backup.php?run=…`, then do one
  real restore drill.
- `ui/app.ts` `A_VERSION` still reads `0.19.0` while the About card shows `0.4.0` — one number needed.
- The modali SFTP credential he pasted into a chat is stored nowhere — recommend rotating it.

## Environment notes

- Machine `DESKTOP-OJME2E2` (Win 10, PowerShell 5.1 — **not bash**), Node v26.5.0, npm 11.17.0. `php` absent,
  `python` 3.14.6 + paramiko 5.0.0 present (what `scripts/deploy.py` needs).
- Repo root `C:\Users\Dali\Projects\dekkan` — branch `main` — remote `https://github.com/DALI951/dekkan` (PUBLIC).
- `npm run build` is required before e2e (the browser loads the emitted `.js`; they are gitignored).
- Dev server for probes: `node scripts/serve.js 4173` → `http://127.0.0.1:4173`.
- Inline `node -e` with quotes gets mangled by PowerShell 5.1 — write a temp script under
  `C:\Users\Dali\AppData\Local\Temp\opencode\` instead.

## Watch out

- `index.html` / `css/style.css` / `ui/lang.ts` are **CRLF**; `RULES.md` and the `.ts` sources are **LF**. Never patch with
  `Get-Content`/`Set-Content` (BOM + mojibake) — node file surgery, then re-check line endings.
- **A new loaded file must join EVERY loader list**: `index.html`, `test/ui.test.ts`, `sw.ts` SHELL (+ `SW_VERSION`),
  `scripts/deploy.py` FILES, and the vm sandboxes that load that layer. Bump `SW_VERSION` on every deploy.
- **Inserting i18n keys: anchor on the RIGHT dictionary.** `insertAfterKey('toast.debtName')` matched the Arabic dict twice
  (the key exists once per language) and TS1117 caught it — patch the English dict first, then the Arabic one, and re-run
  `npm run check` (i18n parity is enforced).
- A new screen ALSO needs an e2e spec; the vm harness cannot run generated DOM.
- **`page.goto('/#/other')` does NOT reload the document** (same-document hash change). For a "fresh browser" (the cashier
  arriving in the morning) clear `sessionStorage` then `goto('about:blank')` first, or `page.reload()`.
- The e2e rail is a sidebar on PC and a top strip on the phone: find a tab with
  `button[data-hash="#/x"]` (+ `:visible` when asserting it must be seen, and `:visible` never matches for `toBeHidden`).
- `page.pdf({preferCSSPageSize:true})` is the only honest way to test paper size; `window.print()` is a no-op in headless.
- **Google sign-in needs the console, not code**: `signInWithRedirect`/`signInWithPopup` fail with `auth/unauthorized-domain` on any host that is not in Firebase's Authorized domains list. The code now says so (`auth.err.domain`) instead of blaming the password. `test/fake-firebase.ts` models both routes (`googleBlocked`, `domainBlocked`, `redirectUser`) — use it before a real device.
- `scripts/seed-test.json` is intentionally untracked — leave it. `.firebase/` is gitignored (deploy cache).
- `RULES.md` is a real contract — never re-seed it from the template over the real content.
