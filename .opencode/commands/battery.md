---
description: Runs dekkan's full check battery (npm run check -> npm run test -> npm run typecheck -> npm run test:i18n -> npm run test:sim -> npm run test:e2e) and reports PASS/FAIL. Use before committing, or when Dali says "test it".
agent: absolute
---

Run dekkan's own battery, in this order, from the project root:

- `npm run check`
- `npm run test`
- `npm run typecheck`
- `npm run test:i18n`
- `npm run test:sim`
- `npm run test:e2e`

Rules:
- Show live progress, then ONE clear verdict: "X passed / Y failed" (use the tool's own numbers).
- If something fails: name the failing test + file:line, fix the REAL cause, re-run until green.
  **Never weaken or delete a test to make it pass.**
- If a script is missing, say "skipped (no such script)" — never fake a pass.
- Report in max 5 lines: verdict, counts, what you fixed, anything still red.
