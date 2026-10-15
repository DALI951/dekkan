# HANDOFF.md — dekkan

> State of the work for whoever picks this up next (other device, other chat, future you).
> Rewrite it, don't append. The body may be `Nothing pending.` — the file always exists.

Last updated: 2026-10-15 — by Big Pickle (DESKTOP-OJME2E2) — **wave 7 is COMPLETE; the battery is green again**

## Done (this session, newest first)

- **Wave 7 FINISHED — the stale tests now agree with the seeds engine** (picked up the "wave 7 WIP" commit `0f1abb8`):
  - `test/ui.test.ts` rewritten to the post-Google wall (email + password + local mode; the ABSENCE of Google asserted
    against `index.html` text, because the stub DOM auto-creates any element you ask for) and to `{id,name,seeds}` for the
    theme. The one legacy-cache test was SPLIT in two, each with its own reason: (a) a device-only preset choice is adopted
    into state, (b) a wave 5-6 token cache is CONVERTED into an own theme, not dropped.
  - `e2e/palette.spec.ts` fully rewritten to the seeds contract (12 tests × PC+Phone); `e2e/login-wall.spec.ts` rewritten
    (no Google button; the wall answers a mistyped email with its OWN translated error, not a browser bubble).
- **Two REAL bugs found by the browser, fixed in the code (not in the test)**:
  - `themeNameSet` was DEFINED and CALLED in `ui/actions.ts`/`ui/app.ts` but missing from the export map → typing a theme
    name threw `TypeError: A.themeNameSet is not a function` on a real browser and the shopkeeper's own name was lost.
  - `<form id="gateForm">` had `<input type="email">` with native validation ON, so a mistyped address made the browser
    REFUSE the submit — the `submit` event never fired, the app's `auth.err.invalidEmail` never showed, and the wall
    answered a typo with NOTHING. Fixed with `novalidate` so the shop's own message wins (the field type stays `email`
    for the phone keyboard + autofill).
- **New guard: `test/ui.test.ts` asserts the wiring is real** — every `A.<name>(` call in `ui/app.ts` that `ui/actions.ts`
  defines must be in the export map and must be a function (and it asserts it found >30 calls, so it cannot pass vacuously).
  Proven non-vacuous: it fails exactly on `themeNameSet` when the export line is removed. This is the class of bug that
  no unit test could see — the module compiled, the call site existed, only a browser noticed.
- **Wave 7 — the shopkeeper builds HIS OWN theme from 3 colours, and the app's themes have no writer at all**:
  - Model: `state.custom.theme = { id: 'souk'|'mint'|'royal'|'own', name: string, seeds: {brand,money,ground} }`.
    `seeds` are HIS three colours and survive picking a preset (a preset is a choice "for now"); `{}` = he owns none.
    The 42 derived tokens are NEVER stored — they are derived at paint time (a derived value in a file drifts).
  - Engine (`ui/themes.ts`): `THEMES.own` is the 4th card; **presets are strictly read-only** — `applyTheme` ignores any
    `tokens` handed in and REPORTS them in `res.ignored`, and `tokensFor(id, seeds)` is the only path to paint. New:
    `seeds()`, `hasOwn()`, `isCustomized()` (= hasOwn), `seedBag()`/`seedsOf()` (tolerant: accepts seed names OR the tokens
    they drive), `dots(id, seeds)`, `preview(seeds)`, `exportTheme(name, seeds)` → seeds-only JSON, `importTheme` accepts
    `{name,seeds}` AND converts a wave 5-6 `{id,tokens}` file. Cache keys `dekkan.theme` + `dekkan.themeseeds`; the old
    `dekkan.themetokens` is read ONCE (as `{id:'own', seeds:{…}}`) so nobody's first paint regresses.
  - Core: `defaultCustom().theme = {id:'souk', name:'', seeds:{}}`; `customProblems` refuses an extra seed BY NAME,
    allows partial seeds, and refuses `own` with NO colours; `ensureCustomState` MIGRATES a token-era save into the
    equivalent own theme, and turns `own` with no readable colour back into `souk`. `CUSTOM_SECTIONS.theme` is now
    `['id','name','seeds']` — `tokens` is refused as a patch key (that is "no one can change the default themes" in code).
  - UI: the editor is a name field + exactly 3 colour pickers; `#btnThemeEdit` = "create my theme", grid click on `own`
    with no colours OPENS the editor instead of selecting, "back to the app theme" keeps his seeds + name.
  - Tests: `test/theme-own.test.ts` (22) + `test/theme-custom.test.ts` (rewritten; the token-override era is dead, reason
    in its header) + `themes` + `theme-palette` = the theme battery.
- **Google is OFF the sign-in wall** (Dali, 2026-10-14: "forget about google completly its useless now") — `#btnGoogle`,
  the `or` divider and `#gateHint` are gone from `index.html`, and `ui/app.ts` lost `googleSignIn()`, the busy branch for
  Google and the Google labels. `ui/auth.ts` KEEPS `loginWithGoogle`/`loginWithGoogleRedirect`/`getRedirectResult`
  (unused, still tested by `test/auth-google.test.ts`) — the transport is dormant, not deleted.
