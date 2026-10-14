# HANDOFF.md — dekkan

> State of the work for whoever picks this up next (other device, other chat, future you).
> Rewrite it, don't append. The body may be `Nothing pending.` — the file always exists.

Last updated: 2026-10-14 — by Big Pickle (DESKTOP-OJME2E2) — **wave 7 is HALF DONE, read `In progress` first**

## Done (this session, newest first)

- **Wave 7 — the shopkeeper builds HIS OWN theme from 3 colours, and the app's themes have no writer at all**
  (pushed as a WIP commit labelled "wave 7 WIP"; engine/core GREEN, UI wired, tests not yet rewritten):
  - Model: `state.custom.theme = { id: 'souk'|'mint'|'royal'|'own', name: string, seeds: {brand,money,ground} }`.
    `seeds` are HIS three colours and survive picking a preset (a preset is a choice "for now"); `{}` = he owns none.
    The 42 derived tokens are NEVER stored — they are derived at paint time (a derived value in a file drifts).
  - Engine (`ui/themes.ts`): `THEMES.own` is the 4th card (`own: true`, its `tokens` are just its declared `palette({})`);
    **presets are strictly read-only** — `applyTheme` ignores any `tokens` handed in and REPORTS them in `res.ignored`,
    and `tokensFor(id, seeds)` is the only path to paint. New: `seeds()`, `hasOwn()`, `isCustomized()` (= hasOwn),
    `seedBag()`/`seedsOf()` (tolerant: accepts seed names OR the tokens they drive), `dots(id, seeds)`, `preview(seeds)`,
    `exportTheme(name, seeds)` → seeds-only JSON, `importTheme` accepts `{name,seeds}` AND converts a wave 5-6
    `{id,tokens}` file. Cache keys `dekkan.theme` + `dekkan.themeseeds`; the old `dekkan.themetokens` is read ONCE
    (as `{id:'own', seeds:{…}}`) so nobody's first paint regresses.
  - Core: `defaultCustom().theme = {id:'souk', name:'', seeds:{}}`; `customProblems` refuses an extra seed BY NAME,
    allows partial seeds, and refuses `own` with NO colours; `ensureCustomState` MIGRATES a token-era save into the
    equivalent own theme, and turns `own` with no readable colour back into `souk`. `CUSTOM_SECTIONS.theme` is now
    `['id','name','seeds']` — `tokens` is refused as a patch key (that is "no one can change the default themes" in code).
  - UI: the editor is a name field + exactly 3 colour pickers; `#btnThemeEdit` = "create my theme", grid click on `own`
    with no colours OPENS the editor instead of selecting, "back to the app theme" keeps his seeds + name.
  - Tests: new contract `test/theme-own.test.ts` (22); `test/theme-custom.test.ts` rewritten (token-override era is dead,
    reason in its header). Theme battery **53 pass / 0 fail** (`theme-own` + `theme-custom` + `themes` + `theme-palette`).
- **Google is OFF the sign-in wall** (Dali, 2026-10-14: "forget about google completly its useless now") — `#btnGoogle`,
  the `or` divider and `#gateHint` are gone from `index.html`, and `ui/app.ts` lost `googleSignIn()`, the busy branch for
  Google and the Google labels. `ui/auth.ts` KEEPS `loginWithGoogle`/`loginWithGoogleRedirect`/`getRedirectResult`
  (unused, still tested by `test/auth-google.test.ts`) — the transport is dormant, not deleted.
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

- **Wave 7 is HALF DONE — the app runs, the tests do not yet agree with it.**
  - Green: `npm run build` (tsc) clean; theme battery 53/53 (`test/theme-own.test.ts` 22, `test/theme-custom.test.ts`,
    `test/themes.test.ts`, `test/theme-palette.test.ts`).
  - NOT yet done: `test/ui.test.ts` still asserts the token-era theme contract (`draft.tokens`, `store['dekkan.themetokens']`,
    `saved().custom.theme.tokens`) and the Google wall (`#btnGoogle`, `#gateHint`) — those blocks (~lines 700–765 and
    ~1060–1150) MUST be rewritten to the seeds model and to "the wall has no Google button".
  - NOT yet done: `e2e/palette.spec.ts` (seeds editor) and `e2e/login-wall.spec.ts` (line 13 asserts `#btnGoogle` is visible
    → now fails by design). `npm run check` therefore FAILS on the UI/e2e layer; the unit-level theme core passes.
  - Not verified on a device yet (no deploy of wave 7): GitHub Pages runs `npm run build` in CI, and tsc is clean, so the
    push publishes the wired UI; the stale e2e specs are the only red.
- Previous session (waves 1–6 + item 4) battery at `5a0d86b`: 414 unit pass / 0 fail, sim 65/65, i18n `en=479 ar=479`.

## Dali's queue (asked, not yet built — in the order he raised them)

1. **Password manager** — Dali explicitly deferred this out of dekkan ("forget about the passwoard manager i will do it
   somewhere else here focus on dekkan only"). An abandoned stub lives in `C:\Users\Dali\Projects\vault` (safe to delete).
   Nothing else is outstanding from his queue as of 2026-10-13 (waves 1–6 + item 4 are in).

## Next step

1. **Finish wave 7:** rewrite `test/ui.test.ts` (theme block → seeds; delete the 4 Google-wall tests, keep "the wall has
   email + password + local mode only"), rewrite `e2e/palette.spec.ts` + `e2e/login-wall.spec.ts`, then `npm run check`
   → `npm run build` → full Playwright → commit → deploy. (Dali stopped the session here on purpose: "push to github and
   push memory and stop here i will complete later".)
2. Deploy: GitHub Pages follows the push; `dekkan.web.app` needs `npx firebase deploy --only hosting`.
3. Wave 3 part C (PHP mirror of the `custom` checks in `api/state.php`) stays deliberately DEFERRED: no `php` runtime here
   and the values are cosmetic (the app repairs what it cannot read).

## Blocked / needs Dali (his hands — this box cannot do these)

- **modali deploy:** `$env:DEKKAN_SFTP_PASS='…'; python scripts/deploy.py` (repo root). The password is not on this box.
- Run the `api/schema-p0.sql` ALTER on the live host (no `php` here).
- Set `backupKey` + `backupRunKey` in the host's `api/config.php`, add the cron call to `api/backup.php?run=…`, then do one
  real restore drill.
- `ui/app.ts` `A_VERSION` still reads `0.19.0` while the About card shows `0.4.0` — one number needed.
- The modali SFTP credential he pasted into a chat is stored nowhere — recommend rotating it.
- ~~Firebase console: enable Google + authorized domains~~ — **MOOT since 2026-10-14**: Google is off the wall.

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
- **Themes: `tokens` is not a writer's key any more.** `state.custom.theme` carries `{id,name,seeds}`; handing `tokens`
  to `applyTheme` is IGNORED and reported (`res.ignored`), and `setCustom(..., {theme:{tokens:{}}})` is REFUSED by the core
  gate. A preset has no writer in the codebase — that is the "no one can change the default themes" guarantee. If you need
  a colour to move, move one of the three seeds.
- `test/theme-palette.test.ts` + `test/theme-own.test.ts` are the two contracts of that engine: the first proves the
  derivation (3 colours → 42 readable tokens), the second proves whose theme it is (his vs the app's).
- `RULES.md` is a real contract — never re-seed it from the template over the real content.
