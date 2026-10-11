# RULES.md — dekkan

> Project rules. Binding for every session, on every machine (injected automatically).
> Rules only — current state lives in `HANDOFF.md`.
> Seeded 2026-10-11 — lines marked `[ ] ASK DALI` are not answers yet.

## What this project is
Dekkan — Arabic-first small-shop kit. Cash box, stock, debts, profit. (The algorithm, tested.)

## Stack
plain JS/HTML
Package manager: `npm`

## Repo
- Root: `C:/Users/Dali/Projects/dekkan`
- Remote: `https://github.com/DALI951/dekkan.git`  ← check visibility before putting anything private in here
- Branch: `main`

## Commands (exact)
| Purpose | Command | Working dir |
|---|---|---|
| build | `npm run build` | `C:/Users/Dali/Projects/dekkan` |
| test | `npm run test` | `C:/Users/Dali/Projects/dekkan` |
| test | `npm run test:sim` | `C:/Users/Dali/Projects/dekkan` |
| test | `npm run test:e2e` | `C:/Users/Dali/Projects/dekkan` |
| lint + test battery | `npm run check` | `C:/Users/Dali/Projects/dekkan` |
| typecheck | `npm run typecheck` | `C:/Users/Dali/Projects/dekkan` |
| test:i18n | `npm run test:i18n` | `C:/Users/Dali/Projects/dekkan` |
| serve | `npm run serve` | `C:/Users/Dali/Projects/dekkan` |

## Conventions
- [ ] ASK DALI — naming, file layout, formatting, UI language (AR/EN?), branch habits

## Do NOT
- Never commit secrets, tokens or passwords (this may be a public repo).
- Never force-push a shared branch. Never destroy uncommitted work without asking.
- Never "fix" a failing test by weakening the test.
- [ ] ASK DALI — what has broken here before / what must never happen again

## Decisions (why — append-only)
- (none recorded yet)

## Open questions for Dali
- [ ] What are the exact build/test/deploy commands you actually use?
- [ ] What conventions must always be followed in this repo?
- [ ] What must never happen here (past pain points)?
- [ ] Anything about deployment / hosting / credentials *location* (not the secrets themselves)?
- [ ] `74` test/spec files detected — is the battery green right now?