- **Queue item 4 — the sign-in wall answers the tap, and Google has a way in** (`ui/auth.ts`, `ui/app.ts`,
  `index.html`, `css/style.css`): a blocked popup falls back to the whole-page route (`signInWithRedirect`) and
  `init()` → `getRedirectResult()` signs the returning shopkeeper in; `auth/unauthorized-domain` is named honestly
  (`auth.err.domain`) instead of "wrong password". The wall got its UI pass: real LABELS per field, `dir="ltr"` on the
  email input, one `gateBusy()` locking BOTH buttons, a spinner on the Google button.
- **Wave 6 — THE SHOP'S OWN USERS** (roles, hire-with-login, the counter's door) — `core/accounts.ts` +
  `test/accounts.test.ts` (12), `e2e/team-login.spec.ts` (10 = 5 × PC+Phone). PBKDF2-SHA256 (16-byte salt, 120k rounds)
  via WebCrypto; the password is NEVER stored. Hiring IS giving the login; a shop can never lock itself out (the last
  manager cannot be dropped). The counter's door is `#shopGate`, separate from the cloud wall `#gate`.
- **Wave 5 — the shop's 3 COLOURS generate a whole new palette** (`465701a`); **Wave 4.5** — the paper you chose is the
  paper that prints (`@page{size:80mm auto}` fix) + the shop names itself. **Waves 1–4** (`e4f809e`…`c2b8fa3`):
  `state.custom` foundation, language engine, theme engine, paper/documents, shop lists. Plan: `docs/customize-plan.md`.
- **Live hosts:** `dekkan.web.app` (Firebase) · GitHub Pages (auto on push, `.github/workflows/pages.yml`) · modali via
  `$env:DEKKAN_SFTP_PASS='…'; python scripts/deploy.py` (the password is NOT on this box / never committed).

## In progress

- Nothing. Wave 7 closed on 2026-10-15.

## Dali's queue (asked, not yet built — in the order he raised them)

1. **Password manager** — Dali explicitly deferred this out of dekkan ("forget about the passwoard manager i will do it
   somewhere else here focus on dekkan only"). An abandoned stub lives in `C:\Users\Dali\Projects\vault` (safe to delete).
   Nothing else is outstanding from his queue as of 2026-10-15.

## Next step

1. Deploy wave 7: GitHub Pages follows the push; `dekkan.web.app` needs `npx firebase deploy --only hosting`; modali needs
   Dali's SFTP password.
2. Wave 3 part C (PHP mirror of the `custom` checks in `api/state.php`) stays deliberately DEFERRED: no `php` runtime here
   and the values are cosmetic (the app repairs what it cannot read).

## Blocked / needs Dali (his hands — this box cannot do these)

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
- The full e2e battery is 246 tests × 1 worker ≈ 16 min: if the tool session gets restarted mid-run, launch it DETACHED
  (`Start-Process cmd.exe /c … > file`) so it survives.

## Watch out

- `index.html` / `css/style.css` / `ui/lang.ts` are **CRLF**; `RULES.md` and the `.ts` sources are **LF**. Never patch with
  `Get-Content`/`Set-Content` (BOM + mojibake) — node file surgery, then re-check line endings.
- **A new loaded file must join EVERY loader list**: `index.html`, `test/ui.test.ts`, `sw.ts` SHELL (+ `SW_VERSION`),
  `scripts/deploy.py` FILES, and the vm sandboxes that load that layer. Bump `SW_VERSION` on every deploy.
- **A function that `ui/app.ts` calls must be in `ui/actions.ts`'s export map** — nothing else catches the slip
  (`themeNameSet`, wave 7). `test/ui.test.ts`'s wiring guard now does.
- **Inserting i18n keys: anchor on the RIGHT dictionary.** `insertAfterKey('toast.debtName')` matched the Arabic dict twice
  (the key exists once per language) and TS1117 caught it — patch the English dict first, then the Arabic one, and re-run
  `npm run check` (i18n parity is enforced).
- A new screen ALSO needs an e2e spec; the vm harness cannot run generated DOM.
- **`page.goto('/#/other')` does NOT reload the document** (same-document hash change). For a "fresh browser" clear
  `sessionStorage` then `goto('about:blank')` first, or `page.reload()`.
- The e2e rail is a sidebar on PC and a top strip on the phone: find a tab with
  `button[data-hash="#/x"]` (+ `:visible` when asserting it must be seen, and `:visible` never matches for `toBeHidden`).
- `page.pdf({preferCSSPageSize:true})` is the only honest way to test paper size; `window.print()` is a no-op in headless.
- **A native validation bubble is not the shop's language**: the gate form carries `novalidate` so the app's own error
  shows. Do not remove it to "simplify" the markup — the field type is what makes the phone keyboard right.
- `scripts/seed-test.json` is intentionally untracked — leave it. `.firebase/` is gitignored (deploy cache).
- **Themes: `tokens` is not a writer's key any more.** `state.custom.theme` carries `{id,name,seeds}`; handing `tokens`
  to `applyTheme` is IGNORED and reported (`res.ignored`), and `setCustom(..., {theme:{tokens:{}}})` is REFUSED by the core
  gate. A preset has no writer in the codebase — that is the "no one can change the default themes" guarantee. If you need
  a colour to move, move one of the three seeds.
- `test/theme-palette.test.ts` + `test/theme-own.test.ts` are the two contracts of that engine: the first proves the
  derivation (3 colours → 42 readable tokens), the second proves whose theme it is (his vs the app's).
- `RULES.md` is a real contract — never re-seed it from the template over the real content.
